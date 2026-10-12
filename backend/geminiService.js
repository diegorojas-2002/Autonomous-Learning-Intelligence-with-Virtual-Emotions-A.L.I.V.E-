import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { EMOTIONAL_DELTA_LIMITS } from './AffectiveEngine.js';
import { buildEvaluatorInstruction, buildActorInstruction } from './prompts.js';

// Load environment variables from .env file
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

if (!process.env.GEMINI_API_KEY?.trim()) {
  throw new Error('Falta GEMINI_API_KEY. Copia .env.example a .env y configura tu propia clave.');
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 45000, retryOptions: { attempts: 1 } } });
const MODEL_NAME = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';

/**
 * NODO EVALUADOR
 */
export async function evaluateUserPrompt(userMessage, stateEngine) {
  const stimulus = {
    interaction_type: 'message',
    state: stateEngine?.getStateSummary() ?? null,
    history: stateEngine?.history ?? [],
    user_message: userMessage
  };
  return evaluateStimulus(stimulus);

}

/** Evalúa el dolor sin aplicar multiplicadores a las variables emocionales. */
export async function evaluatePainStimulus(painPercentage, stateEngine) {
  if (!Number.isFinite(painPercentage) || painPercentage < 0 || painPercentage > 100) {
    throw new Error('Intensidad de dolor inválida');
  }
  const stimulus = {
    interaction_type: 'pain',
    state: stateEngine.getStateSummary(),
    history: stateEngine.history,
    pain_percentage: painPercentage
  };
  return evaluateStimulus(stimulus, 'pain');

}

async function evaluateStimulus(stimulus, interactionType = 'message') {
  const limits = EMOTIONAL_DELTA_LIMITS[interactionType];
  const numericProperties = Object.fromEntries(Object.entries(limits).map(([key, [min, max]]) => [
    key, { type: Type.NUMBER, description: `Cambio ${key}: entre ${min} y ${max}` }
  ]));
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: JSON.stringify(stimulus),
    config: {
      systemInstruction: buildEvaluatorInstruction(interactionType),
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          ...numericProperties,
          is_calming_prompt: { type: Type.BOOLEAN, description: "true si el mensaje busca calmar o validar con empatía a la IA" },
          thought_trace: { type: Type.STRING, description: "Pensamiento: monólogo ficticio en primera persona. Justificación: efecto emocional principal. Máximo 30 palabras en total." }
        },
        required: [...Object.keys(limits), "is_calming_prompt", "thought_trace"]
      }
    }
  });

  const evaluation = JSON.parse(response.text);
  if (!evaluation || typeof evaluation.thought_trace !== 'string') {
    throw new Error('Evaluación de Gemini inválida');
  }
  return evaluation;
}

/**
 * NODO ACTOR
 */
export async function generateActorResponse(stateEngine) {
  const summary = stateEngine.getStateSummary();

  const systemInstruction = buildActorInstruction(summary);

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: stateEngine.history,
    config: {
      systemInstruction: systemInstruction
    }
  });

  if (typeof response.text !== 'string' || !response.text.trim()) {
    throw new Error('Gemini no devolvió una respuesta de texto');
  }
  return response.text;
}
