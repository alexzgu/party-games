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

/** Stores it, or (storage full or blocked) leaves the old value: the game still works, it just forgets. */
export function save<T>(key: string, value: T): void {
  trySave(key, value);
}

/** `save`, saying whether it was stored. */
export function trySave<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
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
