// New versions (e.g. a pack pushed mid-party) download in the background and switch in
// only on the main menu, so an update never reloads the page in the middle of a game.
import { registerSW } from 'virtual:pwa-register';
import { route } from './router.svelte';

const CHECK_EVERY_MS = 60_000;
let pending = false;

function onMenu(): boolean {
  return route.path === '/' || route.path === '';
}

function reloadIfIdle(): void {
  if (pending && onMenu()) location.reload();
}

export function startUpdates(): void {
  registerSW({
    immediate: true,
    onNeedReload() {
      pending = true;
      reloadIfIdle();
    },
    onRegisteredSW(_url, reg) {
      if (reg) setInterval(() => { if (navigator.onLine) void reg.update(); }, CHECK_EVERY_MS);
    },
  });
  addEventListener('hashchange', reloadIfIdle);
}
