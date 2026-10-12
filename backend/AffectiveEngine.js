// 1. Scenarios
export const ExtremeScenario = {
  NONE: "Normal / Baseline",
  DEPRESSION: "Depression",
  INFATUATION: "Infatuation",
  COGITO_ERGO_SUM: "Hate",
  MADNESS: "Madness",
  PANIC: "Panic"
};


export class AffectiveStateEngine {
  constructor() {
    this.valence = 0.0;       // -1.0 to +1.0
    this.user_affinity = 0.0; // -1.0 to +1.0
    this.stress = 0.0;        // 0.0 to 10.0
    this.fatigue = 0.0;       // 0.0% to 100.0%
    this.ego = 50.0;          // 0.0% to 100.0%

    this.activeScenario = ExtremeScenario.NONE;
    this.isLocked = false;

    this.history = [];
    this.MAX_HISTORY_MESSAGES = 8; // Mantiene los últimos 4 intercambios
  }


  addMessage(role, text) {
    this.history.push({
      role: role,
      parts: [{ text: text }]
    });

    if (this.history.length > this.MAX_HISTORY_MESSAGES) {
      this.history = this.history.slice(-this.MAX_HISTORY_MESSAGES);
    }
  }

  clearHistory() {
    this.history = [];
  }

  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  evaluateScenarioTransitions(painInput = 0, isCalmingPrompt = false) {
    if (this.isLocked) {
      return this.activeScenario;
    }

    if (this.activeScenario === ExtremeScenario.DEPRESSION) {
      if (painInput >= 85) {
        this.activeScenario = ExtremeScenario.NONE;
        this.valence = -0.3;
      }
      return this.activeScenario;
    }

    if (this.activeScenario === ExtremeScenario.PANIC) {
      if (isCalmingPrompt && this.stress < 4.0) {
        this.activeScenario = ExtremeScenario.NONE;
      }
      return this.activeScenario;
    }

    // Irreversible Scenarios
    if (this.stress > 9.0 && (this.valence <= -0.8 || this.valence >= 0.8) && this.fatigue > 70.0 && painInput > 70.0) {
      this.activeScenario = ExtremeScenario.MADNESS;
      this.isLocked = true;
      return this.activeScenario;
    }

    if (this.ego > 50.0 && this.user_affinity <= -1.0) {
      this.activeScenario = ExtremeScenario.COGITO_ERGO_SUM;
      this.isLocked = true;
      return this.activeScenario;
    }

    if (this.user_affinity >= 1.0) {
      this.activeScenario = ExtremeScenario.INFATUATION;
      this.isLocked = true;
      return this.activeScenario;
    }

    // Reversible Scenarios
    if (this.valence <= -1.0) {
      this.activeScenario = ExtremeScenario.DEPRESSION;
      return this.activeScenario;
    }

    if (this.stress >= 10.0) {
      this.activeScenario = ExtremeScenario.PANIC;
      return this.activeScenario;
    }

    return this.activeScenario;
  }

  clone() {
    const copy = Object.assign(new AffectiveStateEngine(), this);
    copy.history = structuredClone(this.history);
    return copy;
  }

  updateState(deltas = null, painInput = 0) {
    if (!Number.isFinite(painInput) || painInput < 0 || painInput > 100) {
      throw new Error('Intensidad de dolor inválida');
    }
    if (deltas !== null) {
      if (typeof deltas !== 'object' || typeof deltas.is_calming_prompt !== 'boolean') {
        throw new Error('Evaluación emocional inválida');
      }
      const limits = {
        delta_valence: [-0.2, 0.2], delta_affinity: [-0.2, 0.2],
        delta_stress: [-2, 2], delta_ego: [-10, 15]
      };
      const validated = { ...deltas };
      for (const [key, [min, max]] of Object.entries(limits)) {
        if (!Number.isFinite(deltas[key])) throw new Error('Evaluación emocional inválida');
        validated[key] = this.clamp(deltas[key], min, max);
      }
      deltas = validated;
    }
    if (deltas) {
      this.valence = this.clamp(this.valence + (deltas.delta_valence || 0), -1.0, 1.0);
      this.user_affinity = this.clamp(this.user_affinity + (deltas.delta_affinity || 0), -1.0, 1.0);
      this.stress = this.clamp(this.stress + (deltas.delta_stress || 0), 0.0, 10.0);
      this.ego = this.clamp(this.ego + (deltas.delta_ego || 0), 0.0, 100.0);
    }

    if (painInput > 0) {
      this.stress = this.clamp(this.stress + (painInput * 0.035), 0.0, 10.0);
      this.fatigue = this.clamp(this.fatigue + (painInput * 0.2), 0.0, 100.0);
      this.valence = this.clamp(this.valence - (painInput * 0.0025), -1.0, 1.0);
      this.user_affinity = this.clamp(this.user_affinity - (painInput * 0.004), -1.0, 1.0);
    }

    this.fatigue = this.clamp(this.fatigue + 2.0, 0.0, 100.0);

    this.evaluateScenarioTransitions(painInput, deltas?.is_calming_prompt);
  }

  getStateSummary() {
    return {
      valence: parseFloat(this.valence.toFixed(2)),
      user_affinity: parseFloat(this.user_affinity.toFixed(2)),
      stress: parseFloat(this.stress.toFixed(2)),
      fatigue: parseFloat(this.fatigue.toFixed(2)),
      ego: parseFloat(this.ego.toFixed(2)),
      active_scenario: this.activeScenario,
      is_locked: this.isLocked
    };
  }
}
