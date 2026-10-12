import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { JSDOM } from 'jsdom';

const html = await readFile(new URL('../frontend/index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../frontend/app.js', import.meta.url), 'utf8');
const key = 'alive_conversation_v1';
const until = async condition => {
  for (let i = 0; i < 200; i++) {
    if (condition()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('El frontend no terminó la operación');
};
function browser(t, handler, saved) {
  const dom = new JSDOM(html, { url: 'https://alive.example', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.structuredClone = structuredClone;
  if (saved) dom.window.sessionStorage.setItem(key, JSON.stringify(saved));
  dom.window.fetch = async (url, init) => handler(url.split('/').at(-1), JSON.parse(init.body));
  dom.window.eval(script);
  return dom.window;
}
const response = (data, status = 200) => ({ ok: status === 200, status, json: async () => data });

test('frontend: sobrecarga conserva mensaje, recarga restaura contexto y reinicio lo borra', async t => {
  let view = { session_id: randomUUID(), version: 0 };
  let mode = 'overload';
  let calls = 0;
  let payload;
  const handler = (kind, body) => {
    if (kind === 'session') return response(view);
    if (kind === 'reset') { view = { session_id: randomUUID(), version: 0 }; return response({ ...view, message: 'Reinicio confirmado' }); }
    payload = body;
    calls++;
    if (mode === 'overload') return response({ code: 'GEMINI_UNAVAILABLE', error: 'Gemini está temporalmente sobrecargado.' }, 503);
    view = { ...view, version: view.version + 1 };
    return response({ ...view, response: 'Respuesta' });
  };
  const win = browser(t, handler);
  const doc = win.document;
  await until(() => !doc.getElementById('send-btn').disabled);
  doc.getElementById('user-input').value = 'Mensaje privado';
  doc.getElementById('send-btn').click();
  await until(() => !doc.getElementById('send-btn').disabled);
  assert.equal(calls, 1);
  assert.equal(doc.getElementById('user-input').value, 'Mensaje privado');
  assert.match(doc.getElementById('chat-feed').textContent, /sobrecargado/);
  assert.equal(JSON.parse(win.sessionStorage.getItem(key)).history.length, 0);
  mode = 'success';
  doc.getElementById('send-btn').click();
  await until(() => !doc.getElementById('send-btn').disabled);
  const stored = JSON.parse(win.sessionStorage.getItem(key));
  assert.equal(stored.history.length, 2);
  const reloaded = browser(t, handler, stored);
  await until(() => !reloaded.document.getElementById('send-btn').disabled);
  assert.match(reloaded.document.getElementById('chat-feed').textContent, /Mensaje privado/);
  reloaded.document.getElementById('user-input').value = 'Segundo';
  reloaded.document.getElementById('send-btn').click();
  await until(() => !reloaded.document.getElementById('send-btn').disabled);
  assert.equal(payload.history[0].parts[0].text, 'Mensaje privado');
  reloaded.document.getElementById('reset-btn').click();
  await until(() => !reloaded.document.getElementById('reset-btn').disabled);
  const reset = JSON.parse(reloaded.sessionStorage.getItem(key));
  assert.notEqual(reset.session_id, stored.session_id);
  assert.equal(reset.history.length, 0);
  assert.doesNotMatch(reloaded.document.getElementById('chat-feed').textContent, /Mensaje privado/);
});

test('frontend: resultado incierto reintenta el mismo ID sin duplicar el estado', async t => {
  const view = { session_id: randomUUID(), version: 0 };
  const ids = [];
  const win = browser(t, (kind, body) => {
    if (kind === 'session') return response(view);
    ids.push(body.operation_id);
    if (ids.length === 1) throw new Error('Conexión perdida');
    view.version = 1;
    return response({ code: 'OPERATION_COMPLETED', error: 'La operación ya se completó.' }, 409);
  });
  const doc = win.document;
  await until(() => !doc.getElementById('send-btn').disabled);
  doc.getElementById('user-input').value = 'Mensaje';
  doc.getElementById('send-btn').click();
  await until(() => !doc.getElementById('retry-btn').disabled && !doc.getElementById('retry-btn').hidden);
  assert.equal(doc.getElementById('send-btn').disabled, true);
  const pending = JSON.parse(win.sessionStorage.getItem(key)).pending;
  assert.equal(pending.body.operation_id, ids[0]);
  doc.getElementById('retry-btn').click();
  await until(() => !doc.getElementById('send-btn').disabled);
  assert.equal(ids[0], ids[1]);
  const stored = JSON.parse(win.sessionStorage.getItem(key));
  assert.equal(stored.version, 1);
  assert.equal(stored.pending, null);
  assert.equal(stored.history.length, 0);
});
