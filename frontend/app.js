const API_BASE = '/api';
const STORAGE_KEY = 'alive_conversation_v1';
const $ = id => document.getElementById(id);
const chatFeed = $('chat-feed');
const userInput = $('user-input');
const sendBtn = $('send-btn');
const painSlider = $('pain-slider');
const painNumber = $('pain-number');
const painBtn = $('pain-btn');
const resetBtn = $('reset-btn');
const retryBtn = $('retry-btn');
const notice = $('operation-notice');
const resetDialog = $('reset-dialog');
const stimulusPanel = $('stimulus-panel');
const mobile = window.matchMedia('(max-width: 760px)');
let busy = false;
let ready = false;
let composing = false;
let followLatest = true;
let retryAction = null;
let activeKind = null;
let conversation = { session_id: null, version: 0, history: [], pending: null };
try {
  const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
  if (saved && typeof saved.session_id === 'string' && Number.isSafeInteger(saved.version) &&
    Array.isArray(saved.history) && saved.history.length % 2 === 0 &&
    saved.history.every((item, index) => item?.role === (index % 2 ? 'model' : 'user') &&
      typeof item.parts?.[0]?.text === 'string')) {
    conversation = { ...saved, pending: saved.pending ?? null };
    userInput.value = typeof saved.draft === 'string' ? saved.draft : saved.pending?.kind === 'chat' ? saved.pending.body.message : '';
  }
} catch { /* El contexto continúa en memoria si el navegador bloquea el almacenamiento. */ }

function save() {
  conversation.draft = userInput.value;
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(conversation)); }
  catch { /* El contexto sigue disponible en esta página. */ }
}
function updateControls() {
  const blocked = busy || !ready || Boolean(conversation.pending) || Boolean(conversation.resetPending);
  for (const control of [painBtn, userInput, painSlider, painNumber]) control.disabled = blocked;
  painBtn.disabled = blocked || !validPain();
  sendBtn.disabled = blocked || composing || !userInput.value.trim();
  resetBtn.disabled = busy || !ready;
  $('confirm-reset').disabled = busy || !ready;
  $('cancel-reset').disabled = busy;
  retryBtn.hidden = !retryAction;
  retryBtn.disabled = busy;
  for (const suggestion of chatFeed.querySelectorAll('[data-suggestion]')) suggestion.disabled = blocked;
  $('session-status').textContent = busy ? (ready ? 'Interacción en curso' : 'Preparando sesión…') :
    !ready ? 'Conexión por confirmar' : conversation.pending ? 'Interacción por confirmar' : 'Sesión preparada';
  $('activity').hidden = !busy || !['chat', 'pain'].includes(activeKind);
  $('activity').textContent = activeKind === 'pain' ? 'Aplicando estímulo…' : 'ALIVE está respondiendo…';
  painBtn.querySelector('span').textContent = busy && activeKind === 'pain' ? 'Aplicando estímulo…' : 'Aplicar estímulo';
  chatFeed.setAttribute('aria-busy', String(busy));
}
function setBusy(value, kind = null) { busy = value; activeKind = kind; updateControls(); }
function resizeInput() {
  userInput.style.height = 'auto';
  userInput.style.height = `${Math.min(userInput.scrollHeight, 160)}px`;
}
function validPain() {
  return painNumber.value !== '' && Number.isInteger(Number(painNumber.value)) && Number(painNumber.value) >= 0 && Number(painNumber.value) <= 100;
}
function paintPain(value) {
  painSlider.value = value;
  $('range-fill').style.width = `${value}%`;
  painSlider.setAttribute('aria-valuetext', `${value} por ciento`);
}
function normalizePain() {
  const number = Number(painNumber.value);
  const value = Number.isFinite(number) ? Math.min(100, Math.max(0, Math.trunc(number))) : 0;
  painNumber.value = value;
  paintPain(value);
  updateControls();
  return value;
}
function clearEditedRetry(kind) {
  if (!conversation.pending && retryAction && ready && notice.parentElement.id === `${kind}-notice-slot`) clearNotice();
}
painSlider.addEventListener('input', () => { painNumber.value = painSlider.value; paintPain(painSlider.value); updateControls(); clearEditedRetry('pain'); });
painNumber.addEventListener('input', () => { if (validPain()) paintPain(Number(painNumber.value)); updateControls(); clearEditedRetry('pain'); });
painNumber.addEventListener('change', normalizePain);

