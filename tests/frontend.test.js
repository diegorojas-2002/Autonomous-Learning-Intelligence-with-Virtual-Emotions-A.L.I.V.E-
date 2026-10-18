import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { JSDOM } from 'jsdom';

const html = await readFile(new URL('../frontend/index.html', import.meta.url), 'utf8');
const scripts = await Promise.all(['vendor/marked.umd.js', 'markdown.js', 'app.js'].map(file => readFile(new URL(`../frontend/${file}`, import.meta.url), 'utf8')));
const key = 'alive_conversation_v1';
const until = async condition => {
  for (let i = 0; i < 200; i++) {
    if (condition()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('El frontend no terminó la operación');
};
const response = (data, status = 200) => ({ ok: status === 200, status, json: async () => data });
const initial = () => ({ session_id: randomUUID(), version: 0 });
function browser(t, handler, saved, { mobile = false, storageBlocked = false } = {}) {
  const dom = new JSDOM(html, { url: 'https://alive.example', runScripts: 'outside-only', pretendToBeVisual: true });
  const win = dom.window;
  t.after(() => win.close());
  win.structuredClone = structuredClone;
  win.matchMedia = () => ({ matches: mobile, addEventListener() {} });
  // jsdom lacks modal top-layer and focus behavior; native behavior is checked in browser.
  win.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  win.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new win.Event('close')); };
  if (saved) win.sessionStorage.setItem(key, JSON.stringify(saved));
  if (storageBlocked) Object.defineProperty(win, 'sessionStorage', { get() { throw new Error('Storage unavailable'); } });
  win.fetch = async (url, init) => {
    assert.equal(init.credentials, 'same-origin');
    assert.equal(init.method, 'POST');
    return handler(url.split('/').at(-1), JSON.parse(init.body));
  };
  const errors = [];
  win.addEventListener('error', event => errors.push(event.error));
  t.after(() => assert.deepEqual(errors, [], 'sin errores JavaScript'));
  for (const script of scripts) win.eval(script);
  const $ = id => win.document.getElementById(id);
  return { win, $, stored: () => JSON.parse(win.sessionStorage.getItem(key)),
    input(text) { $('user-input').value = text; $('user-input').dispatchEvent(new win.Event('input', { bubbles: true })); },
    idle: () => until(() => $('chat-feed').getAttribute('aria-busy') === 'false'),
    key(options = {}) { const event = new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options }); $('user-input').dispatchEvent(event); return event; }
  };
}
function normal() {
  let view = initial();
  const calls = [];
  return { calls, handler(kind, body) {
    calls.push({ kind, body });
    if (kind === 'reset') view = initial();
    else if (kind !== 'session') view.version++;
    return response({ ...view, response: 'Una **respuesta** de ALIVE.\n\n- Primera idea\n- Segunda idea' });
  } };
}

test('bienvenida: inicialización pendiente, sugerencia editable y ningún reintento normal', async t => {
  let finish;
  const b = browser(t, () => new Promise(resolve => { finish = resolve; }));
  assert.equal(b.$('send-btn').disabled, true);
  assert.equal(b.$('retry-btn').hidden, true);
  assert.match(b.$('session-status').textContent, /Preparando/);
  assert.ok(b.$('chat-feed').querySelector('.welcome'));
  finish(response(initial()));
  await b.idle();
  assert.equal(b.$('send-btn').disabled, true);
  assert.equal(b.$('operation-notice').hidden, true);
  b.$('chat-feed').querySelector('[data-suggestion]').click();
  assert.match(b.$('user-input').value, /Hola, ALIVE/);
  assert.equal(b.$('send-btn').disabled, false);
  assert.equal(b.stored().history.length, 0);
});

