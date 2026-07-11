let cache = null;

export async function loadVehicles() {
  if (cache) return cache;
  try {
    const res = await fetch('/data/vehicles.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cache = await res.json();
  } catch {
    cache = [];
  }
  return cache;
}

export function vehicleLabel(vehicle) {
  return [vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(' ');
}

export function searchVehicles(vehicles, query) {
  const q = query.trim().toLowerCase();
  if (!q) return vehicles;
  return vehicles.filter((v) => vehicleLabel(v).toLowerCase().includes(q));
}

/**
 * Applies a vehicle's known specs to state: battery capacity, battery voltage,
 * and EV max charge rate only. Never touches charger fields.
 */
export function applyVehicle(state, vehicle) {
  if (!vehicle) return state;
  return {
    ...state,
    vehicleId: vehicle.id,
    batteryKwh: vehicle.batteryKwh,
    advanced: {
      ...state.advanced,
      voltage: vehicle.voltage,
      maxChargeKw: vehicle.maxChargeKw,
    },
  };
}
