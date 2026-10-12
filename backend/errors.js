export class AppError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}

export function publicError(error) {
  if (error instanceof AppError) return error;
  const status = Number(error?.status ?? error?.code ?? error?.error?.code);
  if (status === 429) return new AppError(429, 'GEMINI_RATE_LIMITED',
    'Se alcanzó el límite de solicitudes disponible en Gemini. Intenta nuevamente más tarde.');
  if (status === 503) return new AppError(503, 'GEMINI_UNAVAILABLE',
    'Gemini está temporalmente sobrecargado o no disponible. Intenta nuevamente en unos momentos.');
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError' || status === 504) {
    return new AppError(504, 'GEMINI_TIMEOUT', 'Gemini tardó demasiado en responder. Intenta nuevamente.');
  }
  return new AppError(500, 'INTERNAL_ERROR', 'No se pudo completar la operación. Intenta nuevamente.');
}