test('envío por botón y teclado, saltos de línea, IME, bloqueo y contexto tras recarga', async t => {
  const service = normal();
  let finish;
  const b = browser(t, (kind, body) => kind === 'chat' ? new Promise(resolve => { finish = () => resolve(service.handler(kind, body)); }) : service.handler(kind, body));
  await b.idle();
  b.input('   ');
  assert.equal(b.$('send-btn').disabled, true);
  b.input('Hola\nALIVE');
  assert.equal(b.key({ shiftKey: true }).defaultPrevented, false);
  assert.equal(b.key({ isComposing: true }).defaultPrevented, false);
  b.$('user-input').dispatchEvent(new b.win.CompositionEvent('compositionstart'));
  b.key();
  assert.equal(service.calls.length, 1);
  b.$('user-input').dispatchEvent(new b.win.CompositionEvent('compositionend'));
  assert.equal(b.key().defaultPrevented, true);
  for (const id of ['send-btn', 'pain-btn', 'user-input', 'pain-slider', 'pain-number', 'reset-btn']) assert.equal(b.$(id).disabled, true, id);
  assert.match(b.$('activity').textContent, /ALIVE está respondiendo/);
  assert.equal(b.$('retry-btn').hidden, true);
  finish(); await b.idle();
  assert.equal(b.$('user-input').value, '');
  assert.equal(b.$('send-btn').disabled, true);
  assert.equal(b.$('chat-feed').querySelector('.welcome'), null);
  assert.ok(b.$('chat-feed').querySelector('strong'));
  const c = browser(t, service.handler, b.stored()); await c.idle();
  assert.match(c.$('chat-feed').textContent, /Hola\nALIVE/);
  assert.equal(c.$('operation-notice').hidden, true);
  c.input('Segundo'); c.$('send-btn').click(); await c.idle();
  assert.equal(service.calls.at(-1).body.history[0].parts[0].text, 'Hola\nALIVE');
});

for (const [code, copy] of [['GEMINI_UNAVAILABLE', 'ALIVE no puede responder en este momento'], ['GEMINI_RATE_LIMITED', 'El servicio alcanzó su límite temporal'], ['GEMINI_TIMEOUT', 'ALIVE tardó demasiado']]) {
  test(`fallo confirmado ${code}: conserva borrador y permite reintento explícito`, async t => {
    const view = initial();
    const ids = [];
    const b = browser(t, (kind, body) => {
      if (kind === 'session') return response(view);
      ids.push(body.operation_id);
      if (ids.length === 1) return response({ code, error: 'DETALLE INTERNO' }, 503);
      return response({ ...view, version: 1, response: 'Listo' });
    });
    await b.idle(); b.input('Mensaje conservado'); b.$('send-btn').click(); await b.idle();
    assert.equal(b.$('user-input').value, 'Mensaje conservado');
    assert.equal(b.stored().pending, null);
    assert.ok(b.$('notice-text').textContent.includes(copy));
    assert.doesNotMatch(b.$('chat-feed').textContent, /DETALLE INTERNO/);
    assert.equal(b.$('operation-notice').parentElement.id, 'chat-notice-slot');
    b.$('retry-btn').click(); await b.idle();
    assert.notEqual(ids[0], ids[1]);
    assert.equal(b.stored().history.length, 2);
    assert.equal(b.$('operation-notice').hidden, true);
  });
}

for (const code of [null, 'SESSION_BUSY', 'INTERNAL_ERROR']) {
  test(`resultado incierto ${code}: mismo ID y mismo payload en reintento`, async t => {
    const view = initial(); const bodies = [];
    const b = browser(t, (kind, body) => {
      if (kind === 'session') return response(view);
      bodies.push(body);
      if (bodies.length === 1) {
        if (code) return response({ code }, 409);
        throw new Error('network');
      }
      return response({ ...view, version: 1, response: 'Confirmado' });
    });
    await b.idle(); b.input('Mensaje'); b.$('send-btn').click(); await b.idle();
    assert.equal(b.$('send-btn').disabled, true);
    assert.equal(b.$('retry-btn').hidden, false);
    assert.match(b.$('notice-text').textContent, /pendientes de confirmar/);
    if (!code) assert.match(b.$('notice-text').textContent, /Se interrumpió la conexión/);
    b.$('retry-btn').click(); await b.idle();
    assert.deepEqual(bodies[0], bodies[1]);
    assert.equal(b.stored().pending, null);
    assert.equal(b.stored().history.length, 2);
  });
}

