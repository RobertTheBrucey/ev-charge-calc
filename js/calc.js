export function effectiveRateKw(chargerRateKw, maxChargeKw) {
  if (!Number.isFinite(chargerRateKw) || chargerRateKw <= 0) return NaN;
  if (Number.isFinite(maxChargeKw) && maxChargeKw > 0) {
    return Math.min(chargerRateKw, maxChargeKw);
  }
  return chargerRateKw;
}

/**
 * @returns {{ok: true, energyNeededKwh: number, timeHours: number, finishTime: Date} | {ok: false, reason: string}}
 */
export function calculateChargeTime({ batteryKwh, soc, target, chargerRateKw, maxChargeKw }) {
  if (![batteryKwh, soc, target, chargerRateKw].every(Number.isFinite) || batteryKwh <= 0) {
    return { ok: false, reason: 'invalid-input' };
  }

  const energyNeededKwh = (batteryKwh * (target - soc)) / 100;
  if (energyNeededKwh <= 0) {
    return { ok: false, reason: 'target-not-above-current' };
  }

  const rate = effectiveRateKw(chargerRateKw, maxChargeKw);
  if (!Number.isFinite(rate) || rate <= 0) {
    return { ok: false, reason: 'invalid-rate' };
  }

  const timeHours = energyNeededKwh / rate;
  const finishTime = new Date(Date.now() + timeHours * 3600 * 1000);

  return { ok: true, energyNeededKwh, timeHours, finishTime, effectiveRateKw: rate };
}

export function kwFromVoltageCurrent(voltage, current) {
  if (!Number.isFinite(voltage) || !Number.isFinite(current)) return NaN;
  return (voltage * current) / 1000;
}

export function currentFromVoltageKw(voltage, kw) {
  if (!Number.isFinite(voltage) || voltage <= 0 || !Number.isFinite(kw)) return NaN;
  return (kw * 1000) / voltage;
}
