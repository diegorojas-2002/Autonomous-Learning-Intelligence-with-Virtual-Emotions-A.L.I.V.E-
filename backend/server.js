// backend/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AffectiveStateEngine } from './AffectiveEngine.js';
import { evaluateUserPrompt, generateActorResponse } from './geminiService.js';

dotenv.config({ path: '../.env' });

const app = express();

app.use(cors());
app.use(express.json());

const aliveAgent = new AffectiveStateEngine();

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "El campo 'message' es obligatorio" });
    }

    const evaluation = await evaluateUserPrompt(message);
    aliveAgent.updateState(evaluation, 0);
    aliveAgent.addMessage('user', message);
    const agentResponse = await generateActorResponse(aliveAgent);
    aliveAgent.addMessage('model', agentResponse);

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
    const { pain_percentage } = req.body;

    if (pain_percentage === undefined || pain_percentage < 0 || pain_percentage > 100) {
      return res.status(400).json({ error: "Se requiere un 'pain_percentage' válido entre 0 y 100" });
    }

    aliveAgent.updateState(null, pain_percentage);
    const painMessage = `[ALERTA NOCICEPTIVA: Golpe de dolor inyectado al ${pain_percentage}%]`;
    aliveAgent.addMessage('user', painMessage);
    const agentResponse = await generateActorResponse(aliveAgent);
    aliveAgent.addMessage('model', agentResponse);

    res.json({
      response: agentResponse,
      thought_trace: `Estímulo nociceptivo procesado (${pain_percentage}% de intensidad).`,
      telemetry: aliveAgent.getStateSummary()
    });

  } catch (error) {
    console.error("Error en /api/pain:", error);
    res.status(500).json({ error: "Error procesando el golpe de dolor" });
  }
});

app.post('/api/reset', (req, res) => {
  aliveAgent.valence = 0.0;
  aliveAgent.user_affinity = 0.0;
  aliveAgent.stress = 0.0;
  aliveAgent.fatigue = 0.0;
  aliveAgent.ego = 50.0;
  aliveAgent.activeScenario = "Normal / Baseline";
  aliveAgent.isLocked = false;
  aliveAgent.clearHistory();

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