test('recarga después de respuesta perdida: retiene ID aun con versión avanzada y confirma sin duplicar', async t => {
  const view = initial(); const operation_id = randomUUID(); let seen;
  const saved = { ...view, history: [], pending: { kind: 'chat', body: { ...view, operation_id, message: 'Perdido', history: [] } } };
  const b = browser(t, (kind, body) => {
    if (kind === 'session') return response({ ...view, version: 1 });
    seen = body;
    return response({ code: 'OPERATION_COMPLETED' }, 409);
  }, saved);
  await b.idle();
  assert.equal(b.stored().pending.body.operation_id, operation_id);
  assert.equal(b.$('user-input').value, 'Perdido');
  b.$('retry-btn').click(); await b.idle();
  assert.equal(seen.operation_id, operation_id);
  assert.equal(b.stored().version, 1);
  assert.equal(b.stored().pending, null);
  assert.equal(b.$('user-input').value, '');
  assert.match(b.$('notice-text').textContent, /se completó, pero su respuesta no pudo recuperarse/);
});

test('sincronización fallida conserva la operación incierta hasta recuperarse', async t => {
  const view = initial(); let sessionCalls = 0; let chatCalls = 0;
  const b = browser(t, kind => {
    if (kind === 'session') {
      if (++sessionCalls === 2) throw new Error('network');
      return response({ ...view, version: chatCalls ? 1 : 0 });
    }
    chatCalls++;
    return response({ code: 'OPERATION_COMPLETED' }, 409);
  });
  await b.idle(); b.input('Hola'); b.$('send-btn').click(); await b.idle();
  const id = b.stored().pending.body.operation_id;
  assert.equal(b.$('user-input').disabled, true);
  b.$('retry-btn').click(); await b.idle();
  assert.equal(b.stored().pending.body.operation_id, id);
  b.$('retry-btn').click(); await b.idle();
  assert.equal(b.stored().pending, null);
});

test('sesión recuperada sin contexto y sesión cambiada muestran aviso, no historial obsoleto', async t => {
  const b = browser(t, () => response({ ...initial(), version: 3 })); await b.idle();
  assert.equal(b.$('notice-text').textContent, 'Recuperamos el estado de ALIVE. Puedes continuar desde aquí');
  const saved = { ...initial(), history: [{ role: 'user', parts: [{ text: 'Obsoleto' }] }, { role: 'model', parts: [{ text: 'Anterior' }] }], pending: null };
  const c = browser(t, () => response(initial()), saved); await c.idle();
  assert.doesNotMatch(c.$('chat-feed').textContent, /Obsoleto/);
});

test('fallo de inicialización: reintento contextual y recuperación sin recargar', async t => {
  let fail = true;
  const b = browser(t, () => { if (fail) throw new Error('network'); return response(initial()); });
  await b.idle();
  assert.equal(b.$('user-input').disabled, true);
  assert.equal(b.$('retry-btn').hidden, false);
  fail = false; b.$('retry-btn').click(); await b.idle();
  assert.equal(b.$('user-input').disabled, false);
  assert.equal(b.$('operation-notice').hidden, true);
});

