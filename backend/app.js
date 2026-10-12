import express from 'express';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { AppError, publicError } from './errors.js';
import { isUUID, restore, snapshot, sessionView } from './sessionStore.js';

const COOKIE = 'alive_session';
function readToken(req) {
  const part = (req.headers.cookie ?? '').split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`));
  return part?.slice(COOKIE.length + 1);
}
function cookie(res, token, secure) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`);
}
function historyFrom(value) {
  if (!Array.isArray(value) || value.some((message, index) => !message ||
    message.role !== (index % 2 === 0 ? 'user' : 'model') ||
    !Array.isArray(message.parts) || message.parts.length !== 1 ||
    typeof message.parts[0]?.text !== 'string' || !message.parts[0].text.trim()) || value.length % 2 !== 0) {
    throw new AppError(400, 'INVALID_HISTORY', 'El historial de conversación es inválido.');
  }
  // Mantener el contexto ya previsto por el motor: últimos cuatro intercambios.
  return value.slice(-8).map(message => ({ role: message.role, parts: [{ text: message.parts[0].text }] }));
}
function operationFrom(body) {
  if (!isUUID(body?.operation_id) || !isUUID(body?.session_id) ||
    !Number.isSafeInteger(body?.version) || body.version < 0) {
    throw new AppError(400, 'INVALID_OPERATION', 'La operación o la sesión es inválida.');
  }
}
export function createApp({ app = express(), store, evaluateUserPrompt, evaluatePainStimulus, generateActorResponse,
  secureCookies = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL) }) {
  app.use(express.static(fileURLToPath(new URL('../frontend/', import.meta.url))));
  app.use(express.json());
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    // Peticiones de navegador exclusivamente desde el mismo origen.
    if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ code: 'INVALID_ORIGIN', error: 'Origen de petición inválido.' });
    next();
  });
  async function session(req, body) {
    const row = await store.find(readToken(req));
    if (!row || row.id !== body.session_id) throw new AppError(409, 'SESSION_CHANGED', 'La sesión cambió. Sincroniza antes de continuar.');
    return row;
  }
  app.post('/api/session', async (req, res, next) => {
    try {
      let row = await store.find(readToken(req));
      if (!row) {
        const created = await store.create();
        row = created.row;
        cookie(res, created.token, secureCookies);
      }
      res.json(sessionView(row));
    } catch (error) { next(error); }
  });
  for (const kind of ['chat', 'pain']) {
    app.post(`/api/${kind}`, async (req, res, next) => {
      let reserved;
      try {
        const body = req.body;
        operationFrom(body);
        const history = historyFrom(body.history);
        if (kind === 'chat' && (typeof body.message !== 'string' || !body.message.trim())) {
          throw new AppError(400, 'INVALID_MESSAGE', 'El mensaje es obligatorio.');
        }
        if (kind === 'pain' && (!Number.isFinite(body.pain_percentage) || body.pain_percentage < 0 || body.pain_percentage > 100)) {
          throw new AppError(400, 'INVALID_PAIN', 'La intensidad debe estar entre 0 y 100.');
        }
        const row = await session(req, body);
        reserved = await store.acquire(row, body.operation_id, body.version);
        const agent = restore(reserved.state);
        agent.history = history;
        const evaluation = kind === 'chat'
          ? await evaluateUserPrompt(body.message.trim(), agent)
          : await evaluatePainStimulus(body.pain_percentage, agent);
        agent.updateState(evaluation, kind === 'pain' ? body.pain_percentage : 0, kind === 'pain' ? 'pain' : 'message');
        const userText = kind === 'chat' ? body.message.trim() : `[ALERTA NOCICEPTIVA: Golpe de dolor inyectado al ${body.pain_percentage}%]`;
        agent.addMessage('user', userText);
        const response = await generateActorResponse(agent);
        const thought = evaluation.thought_trace;
        const saved = await store.complete(reserved, body.operation_id, snapshot(agent), thought);
        reserved = null;
        res.json({ response, thought_trace: thought, ...sessionView(saved) });
      } catch (error) {
        if (reserved) {
          try { await store.release(reserved.id, req.body.operation_id); }
          catch { console.error('La reserva expirará automáticamente.'); }
          reserved = null;
        }
        next(error);
      }
    });
  }
  app.post('/api/reset', async (req, res, next) => {
    let reserved;
    const operation = randomUUID();
    try {
      const body = req.body;
      if (!isUUID(body?.session_id) || !Number.isSafeInteger(body?.version) || body.version < 0) throw new AppError(400, 'INVALID_OPERATION', 'La sesión es inválida.');
      reserved = await store.acquire(await session(req, body), operation, body.version);
      const created = await store.reset(reserved, operation);
      reserved = null;
      cookie(res, created.token, secureCookies);
      res.json({ message: 'A.L.I.V.E. ha sido reiniciado a su estado inicial.', ...sessionView(created.row) });
    } catch (error) {
      if (reserved) {
        try { await store.release(reserved.id, operation); }
        catch { console.error('La reserva de reinicio expirará automáticamente.'); }
      }
      next(error);
    }
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const safe = error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large'
      ? new AppError(400, 'INVALID_BODY', 'La petición no tiene un formato válido.') : publicError(error);
    if (safe.status >= 500) console.error(`Operación fallida: ${safe.code}`);
    res.status(safe.status).json({ code: safe.code, error: safe.message, ...safe.details });
  });
  return app;
}
