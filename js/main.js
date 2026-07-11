import { loadState, saveState, clearState } from './storage.js';
import { calculateChargeTime } from './calc.js';
import { formatChargeDuration, formatClockTime } from './format.js';
import { createAdvancedController } from './advanced.js';
import { addFavourite, deleteFavourite, selectFavourite } from './favourites.js';
import { loadVehicles, vehicleLabel, applyVehicle } from './vehicles.js';
import { computeSimTick, startSim, stopSim } from './simulate.js';

let state = loadState();
let simTimer = null;
let vehiclesById = new Map();

const el = {
  batteryKwh: document.getElementById('battery-kwh'),
  soc: document.getElementById('soc'),
  chargerRate: document.getElementById('charger-rate'),
  target: document.getElementById('target'),

  resultText: document.getElementById('result-text'),
  resultFinish: document.getElementById('result-finish'),

  favouriteSelect: document.getElementById('favourite-select'),
  newChargerName: document.getElementById('new-charger-name'),
  addFavouriteBtn: document.getElementById('add-favourite-btn'),
  deleteFavouriteBtn: document.getElementById('delete-favourite-btn'),
  favouriteMessage: document.getElementById('favourite-message'),

  simStartBtn: document.getElementById('sim-start-btn'),
  simStopBtn: document.getElementById('sim-stop-btn'),
  simStatus: document.getElementById('sim-status'),

  advVoltage: document.getElementById('adv-voltage'),
  advCurrent: document.getElementById('adv-current'),
  advMaxCharge: document.getElementById('adv-max-charge'),

  vehicleSearch: document.getElementById('vehicle-search'),
  vehicleList: document.getElementById('vehicle-list'),

  clearCookieBtn: document.getElementById('clear-cookie-btn'),
};

function persist({ immediate = false } = {}) {
  const result = saveState(state, { immediate });
  if (result && result.ok === false) {
    el.favouriteMessage.textContent = result.error;
  }
}

function renderForm() {
  el.batteryKwh.value = state.batteryKwh;
  el.soc.value = state.soc;
  el.chargerRate.value = state.chargerRateKw;
  el.target.value = state.target;
  el.advVoltage.value = state.advanced.voltage;
  el.advCurrent.value = state.advanced.current ?? '';
  el.advMaxCharge.value = state.advanced.maxChargeKw ?? '';
}

function renderFavourites() {
  el.favouriteSelect.innerHTML = '';
  const customOption = document.createElement('option');
  customOption.value = '';
  customOption.textContent = 'Custom (use Charger Rate above)';
  el.favouriteSelect.appendChild(customOption);

  for (const charger of state.chargers) {
    const opt = document.createElement('option');
    opt.value = charger.id;
    opt.textContent = `${charger.name} (${charger.rateKw} kW)`;
    el.favouriteSelect.appendChild(opt);
  }
  el.favouriteSelect.value = state.activeChargerId ?? '';
  el.deleteFavouriteBtn.disabled = !state.activeChargerId;
  el.chargerRate.readOnly = Boolean(state.activeChargerId);
}

function currentInputs() {
  return {
    batteryKwh: Number(el.batteryKwh.value),
    soc: Number(el.soc.value),
    target: Number(el.target.value),
    chargerRateKw: Number(el.chargerRate.value),
    maxChargeKw: el.advMaxCharge.value === '' ? NaN : Number(el.advMaxCharge.value),
  };
}

function renderResult() {
  const inputs = currentInputs();
  const result = calculateChargeTime(inputs);

  if (!result.ok) {
    el.resultText.textContent =
      result.reason === 'target-not-above-current'
        ? 'Target is at or below current charge — nothing to calculate.'
        : 'Enter valid battery capacity, charge levels, and charger rate.';
    el.resultFinish.textContent = '';
    el.simStartBtn.disabled = true;
    return;
  }

  el.resultText.textContent = `Charging will take about ${formatChargeDuration(result.timeHours)}.`;
  el.resultFinish.textContent = `Estimated finish: ${formatClockTime(result.finishTime)}`;
  el.simStartBtn.disabled = state.sim.active;
}

function syncStateFromForm() {
  state = {
    ...state,
    batteryKwh: Number(el.batteryKwh.value),
    soc: Math.min(100, Math.max(0, Number(el.soc.value))),
    target: Math.min(100, Math.max(0, Number(el.target.value))),
    chargerRateKw: Number(el.chargerRate.value),
  };
}

function onCoreInputChange() {
  syncStateFromForm();
  renderResult();
  persist();
}

el.batteryKwh.addEventListener('input', onCoreInputChange);
el.soc.addEventListener('input', onCoreInputChange);
el.target.addEventListener('input', onCoreInputChange);
el.chargerRate.addEventListener('input', onCoreInputChange);