function clearNotice() { notice.hidden = true; retryAction = null; retryBtn.hidden = true; }
function showNotice(text, kind = 'chat', action = null) {
  const slot = kind === 'reset' && resetDialog.open ? $('reset-notice-slot') : kind === 'pain' ? $('pain-notice-slot') : $('chat-notice-slot');
  slot.append(notice);
  notice.hidden = false;
  $('notice-text').textContent = text;
  retryAction = action;
  retryBtn.hidden = !action;
  if (kind === 'pain') stimulusPanel.open = true;
}
function errorText(error) {
  const messages = {
    GEMINI_UNAVAILABLE: 'ALIVE no puede responder en este momento. Inténtalo de nuevo en unos momentos',
    GEMINI_RATE_LIMITED: 'El servicio alcanzó su límite temporal de solicitudes. Inténtalo más tarde',
    GEMINI_TIMEOUT: 'ALIVE tardó demasiado en responder. Inténtalo de nuevo en unos momentos',
    SESSION_BUSY: 'Estamos pendientes de confirmar tu última interacción',
    INVALID_MESSAGE: 'Escribe un mensaje antes de enviarlo.',
    INVALID_PAIN: 'Selecciona una intensidad válida entre 0 y 100.',
    INVALID_HISTORY: 'No pudimos validar el contexto de esta conversación. Inicia una nueva sesión desde el menú.',
    INVALID_OPERATION: 'No pudimos validar esta interacción. Comprueba la sesión antes de continuar.',
    INVALID_BODY: 'No pudimos leer esta interacción. Revisa el mensaje e inténtalo de nuevo.',
    INVALID_ORIGIN: 'No se pudo verificar el origen de la solicitud. Abre ALIVE desde su dirección original.',
    INTERNAL_ERROR: 'No pudimos confirmar el resultado. Comprueba tu última interacción antes de continuar.'
  };
  return messages[error.code] ?? 'Se interrumpió la conexión. Comprueba el resultado antes de continuar';
}
async function request(path, body) {
  const response = await fetch(`${API_BASE}/${path}`, {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {})
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('Invalid response'); }
  if (!response.ok) throw Object.assign(new Error('Request failed'), { code: data.code });
  if (typeof data.session_id !== 'string' || !Number.isSafeInteger(data.version) || data.version < 0 ||
    (['chat', 'pain'].includes(path) && (typeof data.response !== 'string' || !data.response.trim()))) {
    throw new Error('Invalid response');
  }
  return data;
}
function nearBottom() { return chatFeed.scrollHeight - chatFeed.clientHeight - chatFeed.scrollTop < 70; }
function updateScroll() { followLatest = nearBottom(); $('latest-btn').hidden = followLatest; }
function scrollLatest() { chatFeed.scrollTop = chatFeed.querySelector('.welcome') ? 0 : chatFeed.scrollHeight; followLatest = true; $('latest-btn').hidden = true; }
chatFeed.addEventListener('scroll', updateScroll, { passive: true });
$('latest-btn').addEventListener('click', scrollLatest);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => {
  if (followLatest) scrollLatest(); else $('latest-btn').hidden = nearBottom();
}).observe(chatFeed);
function appendMessage(sender, text) {
  const shouldScroll = followLatest;
  chatFeed.querySelector('.welcome')?.remove();
  const element = document.createElement('article');
  element.className = `message ${sender === 'user' ? 'user-message' : sender === 'assistant' ? 'assistant-message' : 'system-message'}`;
  // Exact legacy stimulus format is preserved in history and API payloads.
  const stimulus = sender === 'user' && /^\[ALERTA NOCICEPTIVA: Golpe de dolor inyectado al (\d+(?:\.\d+)?)%\]$/.exec(text);
  if (stimulus) {
    element.className = 'message system-message stimulus-event';
    element.textContent = Number(stimulus[1]) === 0 ? 'Interacción sin dolor adicional · 0 %' : `Estímulo de dolor simulado · ${stimulus[1]} %`;
  } else if (sender === 'system') element.textContent = text;
  else {
    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = sender === 'user' ? 'TÚ' : 'ALIVE';
    const content = document.createElement('div');
    content.className = 'message-content';
    if (sender === 'assistant') content.append(renderMarkdown(text));
    else content.textContent = text;
    element.append(label, content);
    if (sender === 'assistant') {
      const copy = document.createElement('button');
      copy.className = 'copy-button';
      copy.textContent = 'Copiar respuesta';
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text);
          copy.textContent = 'Copiado';
          $('announcement').textContent = 'Respuesta copiada';
        } catch {
          copy.textContent = 'No se pudo copiar';
          $('announcement').textContent = 'No se pudo copiar la respuesta. Puedes seleccionar el texto y copiarlo manualmente.';
        }
        window.setTimeout(() => { copy.textContent = 'Copiar respuesta'; }, 2500);
      });
      element.append(copy);
    }
  }
  chatFeed.append(element);
  if (shouldScroll) scrollLatest(); else $('latest-btn').hidden = nearBottom();
}
function renderHistory() {
  chatFeed.replaceChildren();
  followLatest = true;
  for (const item of conversation.history) appendMessage(item.role === 'model' ? 'assistant' : 'user', item.parts[0].text);
  if (!conversation.history.length && !conversation.pending) chatFeed.append($('welcome-template').content.cloneNode(true));
  updateControls();
}
const recoveredText = 'Recuperamos el estado de ALIVE. Puedes continuar desde aquí';
async function synchronize({ preservePending = false } = {}) {
  const data = await request('session');
  const previous = conversation;
  const changed = previous.session_id !== data.session_id || previous.version !== data.version;
  // A lost response may already have advanced the server version. Keep the exact
  // pending operation so an explicit retry can recover its confirmed outcome.
  if (changed && !(preservePending && previous.pending && previous.session_id === data.session_id)) {
    conversation = { session_id: data.session_id, version: data.version, history: [], pending: null };
    renderHistory();
    if (previous.session_id || data.version > 0) showNotice(recoveredText);
  }
  ready = true;
  save();
  return changed;
}
const definiteFailures = ['GEMINI_RATE_LIMITED', 'GEMINI_UNAVAILABLE', 'GEMINI_TIMEOUT',
  'INVALID_OPERATION', 'INVALID_MESSAGE', 'INVALID_PAIN', 'INVALID_HISTORY', 'INVALID_BODY', 'INVALID_ORIGIN'];
