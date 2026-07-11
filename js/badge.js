import { formatAgo } from './format.js';

const REFRESH_MS = 30000;

async function initBuildBadge() {
  if (!location.hostname.startsWith('staging.')) return;

  const el = document.getElementById('build-badge');
  if (!el) return;

  let buildTime;
  try {
    const res = await fetch('/build-info.json', { cache: 'no-store' });
    const data = await res.json();
    buildTime = new Date(data.buildTime);
    if (Number.isNaN(buildTime.getTime())) return;
  } catch {
    return;
  }

  function render() {
    el.textContent = `Built ${formatAgo(Date.now() - buildTime.getTime())}`;
    el.hidden = false;
  }

  render();
  setInterval(render, REFRESH_MS);
}

initBuildBadge();
