import { loadState, saveState, clearState } from './storage.js';
import { calculateChargeTime } from './calc.js';
import { formatChargeDuration, formatClockTime } from './format.js';
import { createAdvancedController } from './advanced.js';
import { addFavourite, deleteFavourite, selectFavourite } from './favourites.js';
import { loadVehicles, vehicleLabel, applyVehicle, searchVehicles } from './vehicles.js';
import { computeSimTick, startSim, stopSim } from './simulate.js';

let state = loadState();
let simTimer = null;
let vehicles = [];
let suggestionMatches = [];
let activeSuggestionIndex = -1;

const el = {
  batteryKwh: document.getElementById('battery-kwh'),
  soc: document.getElementById('soc'),
  chargerRate: document.getElementById('charger-rate'),
  target: document.getElementById('target'),

  resultMessage: document.getElementById('result-message'),
  resultStats: document.getElementById('result-stats'),
  stat1Label: document.getElementById('stat-1-label'),
  stat1Value: document.getElementById('stat-1-value'),
  stat2Label: document.getElementById('stat-2-label'),
  stat2Value: document.getElementById('stat-2-value'),
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
  vehicleSuggestions: document.getElementById('vehicle-suggestions'),

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

function showResultStats(label1, value1, label2, value2) {
  el.resultMessage.hidden = true;
  el.resultStats.hidden = false;
  el.stat1Label.textContent = label1;
  el.stat1Value.textContent = value1;
  el.stat2Label.textContent = label2;
  el.stat2Value.textContent = value2;
}

function showResultMessage(text) {
  el.resultStats.hidden = true;
  el.resultMessage.hidden = false;
  el.resultMessage.textContent = text;
}

/**
 * Renders the two-tile estimate (or a fallback message) and keeps the
 * Start/End Simulation button in sync with whether a simulation is active.
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
      showResultMessage('—');
    } else if (tick.done) {
      showResultStats('Charge level', `${tick.liveSocPct.toFixed(1)}%`, 'Status', 'Target reached');
    } else {
      showResultStats('Charge level', `${tick.liveSocPct.toFixed(1)}%`, 'Remaining', formatChargeDuration(tick.remainingTimeHours));
    }
    return;
  }

  el.simToggleBtn.textContent = 'Start Simulation';

  const result = calculateChargeTime(currentInputs());
  if (!result.ok) {
    showResultMessage(
      result.reason === 'target-not-above-current'
        ? 'Target is at or below current charge.'
        : 'Enter valid charge details.'
    );
    el.simToggleBtn.disabled = true;
    return;
  }

  showResultStats('Time remaining', formatChargeDuration(result.timeHours), 'Finish time', formatClockTime(result.finishTime));
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
//
// This is a hand-rolled suggestion list rather than a native <datalist>.
// Chrome's datalist popup turned out to be unreliable in practice (no
// suggestions shown at all in some desktop Chrome profiles, even with a
// correctly populated datalist and no console errors) — building our own
// gives consistent behaviour across every browser.

async function initVehicles() {
  vehicles = await loadVehicles();
}

function renderSuggestions(matches) {
  suggestionMatches = matches.slice(0, 8);
  activeSuggestionIndex = -1;
  el.vehicleSuggestions.innerHTML = '';

  if (suggestionMatches.length === 0) {
    el.vehicleSuggestions.hidden = true;
    el.vehicleSearch.setAttribute('aria-expanded', 'false');
    el.vehicleSearch.removeAttribute('aria-activedescendant');
    return;
  }

  suggestionMatches.forEach((vehicle, index) => {
    const item = document.createElement('li');
    item.id = `vehicle-suggestion-${index}`;
    item.className = 'suggestion-item';
    item.setAttribute('role', 'option');
    item.textContent = vehicleLabel(vehicle);
    // mousedown (not click) + preventDefault so the input never blurs,
    // avoiding a race between the click landing and the list being hidden.
    item.addEventListener('mousedown', (event) => {
      event.preventDefault();
      selectVehicle(vehicle);
    });
    el.vehicleSuggestions.appendChild(item);
  });

  el.vehicleSuggestions.hidden = false;
  el.vehicleSearch.setAttribute('aria-expanded', 'true');
}

function updateActiveSuggestion() {
  const items = el.vehicleSuggestions.querySelectorAll('.suggestion-item');
  items.forEach((item, index) => item.classList.toggle('active', index === activeSuggestionIndex));
  const active = items[activeSuggestionIndex];
  if (active) {
    el.vehicleSearch.setAttribute('aria-activedescendant', active.id);
    active.scrollIntoView({ block: 'nearest' });
  } else {
    el.vehicleSearch.removeAttribute('aria-activedescendant');
  }
}

function selectVehicle(vehicle) {
  el.vehicleSearch.value = vehicleLabel(vehicle);
  state = applyVehicle(state, vehicle);
  renderForm();
  renderEstimate();
  persist({ immediate: true });
  renderSuggestions([]);
  // Collapse the lookup again once a vehicle has been picked.
  el.vehicleLookup.open = false;
}

el.vehicleSearch.addEventListener('input', () => {
  const query = el.vehicleSearch.value.trim();
  renderSuggestions(query ? searchVehicles(vehicles, query) : []);
});

el.vehicleSearch.addEventListener('keydown', (event) => {
  if (el.vehicleSuggestions.hidden) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, suggestionMatches.length - 1);
    updateActiveSuggestion();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, 0);
    updateActiveSuggestion();
  } else if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
    event.preventDefault();
    selectVehicle(suggestionMatches[activeSuggestionIndex]);
  } else if (event.key === 'Escape') {
    renderSuggestions([]);
  }
});

el.vehicleSearch.addEventListener('blur', () => {
  renderSuggestions([]);
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
