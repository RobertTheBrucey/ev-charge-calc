export function formatChargeDuration(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return 'Done';
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes <= 0) return 'Done';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function formatClockTime(date) {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${hours}:${minutes}${ampm}`;
}

export function formatAgo(deltaMs) {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) deltaMs = 0;
  const totalMinutes = Math.floor(deltaMs / 60000);
  if (totalMinutes < 1) return 'just now';

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (days > 0 || hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return `${parts.join(' ')} ago`;
}
