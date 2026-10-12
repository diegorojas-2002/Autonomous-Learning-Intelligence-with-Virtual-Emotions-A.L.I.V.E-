import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createApp } from '../backend/app.js';
import { database } from './helpers.js';
import { SessionStore, snapshot } from '../backend/sessionStore.js';
import { AffectiveStateEngine, ExtremeScenario } from '../backend/AffectiveEngine.js';

const evaluation = { delta_valence: 0.12, delta_affinity: 0.23, delta_stress: 0.75,
  delta_ego: -2, delta_fatigue: 3, is_calming_prompt: false,
  thought_trace: 'Pensamiento: Me sorprende. Justificación: cambia mi ánimo.' };

test('integración dev + Postgres: contexto, dolor evaluado, cero y transiciones persistidas', async t => {
  const { store, db, pg } = await database();
  const evaluated = [];
  const acted = [];
  const services = {
    evaluateUserPrompt: async (message, agent) => {
      evaluated.push({ kind: 'chat', input: message, state: snapshot(agent), history: structuredClone(agent.history) });
      return { ...evaluation, delta_affinity: 0.1 };
    },
    evaluatePainStimulus: async (percentage, agent) => {
      evaluated.push({ kind: 'pain', input: percentage, state: snapshot(agent), history: structuredClone(agent.history) });
      return { ...evaluation };
    },
    generateActorResponse: async agent => {
      acted.push({ state: snapshot(agent), history: structuredClone(agent.history) });
      return 'Respuesta privada del actor';
    }
  };
  const servers = [];
  t.after(async () => { for (const server of servers) await new Promise(resolve => server.close(resolve)); await pg.close(); });
  const start = async store => {
    const server = createApp({ store, ...services }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    servers.push(server);
    return `http://127.0.0.1:${server.address().port}`;
  };
  const base = await start(store);
  const post = async (origin, path, body = {}, cookie = '') => {
    const response = await fetch(`${origin}/api/${path}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const session = await post(base, 'session');
  const cookie = session.cookie;
  const operation = (view, extra = {}) => ({ session_id: view.session_id, version: view.version,
    operation_id: randomUUID(), history: [], ...extra });
  const history = [{ role: 'user', parts: [{ text: 'Mensaje privado anterior' }] },
    { role: 'model', parts: [{ text: 'Respuesta privada anterior' }] }];
  const request = operation(session.data, { pain_percentage: 25, history });
  const pain = await post(base, 'pain', request, cookie);
  assert.equal(pain.status, 200);
  assert.equal(evaluated[0].input, 25);
  assert.deepEqual(evaluated[0].history, history);
  assert.equal(evaluated[0].state.valence, 0);
  // Cambios dev interpretados por el evaluador, sin multiplicadores por porcentaje.
  assert.equal(pain.data.telemetry.valence, 0.12);
  assert.equal(pain.data.telemetry.user_affinity, 0.23);
  assert.equal(pain.data.telemetry.stress, 0.75);
  assert.equal(pain.data.telemetry.ego, 48);
  assert.equal(pain.data.telemetry.fatigue, 5); // 3 evaluados + 2 automáticos, una sola vez.
  assert.equal(acted[0].state.fatigue, 5);
  assert.match(acted[0].history.at(-1).parts[0].text, /25%/);
  assert.equal(pain.data.thought_trace, evaluation.thought_trace);
  const interaction = (await db.query('SELECT * FROM interactions')).rows[0];
  assert.equal(interaction.thought_trace, evaluation.thought_trace);
  assert.equal(interaction.state.valence, 0.12);
  assert.ok(!('history' in interaction.state));
  const duplicate = await post(base, 'pain', request, cookie);
  assert.equal(duplicate.data.code, 'OPERATION_COMPLETED');
  assert.equal(evaluated.length, 1);

  // Nueva instancia: el evaluador recibe el estado guardado por la anterior.
  const restarted = await start(new SessionStore(db));
  const zero = await post(restarted, 'pain', operation(pain.data, { pain_percentage: 0, history }), cookie);
  assert.equal(zero.status, 200);
  assert.equal(evaluated.at(-1).state.fatigue, 5);
  assert.equal(zero.data.telemetry.valence, 0.12);
  assert.equal(zero.data.telemetry.user_affinity, 0.23);
  assert.equal(zero.data.telemetry.stress, 0.75);
  assert.equal(zero.data.telemetry.ego, 48);
  assert.equal(zero.data.telemetry.fatigue, 7);
  const message = await post(restarted, 'chat', operation(zero.data, { message: 'Mensaje actual privado', history }), cookie);
  assert.equal(message.status, 200);
  assert.equal(evaluated.at(-1).kind, 'chat');
  assert.equal(evaluated.at(-1).state.fatigue, 7);
  assert.deepEqual(evaluated.at(-1).history, history);
  assert.equal(acted.at(-1).state.valence, 0.24);

  // Los escenarios de dev siguen bajo control del motor, aunque se restaure desde DB.
  const depressed = new AffectiveStateEngine();
  depressed.valence = -1;
  depressed.activeScenario = ExtremeScenario.DEPRESSION;
  await db.query('UPDATE sessions SET state=$2 WHERE id=$1', [session.data.session_id, snapshot(depressed)]);
  const recovered = await post(base, 'pain', operation(message.data, { pain_percentage: 85 }), cookie);
  assert.equal(recovered.status, 200);
  assert.equal(recovered.data.telemetry.active_scenario, ExtremeScenario.NONE);
  assert.equal(recovered.data.telemetry.valence, -0.3);
  assert.equal(acted.at(-1).state.active_scenario, ExtremeScenario.NONE);
  const locked = new AffectiveStateEngine();
  locked.activeScenario = ExtremeScenario.INFATUATION;
  locked.isLocked = true;
  await db.query('UPDATE sessions SET state=$2 WHERE id=$1', [session.data.session_id, snapshot(locked)]);
  const afterLock = await post(restarted, 'pain', operation(recovered.data, { pain_percentage: 100 }), cookie);
  assert.equal(afterLock.status, 200);
  assert.equal(afterLock.data.telemetry.active_scenario, ExtremeScenario.INFATUATION);
  assert.equal(afterLock.data.telemetry.is_locked, true);
  const final = await post(base, 'session', {}, cookie);
  assert.equal(final.data.telemetry.is_locked, true);
  const stored = JSON.stringify((await db.query('SELECT * FROM sessions')).rows) + JSON.stringify((await db.query('SELECT * FROM interactions')).rows);
  for (const text of ['Mensaje privado anterior', 'Respuesta privada anterior', 'Mensaje actual privado', 'Respuesta privada del actor']) assert.ok(!stored.includes(text));
});
