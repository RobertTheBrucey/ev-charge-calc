const COOKIE_NAME = 'evcc_prefs';
const MAX_COOKIE_BYTES = 3800;
const MAX_FAVOURITES = 20;
const SCHEMA_VERSION = 1;
const SAVE_DEBOUNCE_MS = 300;

export const DEFAULT_STATE = Object.freeze({
  v: SCHEMA_VERSION,
  soc: 50,
  target: 80,
  batteryKwh: 60,
  chargerRateKw: 7.4,
  activeChargerId: null,
  vehicleId: null,
  advanced: { voltage: 400, current: null, maxChargeKw: null },
  chargers: [],
  sim: { active: false, startIso: null, startSoc: null, startTarget: null },
});

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampPct(value, fallback) {
  const n = num(value, fallback);
  return Math.min(100, Math.max(0, n));
}

function sanitizeState(raw) {
  const base = cloneDefault();
  if (!raw || typeof raw !== 'object') return base;

  base.soc = clampPct(raw.soc, base.soc);
  base.target = clampPct(raw.target, base.target);
  base.batteryKwh = num(raw.batteryKwh, base.batteryKwh);
  base.chargerRateKw = num(raw.chargerRateKw, base.chargerRateKw);
  base.activeChargerId = typeof raw.activeChargerId === 'string' ? raw.activeChargerId : null;
  base.vehicleId = typeof raw.vehicleId === 'string' ? raw.vehicleId : null;

  if (raw.advanced && typeof raw.advanced === 'object') {
    base.advanced.voltage = num(raw.advanced.voltage, base.advanced.voltage);
    base.advanced.current =
      raw.advanced.current === null || raw.advanced.current === undefined
        ? null
        : num(raw.advanced.current, null);
    base.advanced.maxChargeKw =
      raw.advanced.maxChargeKw === null || raw.advanced.maxChargeKw === undefined
        ? null
        : num(raw.advanced.maxChargeKw, null);
  }

  if (Array.isArray(raw.chargers)) {
    base.chargers = raw.chargers
      .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string')
      .slice(0, MAX_FAVOURITES)
      .map((c) => ({
        id: c.id,
        name: c.name,
        rateKw: num(c.rateKw, 7.4),
        voltage: c.voltage === null || c.voltage === undefined ? null : num(c.voltage, null),
        current: c.current === null || c.current === undefined ? null : num(c.current, null),
      }));
  }

  if (raw.sim && typeof raw.sim === 'object' && raw.sim.active === true && typeof raw.sim.startIso === 'string') {
    base.sim = {
      active: true,
      startIso: raw.sim.startIso,
      startSoc: clampPct(raw.sim.startSoc, base.soc),
      startTarget: clampPct(raw.sim.startTarget, base.target),
    };
  }

  return base;
}

function readCookieRaw() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? match[1] : null;
}

function writeCookieRaw(encoded, maxAgeSeconds) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${encoded}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

export function loadState() {
  const raw = readCookieRaw();
  if (!raw) return cloneDefault();
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (typeof parsed.v !== 'number') return cloneDefault();
    return sanitizeState(parsed);
  } catch {
    return cloneDefault();
  }
}

let saveTimer = null;

export function saveState(state, { immediate = false } = {}) {
  const doSave = () => {
    const encoded = encodeURIComponent(JSON.stringify(state));
    if (encoded.length > MAX_COOKIE_BYTES) {
      return { ok: false, error: 'Too many favourites — delete one to save more.' };
    }
    writeCookieRaw(encoded, 31536000);
    return { ok: true };
  };

  if (immediate) {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    return doSave();
  }

  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, SAVE_DEBOUNCE_MS);
  return { ok: true };
}

export function clearState() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  writeCookieRaw('', 0);
  return cloneDefault();
}

export const LIMITS = { MAX_FAVOURITES };
