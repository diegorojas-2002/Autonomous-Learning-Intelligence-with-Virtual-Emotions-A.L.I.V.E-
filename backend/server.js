// backend/server.js
import express from 'express';
import cors from 'cors';
import { AffectiveStateEngine } from './AffectiveEngine.js';
import { evaluateUserPrompt, evaluatePainStimulus, generateActorResponse } from './geminiService.js';


const app = express();

app.use(cors());
app.use(express.json());

let aliveAgent = new AffectiveStateEngine();
let busy = false;

// Una sola operación puede modificar el agente a la vez, incluido el reinicio.
app.use('/api', (req, res, next) => {
  if (busy) return res.status(409).json({ error: 'El agente está ocupado. Espera a que termine la operación actual.' });
  busy = true;
  res.once('finish', () => { busy = false; });
  next();
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body ?? {};

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: "El campo 'message' es obligatorio" });
    }

    const evaluation = await evaluateUserPrompt(message.trim(), aliveAgent);
    const candidate = aliveAgent.clone();
    candidate.updateState(evaluation, 0);
    candidate.addMessage('user', message.trim());
    const agentResponse = await generateActorResponse(candidate);
    candidate.addMessage('model', agentResponse);
    aliveAgent = candidate;

    res.json({
      response: agentResponse,
      thought_trace: evaluation.thought_trace,
      telemetry: aliveAgent.getStateSummary()
    });

  } catch (error) {
    console.error("Error en /api/chat:", error);
    res.status(500).json({ error: "Error procesando el mensaje en el servidor" });
  }
});

app.post('/api/pain', async (req, res) => {
  try {
    const { pain_percentage } = req.body ?? {};

    if (!Number.isFinite(pain_percentage) || pain_percentage < 0 || pain_percentage > 100) {
      return res.status(400).json({ error: "Se requiere un 'pain_percentage' válido entre 0 y 100" });
    }

    const candidate = aliveAgent.clone();
    const evaluation = await evaluatePainStimulus(pain_percentage, candidate);
    candidate.updateState(evaluation, pain_percentage, 'pain');
    const painMessage = `[ALERTA NOCICEPTIVA: Golpe de dolor inyectado al ${pain_percentage}%]`;
    candidate.addMessage('user', painMessage);
    const agentResponse = await generateActorResponse(candidate);
    candidate.addMessage('model', agentResponse);
    aliveAgent = candidate;

    res.json({
      response: agentResponse,
      thought_trace: evaluation.thought_trace,
      telemetry: aliveAgent.getStateSummary()
    });

  } catch (error) {
    console.error("Error en /api/pain:", error);
    res.status(500).json({ error: "Error procesando el golpe de dolor" });
  }
});

app.post('/api/reset', (req, res) => {
  aliveAgent = new AffectiveStateEngine();

  res.json({ 
    message: "A.L.I.V.E. ha sido reiniciado a su estado inicial. Historial de conversación borrado.", 
    telemetry: aliveAgent.getStateSummary() 
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`Servidor A.L.I.V.E. ejecutándose en http://localhost:${PORT}`);
  console.log(`=================================`);
});
