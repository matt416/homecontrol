const CHECK_INTERVAL = 15_000;

function getAssets(page: Document, origin: string) {
  const references = [
    ...Array.from(page.querySelectorAll('script[type="module"][src]'), (node) =>
      node.getAttribute('src')!,
    ),
    ...Array.from(
      page.querySelectorAll('link[rel="stylesheet"][href]'),
      (node) => node.getAttribute('href')!,
    ),
  ];
  if (!page.querySelector('script[type="module"][src]')) return [];
  const urls = references.map((reference) => new URL(reference, origin));
  if (
    urls.some(
      (url) => url.origin !== origin || !url.pathname.startsWith('/assets/'),
    )
  )
    return [];
  return urls.map((url) => url.href).sort();
}

export function watchForUpdates(
  fetchPage: typeof fetch = fetch,
  reload = () => window.location.reload(),
) {
  const origin = window.location.origin;
  const current = getAssets(document, origin).join('\n');
  if (!current) return () => {};
  let candidate = '';
  let pending = false;
  let stopped = false;
  let reloading = false;
  let request: AbortController | undefined;
  async function check() {
    if (pending || stopped || reloading || document.hidden) return;
    pending = true;
    request = new AbortController();
    const timeout = window.setTimeout(() => request?.abort(), 8_000);
    try {
      const options = { cache: 'no-store' as const, signal: request.signal };
      const response = await fetchPage('/', options);
      if (!response.ok) throw new Error('Update not ready');
      const page = new DOMParser().parseFromString(
        await response.text(),
        'text/html',
      );
      const assets = getAssets(page, origin);
      const version = assets.join('\n');
      if (!version || version === current) {
        candidate = '';
        return;
      }
      // Require the same deployment twice so an in-progress build cannot trigger a reload.
      if (candidate !== version) {
        candidate = version;
        return;
      }
      const available = await Promise.all(
        assets.map((asset) => fetchPage(asset, { ...options, method: 'HEAD' })),
      );
      if (available.some((asset) => !asset.ok))
        throw new Error('Update assets not ready');
      if (!stopped) {
        reloading = true;
        reload();
      }
    } catch {
      // Keep the working screen during rebuilds and temporary network failures.
      candidate = '';
    } finally {
      window.clearTimeout(timeout);
      pending = false;
    }
  }
  const timer = window.setInterval(() => void check(), CHECK_INTERVAL);
  const resume = () => void check();
  window.addEventListener('online', resume);
  document.addEventListener('visibilitychange', resume);
  return () => {
    stopped = true;
    window.clearInterval(timer);
    request?.abort();
    window.removeEventListener('online', resume);
    document.removeEventListener('visibilitychange', resume);
  };
}
