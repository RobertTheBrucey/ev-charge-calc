import { effectiveRateKw } from './calc.js';

/**
 * Computes the live simulated state-of-charge and remaining time based on
 * wall-clock elapsed time since the simulation started, so it survives
 * reloads/tab closes (deliberately not performance.now()).
 */
export function computeSimTick({ sim, batteryKwh, chargerRateKw, maxChargeKw }) {
  if (!sim || !sim.active || !sim.startIso) return null;

  const rate = effectiveRateKw(chargerRateKw, maxChargeKw);
  const elapsedHours = (Date.now() - Date.parse(sim.startIso)) / 3_600_000;

  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(elapsedHours) || !Number.isFinite(batteryKwh) || batteryKwh <= 0) {
    return { liveSocPct: sim.startSoc, remainingTimeHours: NaN, done: false };
  }

  const addedSocPct = ((rate * Math.max(0, elapsedHours)) / batteryKwh) * 100;
  const liveSocPct = Math.min(100, sim.startSoc + addedSocPct);

  const remainingPct = sim.startTarget - liveSocPct;
  const done = remainingPct <= 0;
  const remainingTimeHours = done ? 0 : (batteryKwh * remainingPct) / 100 / rate;

  return { liveSocPct, remainingTimeHours, done };
}

export function startSim(state) {
  return {
    ...state,
    sim: {
      active: true,
      startIso: new Date().toISOString(),
      startSoc: state.soc,
      startTarget: state.target,
    },
  };
}

/**
 * Stops the simulation, snapping the main SoC field to the last live estimate.
 */
export function stopSim(state, liveSocPct) {
  return {
    ...state,
    soc: Number.isFinite(liveSocPct) ? Math.round(liveSocPct * 10) / 10 : state.soc,
    sim: { active: false, startIso: null, startSoc: null, startTarget: null },
  };
}
