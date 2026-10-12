import test from 'node:test';
import assert from 'node:assert/strict';

process.env.GEMINI_API_KEY = 'clave-ficticia-para-pruebas';
const { evaluateUserPrompt, evaluatePainStimulus, generateActorResponse } = await import('../backend/geminiService.js');
const { AffectiveStateEngine } = await import('../backend/AffectiveEngine.js');
const { publicError } = await import('../backend/errors.js');

test('SDK Gemini real: 429/503 y timeout llegan al manejador sin reintentos automáticos', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const agent = new AffectiveStateEngine();
  agent.addMessage('user', 'Prueba');
  for (const status of [429, 503]) {
    for (const invoke of [() => evaluateUserPrompt('Prueba', agent), () => evaluatePainStimulus(50, agent), () => generateActorResponse(agent)]) {
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

test('SDK Gemini: evaluadores reciben estado/contexto y el actor conserva los prompts de dev', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const captures = [];
  const deltas = { delta_valence: 0.12, delta_affinity: 0.23, delta_stress: 0.75,
    delta_ego: -2, delta_fatigue: 3, is_calming_prompt: false,
    thought_trace: 'Pensamiento: Me sorprende. Justificación: cambia mi ánimo.' };
  globalThis.fetch = async (url, init) => {
    captures.push(JSON.parse(init.body));
    const text = captures.at(-1).generationConfig?.responseMimeType === 'application/json'
      ? JSON.stringify(deltas) : 'Respuesta simulada';
    return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const agent = new AffectiveStateEngine();
  agent.valence = -0.4;
  agent.stress = 5;
  agent.addMessage('user', 'Contexto de esta sesión');
  agent.addMessage('model', 'Respuesta temporal');
  assert.equal((await evaluateUserPrompt('Mensaje actual', agent)).thought_trace, deltas.thought_trace);
  let payload = captures.at(-1);
  let stimulus = JSON.parse(payload.contents[0].parts[0].text);
  assert.equal(stimulus.interaction_type, 'message');
  assert.equal(stimulus.state.valence, -0.4);
  assert.equal(stimulus.history[0].parts[0].text, 'Contexto de esta sesión');
  assert.equal(stimulus.user_message, 'Mensaje actual');
  assert.match(payload.systemInstruction.parts[0].text, /TIPO DE INTERACCIÓN: MENSAJE/);
  assert.ok(!payload.generationConfig.responseSchema.required.includes('delta_fatigue'));
  await evaluatePainStimulus(25, agent);
  payload = captures.at(-1);
  stimulus = JSON.parse(payload.contents[0].parts[0].text);
  assert.equal(stimulus.interaction_type, 'pain');
  assert.equal(stimulus.pain_percentage, 25);
  assert.equal(stimulus.state.stress, 5);
  assert.deepEqual(stimulus.history, agent.history);
  assert.match(payload.systemInstruction.parts[0].text, /TIPO DE INTERACCIÓN: DOLOR SIMULADO/);
  assert.ok(payload.generationConfig.responseSchema.required.includes('delta_fatigue'));
  const { ExtremeScenario } = await import('../backend/AffectiveEngine.js');
  const scenarios = [
    [ExtremeScenario.NONE, 'NORMAL'], [ExtremeScenario.DEPRESSION, 'DEPRESIÓN'],
    [ExtremeScenario.INFATUATION, 'ENAMORAMIENTO'], [ExtremeScenario.COGITO_ERGO_SUM, 'COGITO ERGO SUM / ODIO'],
    [ExtremeScenario.MADNESS, 'LOCURA'], [ExtremeScenario.PANIC, 'PÁNICO']
  ];
  for (const [scenario, label] of scenarios) {
    agent.activeScenario = scenario;
    assert.equal(await generateActorResponse(agent), 'Respuesta simulada');
    payload = captures.at(-1);
    assert.ok(payload.systemInstruction.parts[0].text.includes(`ESCENARIO ACTIVO: ${label}`));
    assert.deepEqual(payload.contents, agent.history);
  }
});
