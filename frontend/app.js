const API_BASE = 'http://localhost:3000/api';

// Referencias a elementos del DOM
const chatFeed = document.getElementById('chat-feed');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

const painSlider = document.getElementById('pain-slider');
const painNumber = document.getElementById('pain-number');
const painBtn = document.getElementById('pain-btn');
const resetBtn = document.getElementById('reset-btn');

let busy = false;

function setBusy(value) {
  busy = value;
  for (const control of [sendBtn, painBtn, resetBtn, userInput, painSlider, painNumber]) {
    control.disabled = value;
  }
}

function normalizePain() {
  const parsed = Number(painNumber.value);
  const value = Number.isFinite(parsed) ? Math.min(100, Math.max(0, Math.trunc(parsed))) : 0;
  painNumber.value = value;
  painSlider.value = value;
  return value;
}

painSlider.addEventListener('input', () => { painNumber.value = painSlider.value; });
painNumber.addEventListener('input', normalizePain);

async function request(path, body) {
  const response = await fetch(`${API_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Respuesta inválida del servidor (HTTP ${response.status}).`);
  }
  if (!response.ok) throw new Error(data.error || `Error del servidor (HTTP ${response.status}).`);
  if (path !== 'reset' && (typeof data.response !== 'string' || !data.response.trim())) {
    throw new Error('No se recibió respuesta del servidor.');
  }
  return data;
}

// --- Función para renderizar mensajes en el chat ---
function appendMessage(sender, text) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message');

  if (sender === 'user') {
    msgDiv.classList.add('user-message');
  } else if (sender === 'assistant') {
    msgDiv.classList.add('assistant-message');
  } else {
    msgDiv.classList.add('system-message');
  }

  msgDiv.textContent = text;
  chatFeed.appendChild(msgDiv);
  chatFeed.scrollTop = chatFeed.scrollHeight; // Auto-scroll al final
}

// --- Operaciones del agente ---
async function handleSendMessage() {
  if (busy) return;
  const message = userInput.value.trim();
  if (!message) return;
  setBusy(true);
  appendMessage('user', message);
  userInput.value = '';
  try {
    const data = await request('chat', { message });
    appendMessage('assistant', data.response);
  } catch (error) {
    userInput.value = message;
    appendMessage('system', `Error: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function handleSendPain() {
  if (busy) return;
  const painPercentage = normalizePain();
  setBusy(true);
  try {
    const data = await request('pain', { pain_percentage: painPercentage });
    appendMessage('system', `⚡ [Estímulo nociceptivo del ${painPercentage}% inyectado]`);
    appendMessage('assistant', data.response);
  } catch (error) {
    appendMessage('system', `Error: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function handleReset() {
  if (busy) return;
  setBusy(true);
  try {
    await request('reset');
    chatFeed.innerHTML = '';
    appendMessage('system', 'A.L.I.V.E. ha sido reiniciado a su estado baseline.');
  } catch (error) {
    appendMessage('system', `Error: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

// Escuchadores de eventos
sendBtn.addEventListener('click', handleSendMessage);
painBtn.addEventListener('click', handleSendPain);
resetBtn.addEventListener('click', handleReset);

userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleSendMessage();
  }
});
