import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database } from './helpers.js';
import { SessionStore, snapshot, restore } from '../backend/sessionStore.js';
import { AffectiveStateEngine, ExtremeScenario } from '../backend/AffectiveEngine.js';

test('Postgres: recuperación, precisión, rollback y reservas vencidas', async t => {
  const { store, db, pg } = await database();
  t.after(() => pg.close());
  const { row, token } = await store.create();
  const state = snapshot(new AffectiveStateEngine());
  state.valence = 0.123456789;
  state.active_scenario = ExtremeScenario.MADNESS;
  state.is_locked = true;
  const operation = randomUUID();
  await store.acquire(row, operation, 0);
  const saved = await store.complete(row, operation, state, 'Traza');
  const reloaded = await new SessionStore(db).find(token);
  assert.equal(reloaded.state.valence, 0.123456789);
  assert.equal(restore(reloaded.state).isLocked, true);
  assert.deepEqual(restore(reloaded.state).history, []);
  assert.equal(Number(saved.version), 1);

  const otherOperation = randomUUID();
  await store.acquire(reloaded, otherOperation, 1);
  // Forzar fallo después del UPDATE dentro de la transacción.
  await assert.rejects(store.complete(reloaded, otherOperation, { ...state, valence: 0.5 }, null));
  assert.equal((await store.find(token)).state.valence, state.valence);
  assert.equal(Number((await store.find(token)).version), 1);
  await store.release(row.id, otherOperation);

  const abandoned = randomUUID();
  await store.acquire(reloaded, abandoned, 1);
  await db.query("UPDATE sessions SET operation_expires_at=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE id=$1", [row.id]);
  const fresh = randomUUID();
  await store.acquire(reloaded, fresh, 1);
  await assert.rejects(store.complete(reloaded, abandoned, state, 'No debe guardarse'));
  await store.release(row.id, abandoned);
  assert.equal((await store.find(token)).operation_id, fresh);
  await store.complete(reloaded, fresh, state, 'Recuperada');
  assert.equal((await db.query('SELECT * FROM interactions')).rows.length, 2);
});
