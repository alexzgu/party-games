// Keeps the screen on during play. Re-acquired when the page becomes visible again,
// since browsers drop the lock whenever the tab is hidden.
let sentinel: WakeLockSentinel | null = null;
let pending: Promise<void> | null = null;
let wanted = false;

function acquire(): void {
  if (pending || sentinel || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  pending = navigator.wakeLock
    .request('screen')
    .then((lock) => {
      // The game may have ended while the request was pending.
      if (!wanted) { void lock.release(); return; }
      sentinel = lock;
      lock.addEventListener('release', () => { if (sentinel === lock) sentinel = null; });
    })
    .catch(() => { /* unsupported or denied: nothing to do */ })
    .finally(() => { pending = null; });
}

document.addEventListener('visibilitychange', () => {
  if (wanted) acquire();
});

export function keepAwake(on: boolean): void {
  wanted = on;
  if (on) acquire();
  else if (sentinel) { void sentinel.release(); sentinel = null; }
}
