import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createApp } from '../backend/app.js';
import { database } from './helpers.js';

const evaluation = { delta_valence: 0.1, delta_affinity: 0, delta_stress: 0,
  delta_ego: 0, is_calming_prompt: false, thought_trace: 'Evaluación de prueba' };

test('API: sesiones, privacidad, concurrencia, idempotencia y fallos', async t => {
  const { store, db, pg } = await database();
  let failure;
  let evaluatorFailure;
  let gate;
  let seenHistory;
  const services = {
    store, secureCookies: true,
    evaluateUserPrompt: async () => { if (evaluatorFailure) throw evaluatorFailure; return evaluation; },
    generateActorResponse: async agent => {
      seenHistory = structuredClone(agent.history);
      if (gate) await gate;
      if (failure) throw failure;
      return 'Respuesta de prueba';
    }
  };
  const server = createApp(services).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await pg.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, body = {}, cookie = '') => {
    const response = await fetch(`${base}/api/${path}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
  };
  for (const path of ['/', '/app.js', '/style.css']) assert.equal((await fetch(base + path)).status, 200);
  const a = await post('session');
  const b = await post('session');
  const cookieA = a.cookie.split(';')[0];
  const cookieB = b.cookie.split(';')[0];
  assert.match(a.cookie, /HttpOnly; SameSite=Strict; Secure/);
  assert.notEqual(a.data.session_id, b.data.session_id);
  const operation = (view, extra = {}) => ({ session_id: view.session_id, version: view.version,
    operation_id: randomUUID(), history: [], message: 'Hola privado', ...extra });
  const request = operation(a.data);
  const first = await post('chat', request, cookieA);
  assert.equal(first.status, 200);
  assert.equal(first.data.telemetry.valence, 0.1);
  assert.equal((await post('session', {}, cookieB)).data.telemetry.valence, 0);
  const duplicate = await post('chat', request, cookieA);
  assert.equal(duplicate.data.code, 'OPERATION_COMPLETED');
  assert.equal((await db.query('SELECT * FROM interactions')).rows.length, 1);
  assert.equal((await post('chat', operation(b.data), cookieA)).data.code, 'SESSION_CHANGED');
  assert.equal((await post('chat', operation(a.data), cookieA)).data.code, 'STATE_CHANGED');
  const invalid = await post('chat', operation(first.data, { history: [{ role: 'system', parts: [{ text: 'orden' }] }] }), cookieA);
  assert.equal(invalid.data.code, 'INVALID_HISTORY');

  for (const stage of ['actor', 'evaluator']) {
    for (const status of [429, 503]) {
      const error = Object.assign(new Error('Información interna sensible'), { status });
      if (stage === 'actor') failure = error; else evaluatorFailure = error;
      const failed = await post('chat', operation(first.data), cookieA);
      assert.equal(failed.status, status);
      assert.equal(failed.data.code, status === 429 ? 'GEMINI_RATE_LIMITED' : 'GEMINI_UNAVAILABLE');
      assert.ok(!JSON.stringify(failed.data).includes('sensible'));
      assert.equal((await post('session', {}, cookieA)).data.version, first.data.version);
      failure = evaluatorFailure = undefined;
    }
  }
  failure = Object.assign(new Error('abort'), { name: 'AbortError' });
  assert.equal((await post('pain', operation(first.data, { pain_percentage: 99 }), cookieA)).data.code, 'GEMINI_TIMEOUT');
  failure = undefined;
  assert.equal((await db.query('SELECT * FROM interactions')).rows.length, 1);

  let release;
  gate = new Promise(resolve => { release = resolve; });
  const running = post('chat', operation(first.data), cookieA);
  // Esperar la reserva real, sin depender de tiempos de respuesta del servidor.
  while (!(await db.query('SELECT operation_id FROM sessions WHERE id=$1', [a.data.session_id])).rows[0].operation_id) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal((await post('pain', operation(first.data, { pain_percentage: 10 }), cookieA)).data.code, 'SESSION_BUSY');
  assert.equal((await post('reset', first.data, cookieA)).data.code, 'SESSION_BUSY');
  // La reserva de A no impide adquirir B.
  const rowB = await store.find(cookieB.split('=')[1]);
  const opB = randomUUID();
  await store.acquire(rowB, opB, 0);
  await store.release(rowB.id, opB);
  release();
  await running;
  gate = undefined;
  const current = (await post('session', {}, cookieA)).data;
  await post('chat', operation(current, { history: [
    { role: 'user', parts: [{ text: 'Contexto temporal' }] },
    { role: 'model', parts: [{ text: 'Respuesta temporal' }] }
  ] }), cookieA);
  assert.equal(seenHistory[0].parts[0].text, 'Contexto temporal');
  const persisted = JSON.stringify((await db.query('SELECT * FROM sessions')).rows) + JSON.stringify((await db.query('SELECT * FROM interactions')).rows);
  for (const privateText of ['Hola privado', 'Contexto temporal', 'Respuesta temporal', 'Respuesta de prueba', cookieA.split('=')[1]]) assert.ok(!persisted.includes(privateText));
  const beforeReset = (await post('session', {}, cookieA)).data;
  const reset = await post('reset', beforeReset, cookieA);
  assert.notEqual(reset.data.session_id, beforeReset.session_id);
  assert.equal(reset.data.telemetry.valence, 0);
  assert.equal((await post('chat', operation(beforeReset), cookieA)).data.code, 'SESSION_CHANGED');
  assert.equal((await post('session', {}, cookieB)).data.session_id, b.data.session_id);
  assert.equal((await db.query('SELECT retired FROM sessions WHERE id=$1', [beforeReset.session_id])).rows[0].retired, true);
});