createAdvancedController({
  voltageInput: el.advVoltage,
  currentInput: el.advCurrent,
  chargerRateInput: el.chargerRate,
  onChange: () => {
    state = {
      ...state,
      chargerRateKw: Number(el.chargerRate.value),
      advanced: {
        voltage: Number(el.advVoltage.value),
        current: el.advCurrent.value === '' ? null : Number(el.advCurrent.value),
        maxChargeKw: state.advanced.maxChargeKw,
      },
    };
    renderResult();
    persist();
  },
});

el.advMaxCharge.addEventListener('input', () => {
  const raw = el.advMaxCharge.value;
  state = {
    ...state,
    advanced: {
      ...state.advanced,
      maxChargeKw: raw === '' ? null : Number(raw),
    },
  };
  renderResult();
  persist();
});

// --- Favourites ---

el.favouriteSelect.addEventListener('change', () => {
  const id = el.favouriteSelect.value || null;
  state = selectFavourite(state, id);
  renderForm();
  renderFavourites();
  renderResult();
  persist({ immediate: true });
});

el.addFavouriteBtn.addEventListener('click', () => {
  const name = el.newChargerName.value.trim();
  const rateKw = Number(el.chargerRate.value);
  const result = addFavourite(state, { name, rateKw });
  if (!result.ok) {
    el.favouriteMessage.textContent =
      result.reason === 'limit-reached'
        ? 'Favourite limit reached — delete one to add another.'
        : 'Enter a name and a valid charger rate before saving.';
    return;
  }
  state = result.state;
  el.newChargerName.value = '';
  el.favouriteMessage.textContent = '';
  renderFavourites();
  persist({ immediate: true });
});

el.deleteFavouriteBtn.addEventListener('click', () => {
  if (!state.activeChargerId) return;
  state = deleteFavourite(state, state.activeChargerId);
  renderForm();
  renderFavourites();
  el.favouriteMessage.textContent = '';
  persist({ immediate: true });
});

// --- Vehicles ---

async function initVehicles() {
  const vehicles = await loadVehicles();
  vehiclesById = new Map();
  el.vehicleList.innerHTML = '';
  for (const vehicle of vehicles) {
    const label = vehicleLabel(vehicle);
    vehiclesById.set(label, vehicle);
    const option = document.createElement('option');
    option.value = label;
    el.vehicleList.appendChild(option);
  }
}

el.vehicleSearch.addEventListener('change', () => {
  const vehicle = vehiclesById.get(el.vehicleSearch.value);
  if (!vehicle) return;
  state = applyVehicle(state, vehicle);
  renderForm();
  renderResult();
  persist({ immediate: true });
});

// --- Simulate charge ---

function renderSimStatus() {
  if (!state.sim.active) {
    el.simStatus.textContent = '';
    el.simStartBtn.hidden = false;
    el.simStopBtn.hidden = true;
    return;
  }

  el.simStartBtn.hidden = true;
  el.simStopBtn.hidden = false;

  const tick = computeSimTick({
    sim: state.sim,
    batteryKwh: state.batteryKwh,
    chargerRateKw: state.chargerRateKw,
    maxChargeKw: state.advanced.maxChargeKw,
  });

  if (!tick) {
    el.simStatus.textContent = '';
    return;
  }

  if (tick.done) {
    el.simStatus.textContent = `Simulated charge: ${tick.liveSocPct.toFixed(1)}% — target reached.`;
  } else {
    el.simStatus.textContent = `Simulated charge: ${tick.liveSocPct.toFixed(1)}% — about ${formatChargeDuration(
      tick.remainingTimeHours
    )} remaining.`;
  }
}

function startSimTimer() {
  if (simTimer) clearInterval(simTimer);
  simTimer = setInterval(renderSimStatus, 1000);
  renderSimStatus();
}

function stopSimTimer() {
  if (simTimer) {
    clearInterval(simTimer);
    simTimer = null;
  }
}

el.simStartBtn.addEventListener('click', () => {
  syncStateFromForm();
  state = startSim(state);
  persist({ immediate: true });
  startSimTimer();
  renderResult();
});

el.simStopBtn.addEventListener('click', () => {
  const tick = computeSimTick({
    sim: state.sim,
    batteryKwh: state.batteryKwh,
    chargerRateKw: state.chargerRateKw,
    maxChargeKw: state.advanced.maxChargeKw,
  });
  stopSimTimer();
  state = stopSim(state, tick ? tick.liveSocPct : NaN);
  renderForm();
  renderResult();
  renderSimStatus();
  persist({ immediate: true });
});

// --- Clear cookie ---

el.clearCookieBtn.addEventListener('click', () => {
  if (!confirm('Clear all saved preferences, favourite chargers, and simulation data?')) return;
  stopSimTimer();
  state = clearState();
  renderForm();
  renderFavourites();
  renderResult();
  renderSimStatus();
  el.favouriteMessage.textContent = '';
});

// --- Init ---

function init() {
  renderForm();
  renderFavourites();
  renderResult();
  if (state.sim.active) startSimTimer();
  else renderSimStatus();
  initVehicles();
}

init();