test('menú estable, cancelación y confirmación de nueva sesión; devolución del foco', async t => {
  const service = normal(); const b = browser(t, service.handler); await b.idle();
  b.input('Antes'); b.$('send-btn').click(); await b.idle();
  const old = b.stored();
  b.$('options-btn').click(); b.$('reset-btn').click();
  assert.equal(b.$('reset-dialog').open, true);
  assert.equal(b.win.document.activeElement.id, 'cancel-reset');
  b.$('cancel-reset').dispatchEvent(new b.win.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
  assert.equal(b.win.document.activeElement.id, 'confirm-reset');
  b.$('confirm-reset').dispatchEvent(new b.win.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  assert.equal(b.win.document.activeElement.id, 'cancel-reset');
  assert.equal(service.calls.filter(x => x.kind === 'reset').length, 0);
  b.$('cancel-reset').click();
  assert.equal(b.win.document.activeElement.id, 'options-btn');
  assert.equal(b.stored().session_id, old.session_id);
  b.$('options-btn').click(); b.$('reset-btn').click(); b.$('confirm-reset').click(); await b.idle();
  assert.equal(b.$('reset-dialog').open, false);
  assert.notEqual(b.stored().session_id, old.session_id);
  assert.equal(b.stored().history.length, 0);
  assert.equal(b.$('user-input').value, '');
  assert.equal(b.$('notice-text').textContent, 'Nueva sesión iniciada. ALIVE vuelve a su estado inicial');
  assert.equal(service.calls.filter(x => x.kind === 'reset').length, 1);
});

test('reinicio con respuesta perdida comprueba sesión sin repetir POST reset', async t => {
  let view = initial(); let resets = 0;
  const b = browser(t, kind => {
    if (kind === 'reset') { resets++; view = initial(); throw new Error('lost response'); }
    return response(view);
  });
  await b.idle(); b.$('options-btn').click(); b.$('reset-btn').click(); b.$('confirm-reset').click(); await b.idle();
  assert.equal(b.$('reset-dialog').open, false);
  assert.equal(b.$('user-input').disabled, true);
  assert.doesNotMatch(b.$('notice-text').textContent, /Nueva sesión iniciada/);
  b.$('retry-btn').click(); await b.idle();
  assert.equal(resets, 1);
  assert.equal(b.$('user-input').disabled, false);
});

test('slider, número, cero e historial interno conservado, sin envío al mover controles', async t => {
  const service = normal(); const b = browser(t, service.handler, undefined, { mobile: true }); await b.idle();
  assert.equal(b.$('stimulus-panel').open, false);
  b.$('pain-slider').value = '35'; b.$('pain-slider').dispatchEvent(new b.win.Event('input'));
  assert.equal(b.$('pain-number').value, '35');
  assert.equal(b.$('range-fill').style.width, '35%');
  assert.equal(service.calls.length, 1);
  for (const value of ['', '-1', '101', '1.5']) {
    b.$('pain-number').value = value; b.$('pain-number').dispatchEvent(new b.win.Event('input'));
    assert.equal(b.$('pain-btn').disabled, true, value);
  }
  b.$('pain-number').value = '35'; b.$('pain-number').dispatchEvent(new b.win.Event('input'));
  b.$('pain-btn').click(); await b.idle();
  assert.match(b.$('chat-feed').textContent, /Estímulo de dolor simulado · 35 %/);
  assert.doesNotMatch(b.$('chat-feed').textContent, /ALERTA NOCICEPTIVA|Golpe de dolor/);
  assert.equal(b.stored().history[0].parts[0].text, '[ALERTA NOCICEPTIVA: Golpe de dolor inyectado al 35%]');
  b.$('pain-number').value = '0'; b.$('pain-number').dispatchEvent(new b.win.Event('input'));
  b.$('pain-btn').click(); await b.idle();
  assert.equal(service.calls.at(-1).body.pain_percentage, 0);
  assert.equal(service.calls.at(-1).body.history[0].parts[0].text, '[ALERTA NOCICEPTIVA: Golpe de dolor inyectado al 35%]');
  assert.match(b.$('chat-feed').textContent, /Interacción sin dolor adicional · 0 %/);
  const c = browser(t, service.handler, b.stored()); await c.idle();
  assert.doesNotMatch(c.$('chat-feed').textContent, /ALERTA NOCICEPTIVA|Golpe de dolor/);
});

test('fallo de estímulo tiene aviso en su panel y no contamina el chat', async t => {
  const view = initial();
  const b = browser(t, kind => kind === 'session' ? response(view) : response({ code: 'GEMINI_UNAVAILABLE' }, 503), undefined, { mobile: true });
  await b.idle(); b.$('pain-btn').click(); await b.idle();
  assert.equal(b.$('operation-notice').parentElement.id, 'pain-notice-slot');
  assert.equal(b.$('stimulus-panel').open, true);
  assert.doesNotMatch(b.$('chat-feed').textContent, /no puede responder/);
  b.$('pain-number').value = '70';
  b.$('pain-number').dispatchEvent(new b.win.Event('input'));
  assert.equal(b.$('retry-btn').hidden, true, 'editar intensidad descarta el reintento de la selección anterior');
});

test('Markdown seguro: párrafos, listas, enlaces, código y XSS como texto inerte', async t => {
  const view = initial();
  const malicious = 'Hola **mundo**\n\n- uno\n- dos\n\n[seguro](https://example.com) [malo](javascript:alert%281%29) [datos](data:text/html,evil) [entidad](javascript&#58;alert%281%29)\n\n```html\n<img src=x onerror=alert(1)>\n```\n\n<script>window.hacked=true</script>\n<img src=x onerror="alert(1)">\n<svg onload="alert(1)"></svg>';
  const b = browser(t, kind => response({ ...view, version: kind === 'session' ? 0 : 1, response: malicious }));
  await b.idle(); b.input('<img src=x onerror=alert(1)>'); b.$('send-btn').click(); await b.idle();
  const feed = b.$('chat-feed');
  assert.equal(feed.querySelectorAll('script,img,svg,iframe').length, 0);
  assert.equal(b.win.hacked, undefined);
  assert.ok(feed.querySelector('ul li'));
  assert.ok(feed.querySelector('pre code').textContent.includes('<img'));
  assert.equal(feed.querySelector('strong').textContent, 'mundo');
  for (const a of feed.querySelectorAll('a')) {
    assert.ok(['http:', 'https:'].includes(new URL(a.href).protocol));
    assert.equal(a.rel, 'noopener noreferrer'); assert.equal(a.target, '_blank');
  }
});

test('copiar respuesta: confirmación y fallo anunciado sin error no controlado', async t => {
  const service = normal(); const b = browser(t, service.handler); await b.idle();
  b.input('Hola'); b.$('send-btn').click(); await b.idle();
  let copied;
  Object.defineProperty(b.win.navigator, 'clipboard', { configurable: true, value: { writeText: async text => { copied = text; } } });
  const copy = b.$('chat-feed').querySelector('.copy-button'); copy.click();
  await until(() => copy.textContent === 'Copiado');
  assert.match(copied, /\*\*respuesta\*\*/);
  Object.defineProperty(b.win.navigator, 'clipboard', { value: { writeText: async () => { throw new Error('blocked'); } } });
  copy.click(); await until(() => copy.textContent === 'No se pudo copiar');
  assert.match(b.$('announcement').textContent, /seleccionar el texto/);
});

test('scroll: llegada de respuesta no mueve a quien lee arriba; botón vuelve al final', async t => {
  const service = normal(); const b = browser(t, service.handler); await b.idle();
  const feed = b.$('chat-feed');
  Object.defineProperties(feed, { scrollHeight: { value: 1600, configurable: true }, clientHeight: { value: 400 } });
  feed.scrollTop = 100; feed.dispatchEvent(new b.win.Event('scroll'));
  b.input('Hola'); b.$('send-btn').click(); await b.idle();
  assert.equal(feed.scrollTop, 100);
  assert.equal(b.$('latest-btn').hidden, false);
  b.$('latest-btn').click();
  assert.equal(feed.scrollTop, 1600);
  assert.equal(b.$('latest-btn').hidden, true);
});

test('almacenamiento inaccesible no impide conversar; recursos locales y sin handlers inline', async t => {
  const service = normal(); const b = browser(t, service.handler, undefined, { storageBlocked: true }); await b.idle();
  b.input('Hola'); b.$('send-btn').click(); await b.idle();
  assert.match(b.$('chat-feed').textContent, /respuesta/);
  for (const script of b.win.document.querySelectorAll('script')) assert.ok(script.getAttribute('src') && !script.src.startsWith('https://cdn'));
  for (const element of b.win.document.querySelectorAll('*')) {
    assert.equal([...element.attributes].some(attribute => /^on/i.test(attribute.name)), false);
  }
});
