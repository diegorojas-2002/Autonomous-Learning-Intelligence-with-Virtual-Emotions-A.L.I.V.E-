import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { AffectiveStateEngine, ExtremeScenario } from './AffectiveEngine.js';
import { AppError } from './errors.js';

export const hashToken = token => createHash('sha256').update(token).digest('hex');
export const isUUID = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function snapshot(agent) {
  // Sin redondear: conservar precisión del motor. Nunca persistir history.
  return { valence: agent.valence, user_affinity: agent.user_affinity,
    stress: agent.stress, fatigue: agent.fatigue, ego: agent.ego,
    active_scenario: agent.activeScenario, is_locked: agent.isLocked };
}
export function restore(state) {
  const agent = new AffectiveStateEngine();
  for (const [key, min, max] of [['valence', -1, 1], ['user_affinity', -1, 1],
    ['stress', 0, 10], ['fatigue', 0, 100], ['ego', 0, 100]]) {
    if (!Number.isFinite(state[key]) || state[key] < min || state[key] > max) throw new Error('Estado persistido inválido');
    agent[key] = state[key];
  }
  if (!Object.values(ExtremeScenario).includes(state.active_scenario) || typeof state.is_locked !== 'boolean') throw new Error('Escenario persistido inválido');
  agent.activeScenario = state.active_scenario;
  agent.isLocked = state.is_locked;
  return agent;
}
export const sessionView = row => ({ session_id: row.id, version: Number(row.version), telemetry: restore(row.state).getStateSummary() });
const busy = () => new AppError(409, 'SESSION_BUSY', 'Tu sesión está procesando otra operación. Espera a que termine.');
const changed = () => new AppError(409, 'SESSION_CHANGED', 'La sesión cambió. Sincroniza antes de continuar.');

export class SessionStore {
  constructor(db) { this.db = db; }
  async transaction(fn) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* conservar el error original */ }
      throw error;
    } finally { client.release(); }
  }
  async create(client = this.db) {
    const token = randomBytes(32).toString('hex');
    const result = await client.query('INSERT INTO sessions (id, token_hash, state) VALUES ($1,$2,$3) RETURNING *',
      [randomUUID(), hashToken(token), snapshot(new AffectiveStateEngine())]);
    return { row: result.rows[0], token };
  }
  async find(token) {
    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return null;
    const result = await this.db.query('SELECT * FROM sessions WHERE token_hash=$1 AND retired=FALSE', [hashToken(token)]);
    return result.rows[0] ?? null;
  }
  async acquire(row, operation, version) {
    // Actualización atómica compartida por todas las instancias de Vercel.
    const result = await this.db.query(`UPDATE sessions SET operation_id=$2,
      operation_expires_at=CURRENT_TIMESTAMP + INTERVAL '120 seconds'
      WHERE id=$1 AND retired=FALSE
      AND (operation_id IS NULL OR operation_expires_at < CURRENT_TIMESTAMP)
      RETURNING *`, [row.id, operation]);
    if (!result.rows.length) throw busy();
    const current = result.rows[0];
    try {
      const done = await this.db.query('SELECT operation_id FROM interactions WHERE operation_id=$1 AND session_id=$2', [operation, row.id]);
      if (done.rows.length) throw new AppError(409, 'OPERATION_COMPLETED',
        'Esta operación ya se completó. El estado se recuperó, pero la respuesta no se conserva.', sessionView(current));
      if (Number(current.version) !== version) throw new AppError(409, 'STATE_CHANGED',
        'El estado cambió en otra petición. Sincroniza la sesión antes de continuar.', sessionView(current));
      return current;
    } catch (error) { await this.release(row.id, operation); throw error; }
  }
  async release(id, operation) {
    await this.db.query('UPDATE sessions SET operation_id=NULL, operation_expires_at=NULL WHERE id=$1 AND operation_id=$2', [id, operation]);
  }
  async complete(row, operation, state, thought) {
    return this.transaction(async client => {
      const result = await client.query(`UPDATE sessions SET state=$3, version=version+1,
        updated_at=CURRENT_TIMESTAMP, operation_id=NULL, operation_expires_at=NULL
        WHERE id=$1 AND operation_id=$2 AND version=$4 AND retired=FALSE
        AND operation_expires_at > CURRENT_TIMESTAMP RETURNING *`, [row.id, operation, state, row.version]);
      if (!result.rows.length) throw changed();
      await client.query('INSERT INTO interactions(operation_id,session_id,thought_trace,state) VALUES ($1,$2,$3,$4)',
        [operation, row.id, thought, state]);
      return result.rows[0];
    });
  }
  async reset(row, operation) {
    return this.transaction(async client => {
      const result = await client.query(`UPDATE sessions SET retired=TRUE, operation_id=NULL,
        operation_expires_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND operation_id=$2
        AND operation_expires_at > CURRENT_TIMESTAMP AND retired=FALSE RETURNING id`, [row.id, operation]);
      if (!result.rows.length) throw changed();
      return this.create(client);
    });
  }
}
