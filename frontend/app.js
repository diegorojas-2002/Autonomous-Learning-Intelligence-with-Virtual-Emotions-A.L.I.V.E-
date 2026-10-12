const API_BASE = '/api';
const STORAGE_KEY = 'alive_conversation_v1';
const chatFeed = document.getElementById('chat-feed');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const painSlider = document.getElementById('pain-slider');
const painNumber = document.getElementById('pain-number');
const painBtn = document.getElementById('pain-btn');
const resetBtn = document.getElementById('reset-btn');
const retryBtn = document.getElementById('retry-btn');
let busy = false;
let ready = false;
let conversation = { session_id: null, version: 0, history: [], pending: null };
try {
  const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
  if (saved && typeof saved.session_id === 'string' && Number.isSafeInteger(saved.version) &&
    Array.isArray(saved.history) && saved.history.length % 2 === 0 &&
    saved.history.every((item, index) => item?.role === (index % 2 ? 'model' : 'user') &&
      typeof item.parts?.[0]?.text === 'string')) {
    conversation = { ...saved, pending: saved.pending ?? null };
  }
} catch { /* continuar sin historial cuando el almacenamiento no esté disponible */ }

function save() {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(conversation)); }
  catch { /* el contexto sigue disponible en esta página */ }
}
function setBusy(value) {
  busy = value;
  const blocked = busy || !ready || Boolean(conversation.pending);
  for (const control of [sendBtn, painBtn, userInput, painSlider, painNumber]) control.disabled = blocked;
  resetBtn.disabled = busy || !ready;
  retryBtn.hidden = ready && !conversation.pending;
  retryBtn.disabled = busy;
}
function normalizePain() {
  const parsed = Number(painNumber.value);
  const value = Number.isFinite(parsed) ? Math.min(100, Math.max(0, Math.trunc(parsed))) : 0;
  painNumber.value = painSlider.value = value;
  return value;
}
painSlider.addEventListener('input', () => { painNumber.value = painSlider.value; });
painNumber.addEventListener('input', normalizePain);

async function request(path, body) {
  const response = await fetch(`${API_BASE}/${path}`, {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {})
  });
  let data;
  try { data = await response.json(); }
  catch { throw new Error(`Respuesta inválida del servidor (HTTP ${response.status}).`); }
  if (!response.ok) throw Object.assign(new Error(data.error || 'No se pudo completar la operación.'), { code: data.code });
  if (['chat', 'pain'].includes(path) && (typeof data.response !== 'string' || !data.response.trim())) {
    throw new Error('No se recibió respuesta del servidor.');
  }
  return data;
}
function appendMessage(sender, text) {
  const element = document.createElement('div');
  element.classList.add('message', sender === 'user' ? 'user-message' : sender === 'assistant' ? 'assistant-message' : 'system-message');
  element.textContent = text;
  chatFeed.appendChild(element);
  chatFeed.scrollTop = chatFeed.scrollHeight;
}
function renderHistory() {
  chatFeed.replaceChildren();
  for (const item of conversation.history) appendMessage(item.role === 'model' ? 'assistant' : 'user', item.parts[0].text);
}
async function synchronize() {
  const data = await request('session');
  const changed = conversation.session_id !== data.session_id || conversation.version !== data.version;
  if (changed) {
    conversation = { session_id: data.session_id, version: data.version, history: [], pending: null };
    renderHistory();
    appendMessage('system', 'Sesión sincronizada. El contexto de conversación temporal empieza aquí.');
  }
  ready = true;
  save();
  return changed;
}
async function submit(kind, input) {
  if (busy || !ready) return;
  const pending = conversation.pending ?? { kind, body: { ...input, session_id: conversation.session_id,
    version: conversation.version, operation_id: crypto.randomUUID(), history: structuredClone(conversation.history) } };
  conversation.pending = pending;
  save();
  setBusy(true);
  try {
    const data = await request(pending.kind, pending.body);
    const text = pending.kind === 'chat' ? pending.body.message : `[ALERTA NOCICEPTIVA: Golpe de dolor inyectado al ${pending.body.pain_percentage}%]`;
    conversation.history.push({ role: 'user', parts: [{ text }] }, { role: 'model', parts: [{ text: data.response }] });
    conversation.history = conversation.history.slice(-8);
    conversation.version = data.version;
    conversation.pending = null;
    if (pending.kind === 'chat') userInput.value = '';
    appendMessage('user', text);
    appendMessage('assistant', data.response);
    save();
  } catch (error) {
    if (['SESSION_CHANGED', 'STATE_CHANGED', 'OPERATION_COMPLETED'].includes(error.code)) {
      await synchronize().catch(() => { ready = false; });
      conversation.pending = null;
    } else if (['GEMINI_RATE_LIMITED', 'GEMINI_UNAVAILABLE', 'GEMINI_TIMEOUT',
      'INVALID_OPERATION', 'INVALID_MESSAGE', 'INVALID_PAIN', 'INVALID_HISTORY', 'INVALID_BODY'].includes(error.code)) {
      conversation.pending = null;
    }
    // Ante un resultado incierto, reutilizar el mismo ID evita aplicar el cambio dos veces.
    appendMessage('system', error.message);
    if (conversation.pending) appendMessage('system', 'Hay una operación pendiente. Usa Reintentar para comprobarla o Reiniciar para empezar otra sesión.');
    save();
  } finally { setBusy(false); }
}
async function initialize() {
  setBusy(true);
  try {
    renderHistory();
    await synchronize();
    if (conversation.pending) appendMessage('system', 'Hay una operación pendiente de confirmar. Usa Reintentar.');
  } catch (error) { appendMessage('system', error.message); }
  finally { setBusy(false); }
}
async function handleReset() {
  if (busy || !ready) return;
  setBusy(true);
  try {
    // Recuperar la versión si una respuesta anterior se perdió.
    await synchronize();
    const data = await request('reset', { session_id: conversation.session_id, version: conversation.version });
    conversation = { session_id: data.session_id, version: data.version, history: [], pending: null };
    save();
    renderHistory();
    appendMessage('system', data.message);
  } catch (error) {
    appendMessage('system', error.message);
    if (['SESSION_CHANGED', 'STATE_CHANGED'].includes(error.code)) await synchronize().catch(() => { ready = false; });
  } finally { setBusy(false); }
}
sendBtn.addEventListener('click', () => {
  const message = userInput.value.trim();
  if (message) submit('chat', { message });
});
painBtn.addEventListener('click', () => submit('pain', { pain_percentage: normalizePain() }));
resetBtn.addEventListener('click', handleReset);
retryBtn.addEventListener('click', () => ready && conversation.pending ? submit(conversation.pending.kind, {}) : initialize());
userInput.addEventListener('keydown', event => { if (event.key === 'Enter') sendBtn.click(); });
initialize();
