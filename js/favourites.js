import { LIMITS } from './storage.js';

function makeId() {
  return `chg-${Math.random().toString(36).slice(2, 10)}`;
}

export function addFavourite(state, { name, rateKw, voltage = null, current = null }) {
  if (state.chargers.length >= LIMITS.MAX_FAVOURITES) {
    return { ok: false, reason: 'limit-reached', state };
  }
  if (!name || !Number.isFinite(rateKw) || rateKw <= 0) {
    return { ok: false, reason: 'invalid-input', state };
  }
  const charger = { id: makeId(), name, rateKw, voltage, current };
  return {
    ok: true,
    state: { ...state, chargers: [...state.chargers, charger], activeChargerId: charger.id, chargerRateKw: rateKw },
  };
}

export function deleteFavourite(state, id) {
  const chargers = state.chargers.filter((c) => c.id !== id);
  if (state.activeChargerId === id) {
    const removed = state.chargers.find((c) => c.id === id);
    return {
      ...state,
      chargers,
      activeChargerId: null,
      chargerRateKw: removed ? removed.rateKw : state.chargerRateKw,
    };
  }
  return { ...state, chargers };
}

/**
 * Selecting a favourite autofills the ad-hoc charger rate. If the favourite has a
 * stored voltage/current, those sync into Advanced too; otherwise Advanced fields
 * are left untouched.
 */
export function selectFavourite(state, id) {
  if (id === null) {
    return { ...state, activeChargerId: null };
  }
  const charger = state.chargers.find((c) => c.id === id);
  if (!charger) return state;

  const advanced = { ...state.advanced };
  if (charger.voltage !== null) advanced.voltage = charger.voltage;
  if (charger.current !== null) advanced.current = charger.current;

  return {
    ...state,
    activeChargerId: id,
    chargerRateKw: charger.rateKw,
    advanced,
  };
}
