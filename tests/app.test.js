import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../backend/app.js';

const evaluation = { delta_valence: 0.1, delta_affinity: 0, delta_stress: 0,
  delta_ego: 0, is_calming_prompt: false, thought_trace: 'Evaluación de prueba' };

test('frontend y API comparten origen; un fallo del actor conserva el estado', async (t) => {
  let fail = false;
  const app = createApp({
    evaluateUserPrompt: async () => evaluation,
    generateActorResponse: async () => {
      if (fail) throw new Error('Fallo simulado del actor');
      return 'Respuesta de prueba';
    }
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(`${base}/api/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  for (const path of ['/', '/style.css', '/app.js']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    if (path === '/app.js') assert.match(await response.text(), /API_BASE = '\/api'/);
  }
  const baseline = await (await post('reset', {})).json();
  assert.equal((await post('chat', { message: '' })).status, 400);
  const chat = await (await post('chat', { message: 'Hola' })).json();
  assert.equal(chat.response, 'Respuesta de prueba');
  assert.equal(chat.telemetry.valence, 0.1);
  fail = true;
  assert.equal((await post('pain', { pain_percentage: 100 })).status, 500);
  fail = false;
  const afterFailure = await (await post('pain', { pain_percentage: 0 })).json();
  assert.equal(afterFailure.telemetry.valence, chat.telemetry.valence);
  assert.equal(afterFailure.telemetry.stress, chat.telemetry.stress);
  assert.equal(afterFailure.telemetry.fatigue, chat.telemetry.fatigue + 2);
  const reset = await (await post('reset', {})).json();
  assert.deepEqual(reset.telemetry, baseline.telemetry);
});
