import test from 'node:test';
import assert from 'node:assert/strict';

process.env.GEMINI_API_KEY = 'clave-ficticia-para-pruebas';
const { evaluateUserPrompt, generateActorResponse } = await import('../backend/geminiService.js');
const { AffectiveStateEngine } = await import('../backend/AffectiveEngine.js');
const { publicError } = await import('../backend/errors.js');

test('SDK Gemini real: 429/503 y timeout llegan al manejador sin reintentos automáticos', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const agent = new AffectiveStateEngine();
  agent.addMessage('user', 'Prueba');
  for (const status of [429, 503]) {
    for (const invoke of [() => evaluateUserPrompt('Prueba'), () => generateActorResponse(agent)]) {
      let calls = 0;
      globalThis.fetch = async () => {
        calls++;
        return new Response(JSON.stringify({ error: { code: status, status: status === 429 ? 'RESOURCE_EXHAUSTED' : 'UNAVAILABLE', message: 'Error de prueba' } }),
          { status, headers: { 'Content-Type': 'application/json' } });
      };
      await assert.rejects(invoke(), error => {
        assert.equal(publicError(error).status, status, `${error.name}: ${error.message}`);
        return true;
      });
      assert.equal(calls, 1);
    }
  }
  globalThis.fetch = async () => { throw new DOMException('Tiempo agotado', 'AbortError'); };
  await assert.rejects(evaluateUserPrompt('Prueba'), error => {
    assert.equal(publicError(error).code, 'GEMINI_TIMEOUT');
    return true;
  });
});
