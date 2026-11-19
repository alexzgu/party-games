// localStorage can throw (private mode, quota) or hold stale shapes; every access is guarded.
const PREFIX = 'hr:';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    if (fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
      return { ...fallback, ...parsed };
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the game still works, it just forgets */
  }
}

export function remove(key: string): void {
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
}

/** Ask the browser not to evict our data (iOS evicts idle sites' storage). */
export async function requestPersistence(): Promise<void> {
  try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
}

/** Removes every key under `prefix` (e.g. 'dial:'): a game's saved state, never custom packs. */
export function clearPrefix(prefix: string): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX + prefix)) localStorage.removeItem(k);
  } catch { /* ignore */ }
}
