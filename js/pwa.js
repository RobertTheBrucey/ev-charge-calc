if ('serviceWorker' in navigator) {
  // Only a *returning* visitor can already have a controller at load time.
  // A first-time install goes from no controller to one, which also fires
  // 'controllerchange' — we don't want to reload in that case, only when an
  // already-active service worker gets replaced by a newer deploy.
  const hadController = Boolean(navigator.serviceWorker.controller);

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });

  if (hadController) {
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  }
}
