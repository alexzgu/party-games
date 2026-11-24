// New versions (e.g. a pack pushed mid-party) download in the background and switch in
// only on the main menu or the Games page, where phones sit between games, so an update never
// reloads the page in the middle of a game. Something on those pages holding unsaved work (the
// Games page's category editor) holds an update back while it is open (`holdUpdates`).
import { registerSW } from 'virtual:pwa-register';
import { route } from './router.svelte';

const CHECK_EVERY_MS = 60_000;
let pending = false;
/** How many open things hold an update back. */
let holds = 0;

/** The main menu or the Games page. */
export function onMenu(path: string): boolean {
  return path === '/' || path === '' || path === '/games';
}

function reloadIfIdle(): void {
  if (pending && !holds && onMenu(route.path)) location.reload();
}

/** Holds a waiting update back until the returned release is called (later calls do nothing). */
export function holdUpdates(): () => void {
  holds++;
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    holds--;
    reloadIfIdle();
  };
}

function waitForActivation(worker: ServiceWorker): Promise<void> {
  return new Promise((resolve, reject) => {
    function finish(ok: boolean) {
      clearTimeout(timer);
      worker.removeEventListener('statechange', check);
      if (ok) resolve();
      else reject(new Error('The app update did not finish'));
    }
    function check() {
      if (worker.state === 'activated') finish(true);
      if (worker.state === 'redundant') finish(false);
    }
    const timer = setTimeout(() => finish(false), 45_000);
    worker.addEventListener('statechange', check);
    check();
  });
}

function refreshFrom(worker: ServiceWorker): Promise<void> {
  return new Promise((resolve, reject) => {
    const { port1, port2 } = new MessageChannel();
    function finish(ok: boolean) {
      clearTimeout(timer);
      port1.close();
      if (ok) resolve();
      else reject(new Error('The app cache could not be refreshed'));
    }
    const timer = setTimeout(() => finish(false), 50_000);
    port1.onmessage = (event) => finish(event.data === true);
    try {
      worker.postMessage('refresh-app-cache', [port2]);
    } catch {
      finish(false);
    }
  });
}

export const canRefreshApp = import.meta.env.PROD && 'serviceWorker' in navigator;

export async function refreshApp(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error('The app cache is still getting ready');
  await reg.update();
  const worker = reg.installing ?? reg.waiting ?? reg.active;
  if (!worker) throw new Error('The app cache is still getting ready');
  await waitForActivation(worker);
  await refreshFrom(worker);
  pending = true;
  if (route.path === '/settings') location.reload();
  else reloadIfIdle();
}

export function startUpdates(): void {
  registerSW({
    immediate: true,
    onNeedReload() {
      pending = true;
      reloadIfIdle();
    },
    onRegisteredSW(_url, reg) {
      if (reg) setInterval(() => { if (navigator.onLine) void reg.update().catch(() => {}); }, CHECK_EVERY_MS);
    },
  });
  addEventListener('hashchange', reloadIfIdle);
}