async function submit(kind, input, retry = false) {
  if (busy || !ready || conversation.resetPending || (conversation.pending && !retry)) return;
  const pending = conversation.pending ?? { kind, body: { ...input, session_id: conversation.session_id,
    version: conversation.version, operation_id: crypto.randomUUID(), history: structuredClone(conversation.history) } };
  conversation.pending = pending;
  save();
  clearNotice();
  setBusy(true, pending.kind);
  chatFeed.querySelector('.welcome')?.remove();
  try {
    const data = await request(pending.kind, pending.body);
    const text = pending.kind === 'chat' ? pending.body.message : `[ALERTA NOCICEPTIVA: Golpe de dolor inyectado al ${pending.body.pain_percentage}%]`;
    conversation.history.push({ role: 'user', parts: [{ text }] }, { role: 'model', parts: [{ text: data.response }] });
    conversation.history = conversation.history.slice(-8);
    conversation.version = data.version;
    conversation.pending = null;
    if (pending.kind === 'chat') { userInput.value = ''; resizeInput(); }
    appendMessage('user', text);
    appendMessage('assistant', data.response);
    save();
  } catch (error) {
    if (['SESSION_CHANGED', 'STATE_CHANGED', 'OPERATION_COMPLETED'].includes(error.code)) {
      try {
        await synchronize();
        conversation.pending = null;
        if (error.code === 'OPERATION_COMPLETED' && pending.kind === 'chat') { userInput.value = ''; resizeInput(); }
        showNotice(error.code === 'OPERATION_COMPLETED' ? `${recoveredText}. La última interacción se completó, pero su respuesta no pudo recuperarse.` : recoveredText);
      } catch {
        ready = false;
        showNotice('No pudimos sincronizar la sesión. La última interacción sigue por confirmar.', pending.kind, initialize);
      }
    } else if (definiteFailures.includes(error.code)) {
      conversation.pending = null;
      const canRetry = ['GEMINI_RATE_LIMITED', 'GEMINI_UNAVAILABLE', 'GEMINI_TIMEOUT'].includes(error.code);
      showNotice(errorText(error), pending.kind, canRetry ? () => submit(pending.kind,
        pending.kind === 'chat' ? { message: userInput.value.trim() } : { pain_percentage: pending.body.pain_percentage }) : null);
    } else {
      showNotice(errorText(error) + (error.code === 'SESSION_BUSY' ? '' : '\nEstamos pendientes de confirmar tu última interacción'), pending.kind,
        () => submit(pending.kind, {}, true));
    }
    save();
  } finally {
    setBusy(false);
    // Do not steal focus from the menu or a reader elsewhere in the page.
    if (document.activeElement === document.body && !userInput.disabled) userInput.focus({ preventScroll: true });
  }
}
async function initialize() {
  if (busy) return;
  clearNotice();
  setBusy(true);
  try {
    renderHistory();
    await synchronize({ preservePending: true });
    if (conversation.resetPending) {
      conversation.resetPending = null;
      showNotice('La sesión actual sigue activa. Puedes continuar o iniciar otra desde el menú.');
    }
    if (conversation.pending) showNotice('Estamos pendientes de confirmar tu última interacción', conversation.pending.kind,
      () => submit(conversation.pending.kind, {}, true));
    save();
  } catch (error) { ready = false; showNotice(errorText(error), 'chat', initialize); }
  finally { setBusy(false); resizeInput(); }
}
async function handleReset() {
  if (busy || !ready) return;
  clearNotice();
  setBusy(true, 'reset');
  let requested = false;
  try {
    await synchronize();
    conversation.resetPending = true;
    save();
    requested = true;
    const data = await request('reset', { session_id: conversation.session_id, version: conversation.version });
    conversation = { session_id: data.session_id, version: data.version, history: [], pending: null };
    userInput.value = '';
    painNumber.value = 0;
    normalizePain();
    save();
    renderHistory();
    resizeInput();
    resetDialog.close();
    showNotice('Nueva sesión iniciada. ALIVE vuelve a su estado inicial');
  } catch (error) {
    // Reset has no client operation_id contract: only synchronize after a lost
    // response; never automatically POST reset again.
    if (requested && !error.code) {
      ready = false;
      resetDialog.close();
      showNotice('Se interrumpió la conexión. Comprueba el resultado antes de continuar', 'chat', initialize);
    } else {
      conversation.resetPending = null;
      if (['SESSION_CHANGED', 'STATE_CHANGED'].includes(error.code)) {
        try { await synchronize(); }
        catch { ready = false; }
      }
      if (!ready) resetDialog.close();
      showNotice(errorText(error), ready ? 'reset' : 'chat', !ready ? initialize : null);
    }
    save();
  } finally { setBusy(false); }
}

