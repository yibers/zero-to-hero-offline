// Pages may cache the HTML as well as its assets. Check a fresh release marker
// even when this script was loaded from an older, correctly versioned page.
(() => {
  if (!/^https?:$/.test(location.protocol)) return;
  const current = document.querySelector('meta[name="app-version"]')?.content;
  if (!current) return;
  let checking = false;
  // A partially propagated deployment must not send the player into a loop.
  let attempted = new URL(location.href).searchParams.get('__update');

  function cleanLink() {
    const url = new URL(location.href);
    if (!url.searchParams.has('__update') && !url.searchParams.has('v')) return;
    url.searchParams.delete('__update');
    url.searchParams.delete('v');
    history.replaceState(history.state, '', url);
  }

  async function checkForUpdate() {
    if (checking || document.visibilityState === 'hidden') return;
    checking = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const url = new URL('version.json', document.baseURI);
      // no-store bypasses the browser cache; a unique URL also avoids an old
      // CDN response when opening a bookmark carrying an obsolete ?v= value.
      url.searchParams.set('check', Date.now().toString());
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) return;
      const { version } = await response.json();
      if (!/^[a-f0-9]{12}$/.test(version)) return;
      if (version === current || version === attempted) {
        cleanLink();
        return;
      }
      // Text drafts and icon rows use the game's existing persistence path.
      // If saving fails, stay here instead of risking the player's work.
      window.saveProgress();
      attempted = version;
      const next = new URL(location.href);
      next.searchParams.delete('v');
      next.searchParams.set('__update', version);
      location.replace(next.href);
    } catch (_) {
      // Offline use and temporary deployment failures must leave the game usable.
    } finally {
      clearTimeout(timeout);
      checking = false;
    }
  }

  window.addEventListener('pageshow', checkForUpdate);
  window.addEventListener('online', checkForUpdate);
  document.addEventListener('visibilitychange', checkForUpdate);
  checkForUpdate();
})();
