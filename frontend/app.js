const API_BASE = 'http://localhost:3000/api';

// Referencias a elementos del DOM
const chatFeed = document.getElementById('chat-feed');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

const painSlider = document.getElementById('pain-slider');
const painNumber = document.getElementById('pain-number');
const painBtn = document.getElementById('pain-btn');
const resetBtn = document.getElementById('reset-btn');

// --- Sincronización Slider <-> Número de Dolor ---
painSlider.addEventListener('input', (e) => {
  painNumber.value = e.target.value;
});

painNumber.addEventListener('input', (e) => {
  let val = parseInt(e.target.value) || 0;
  if (val < 0) val = 0;
  if (val > 100) val = 100;
  painSlider.value = val;
});

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

// --- Evento: Enviar Mensaje de Texto ---
async function handleSendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  appendMessage('user', message);
  userInput.value = '';

  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const data = await response.json();

    if (data.response) {
      appendMessage('assistant', data.response);
    } else {
      appendMessage('system', 'Error: No se recibió respuesta del servidor.');
    }
  } catch (error) {
    console.error('Error enviando mensaje:', error);
    appendMessage('system', 'Error de conexión con el backend.');
  }
}

// --- Evento: Inyectar Dolor ---
async function handleSendPain() {
  const painPercentage = parseInt(painNumber.value) || 0;

  appendMessage('system', `⚡ [Estímulo nociceptivo del ${painPercentage}% inyectado]`);

  try {
    const response = await fetch(`${API_BASE}/pain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pain_percentage: painPercentage })
    });

    const data = await response.json();

    if (data.response) {
      appendMessage('assistant', data.response);
    }
  } catch (error) {
    console.error('Error inyectando dolor:', error);
    appendMessage('system', 'Error de conexión con el backend.');
  }
}

// --- Evento: Reiniciar Agente ---
async function handleReset() {
  try {
    await fetch(`${API_BASE}/reset`, { method: 'POST' });
    chatFeed.innerHTML = '';
    appendMessage('system', 'A.L.I.V.E. ha sido reiniciado a su estado baseline.');
  } catch (error) {
    console.error('Error al reiniciar:', error);
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