$('composer').addEventListener('submit', event => {
  event.preventDefault();
  const message = userInput.value.trim();
  if (message && !composing && !sendBtn.disabled) submit('chat', { message });
});
userInput.addEventListener('input', () => { resizeInput(); updateControls(); save(); clearEditedRetry('chat'); });
userInput.addEventListener('compositionstart', () => { composing = true; updateControls(); });
userInput.addEventListener('compositionend', () => { composing = false; updateControls(); });
userInput.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !composing && event.keyCode !== 229) {
    event.preventDefault();
    if (!sendBtn.disabled) $('composer').requestSubmit();
  }
});
painBtn.addEventListener('click', () => { if (validPain()) submit('pain', { pain_percentage: normalizePain() }); });
retryBtn.addEventListener('click', () => { if (!busy) retryAction?.(); });
chatFeed.addEventListener('click', event => {
  const suggestion = event.target.closest('[data-suggestion]');
  if (!suggestion || suggestion.disabled) return;
  userInput.value = suggestion.dataset.suggestion;
  resizeInput(); updateControls(); save(); userInput.focus();
});
function closeOptions(restoreFocus = false) {
  $('options-panel').hidden = true;
  $('options-btn').setAttribute('aria-expanded', 'false');
  if (restoreFocus) $('options-btn').focus();
}
$('options-btn').addEventListener('click', () => {
  const open = $('options-panel').hidden;
  $('options-panel').hidden = !open;
  $('options-btn').setAttribute('aria-expanded', String(open));
  if (open) resetBtn.focus();
});
document.addEventListener('click', event => { if (!event.target.closest('.options')) closeOptions(); });
document.addEventListener('focusin', event => { if (!event.target.closest('.options')) closeOptions(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('options-panel').hidden) { closeOptions(true); event.preventDefault(); } });
function openDialog(dialog, opener) {
  dialog._opener = opener;
  dialog.showModal();
  dialog.querySelector('[autofocus]')?.focus();
}
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]')]
      .filter(control => !control.hidden && !control.closest('[hidden]'));
    const first = controls[0];
    const last = controls.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('close', () => {
    if (dialog.contains(notice)) $('chat-notice-slot').append(notice);
    dialog._opener?.focus({ preventScroll: true });
  });
  dialog.addEventListener('cancel', event => { if (dialog === resetDialog && busy) event.preventDefault(); });
}
resetBtn.addEventListener('click', () => { closeOptions(); openDialog(resetDialog, $('options-btn')); });
$('cancel-reset').addEventListener('click', () => resetDialog.close());
$('confirm-reset').addEventListener('click', handleReset);
$('about-btn').addEventListener('click', () => openDialog($('about-dialog'), $('about-btn')));
$('close-about').addEventListener('click', () => $('about-dialog').close());
function adaptPanel() {
  stimulusPanel.open = !mobile.matches;
  stimulusPanel.querySelector('summary').tabIndex = mobile.matches ? 0 : -1;
}
stimulusPanel.querySelector('summary').addEventListener('click', event => { if (!mobile.matches) event.preventDefault(); });
mobile.addEventListener('change', adaptPanel);
adaptPanel();
// visualViewport complements dvh on mobile engines where the keyboard overlays
// the layout viewport. Direct CSSOM properties do not require inline CSP rules.
function fitViewport() {
  if (window.visualViewport && window.visualViewport.scale === 1) {
    document.querySelector('.app-shell').style.height = `${window.visualViewport.height}px`;
  }
}
window.visualViewport?.addEventListener('resize', fitViewport);
fitViewport();
paintPain(0);
initialize();
