// Local, disposable review server. No environment files or production services.
import express from 'express';
import { createApp } from '../backend/app.js';
import { database } from '../tests/helpers.js';

const { store, pg } = await database();
const app = express();
// Exercise the UI under a strict same-origin policy without changing production.
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
const evaluation = { delta_valence: 0, delta_affinity: 0, delta_stress: 0,
  delta_ego: 0, delta_fatigue: 0, is_calming_prompt: false, thought_trace: 'Evaluación simulada para revisión local' };
createApp({ app, store, secureCookies: false,
  evaluateUserPrompt: async () => ({ ...evaluation }),
  evaluatePainStimulus: async () => ({ ...evaluation }),
  generateActorResponse: async agent => {
    await new Promise(resolve => setTimeout(resolve, 650));
    const pain = agent.history.at(-1)?.parts[0]?.text.startsWith('[ALERTA NOCICEPTIVA:');
    return pain
      ? 'He recibido el estímulo simulado. Podemos seguir conversando y explorar cómo cambia la interacción.\n\n*Esta respuesta pertenece a la vista previa local.*'
      : 'Hola, soy **ALIVE**. Una conversación puede empezar con algo tan sencillo como una pregunta.\n\nPodemos explorar juntos:\n\n- Cómo se representan las emociones simuladas.\n- Qué cambia después de cada interacción.\n- El papel de los estímulos en esta experiencia.\n\n¿Qué te gustaría descubrir?\n\n*Esta es una respuesta simulada para revisar la interfaz.*';
  }
});
const server = app.listen(3001, '127.0.0.1', () => console.log('Vista previa con servicios simulados: http://127.0.0.1:3001'));
async function stop() { server.close(); await pg.close(); process.exit(0); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
