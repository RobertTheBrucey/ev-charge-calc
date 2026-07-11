import { kwFromVoltageCurrent, currentFromVoltageKw } from './calc.js';

/**
 * Wires up the bidirectional Battery Voltage / Charger Current / Charger Rate (kW)
 * relationship. The last field the user directly edited (kW or current) is treated
 * as the source of truth when Voltage subsequently changes.
 */
export function createAdvancedController({ voltageInput, currentInput, chargerRateInput, onChange }) {
  let lastEditedField = 'kw';

  function voltage() {
    const v = Number(voltageInput.value);
    return Number.isFinite(v) && v > 0 ? v : NaN;
  }

  function recomputeFromCurrent() {
    const current = Number(currentInput.value);
    if (!Number.isFinite(current)) return;
    const kw = kwFromVoltageCurrent(voltage(), current);
    if (Number.isFinite(kw)) {
      chargerRateInput.value = Math.round(kw * 100) / 100;
    }
  }

  function recomputeFromKw() {
    const kw = Number(chargerRateInput.value);
    if (!Number.isFinite(kw)) return;
    const current = currentFromVoltageKw(voltage(), kw);
    if (Number.isFinite(current)) {
      currentInput.value = Math.round(current * 100) / 100;
    }
  }

  currentInput.addEventListener('input', () => {
    lastEditedField = 'current';
    recomputeFromCurrent();
    onChange();
  });

  chargerRateInput.addEventListener('input', () => {
    lastEditedField = 'kw';
    recomputeFromKw();
    onChange();
  });

  voltageInput.addEventListener('input', () => {
    if (lastEditedField === 'current') {
      recomputeFromCurrent();
    } else {
      recomputeFromKw();
    }
    onChange();
  });

  return {
    setLastEditedField(field) {
      lastEditedField = field;
    },
  };
}
