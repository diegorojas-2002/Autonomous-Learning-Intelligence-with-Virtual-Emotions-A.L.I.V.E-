import express from 'express';
import { createSessionStore } from './backend/database.js';
import { createApp } from './backend/app.js';
import { evaluateUserPrompt, evaluatePainStimulus, generateActorResponse } from './backend/geminiService.js';

// Entrada detectada por Vercel; el listener local vive en backend/server.js.
const app = createApp({ app: express(), store: createSessionStore(), evaluateUserPrompt, evaluatePainStimulus, generateActorResponse });
export default app;
