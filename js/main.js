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
  simToggleBtn: document.getElementById('sim-toggle-btn'),

  favouriteSelect: document.getElementById('favourite-select'),
  newChargerName: document.getElementById('new-charger-name'),
  addFavouriteBtn: document.getElementById('add-favourite-btn'),
  deleteFavouriteBtn: document.getElementById('delete-favourite-btn'),
  favouriteMessage: document.getElementById('favourite-message'),

  advVoltage: document.getElementById('adv-voltage'),
  advCurrent: document.getElementById('adv-current'),
  advMaxCharge: document.getElementById('adv-max-charge'),

  vehicleLookup: document.getElementById('vehicle-lookup'),
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

/**
 * Renders the single-line brief estimate and keeps the Start/End Simulation
 * button in sync with whether a simulation is currently active.
 */
function renderEstimate() {
  if (state.sim.active) {
    el.simToggleBtn.textContent = 'End Simulation';
    el.simToggleBtn.disabled = false;

    const tick = computeSimTick({
      sim: state.sim,
      batteryKwh: state.batteryKwh,
      chargerRateKw: state.chargerRateKw,
      maxChargeKw: state.advanced.maxChargeKw,
    });

    if (!tick) {
      el.resultText.textContent = '—';
    } else if (tick.done) {
      el.resultText.textContent = `${tick.liveSocPct.toFixed(1)}% | Target reached`;
    } else {
      el.resultText.textContent = `${tick.liveSocPct.toFixed(1)}% | ${formatChargeDuration(tick.remainingTimeHours)} remaining`;
    }
    return;
  }

  el.simToggleBtn.textContent = 'Start Simulation';

  const result = calculateChargeTime(currentInputs());
  if (!result.ok) {
    el.resultText.textContent =
      result.reason === 'target-not-above-current'
        ? 'Target is at or below current charge.'
        : 'Enter valid charge details.';
    el.simToggleBtn.disabled = true;
    return;
  }

  el.resultText.textContent = `${formatChargeDuration(result.timeHours)} | ${formatClockTime(result.finishTime)}`;
  el.simToggleBtn.disabled = false;
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
  renderEstimate();
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
    renderEstimate();
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
  renderEstimate();
  persist();
});

// --- Favourites ---

el.favouriteSelect.addEventListener('change', () => {
  const id = el.favouriteSelect.value || null;
  state = selectFavourite(state, id);
  renderForm();
  renderFavourites();
  renderEstimate();
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

// 'input' (not 'change') because selecting a native <datalist> suggestion
// doesn't reliably fire 'change' until the field loses focus in some browsers.
el.vehicleSearch.addEventListener('input', () => {
  const vehicle = vehiclesById.get(el.vehicleSearch.value);
  if (!vehicle) return;
  state = applyVehicle(state, vehicle);
  renderForm();
  renderEstimate();
  persist({ immediate: true });
  // Collapse the lookup again once a vehicle has been picked.
  el.vehicleLookup.open = false;
});

// --- Simulate charge ---

function startSimTimer() {
  if (simTimer) clearInterval(simTimer);
  simTimer = setInterval(renderEstimate, 1000);
  renderEstimate();
}

function stopSimTimer() {
  if (simTimer) {
    clearInterval(simTimer);
    simTimer = null;
  }
}

el.simToggleBtn.addEventListener('click', () => {
  if (state.sim.active) {
    const tick = computeSimTick({
      sim: state.sim,
      batteryKwh: state.batteryKwh,
      chargerRateKw: state.chargerRateKw,
      maxChargeKw: state.advanced.maxChargeKw,
    });
    stopSimTimer();
    state = stopSim(state, tick ? tick.liveSocPct : NaN);
    renderForm();
    renderEstimate();
    persist({ immediate: true });
    return;
  }

  syncStateFromForm();
  state = startSim(state);
  persist({ immediate: true });
  startSimTimer();
});

// --- Clear cookie ---

el.clearCookieBtn.addEventListener('click', () => {
  if (!confirm('Clear all saved preferences, favourite chargers, and simulation data?')) return;
  stopSimTimer();
  state = clearState();
  renderForm();
  renderFavourites();
  renderEstimate();
  el.favouriteMessage.textContent = '';
});

// --- Init ---

function init() {
  renderForm();
  renderFavourites();
  if (state.sim.active) startSimTimer();
  else renderEstimate();
  initVehicles();
}

init();
