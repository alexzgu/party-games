// Which matchmaking service ("broker") phones use to find the host. Default: PeerJS's free
// cloud broker. A `?peer=host:port` in the address (or `wss://host:port/path`) switches this
// device to another one; `?peer=cloud` switches back. The choice is remembered on the device and
// carried in the join link and QR code. An https page (the published site) can only reach a
// broker over wss://, so there it always connects securely, e.g. to a laptop's `npx peer --port
// 9000` behind a quick tunnel (`cloudflared tunnel --url http://localhost:9000`, then
// `?peer=<name>.trycloudflare.com:443`). Plain ws:// is for an http page only (local dev).
import { load, remove, save } from '../storage';

export interface Broker { host: string; port: number; path: string; secure: boolean }

// Stored under Snark Tank's old key so a choice made before the other own-phones games carries over.
const KEY = 'snark:broker';

const httpsPage = () => typeof location !== 'undefined' && location.protocol === 'https:';

/**
 * Reads "host:port", "host:port/path" or "ws(s)://host:port/path"; null when it is not one.
 * On an https page it is always secure (a browser blocks ws:// there); on an http page a
 * scheme-less one is secure only on port 443.
 */
export function parseBroker(raw: string, pageIsHttps = httpsPage()): Broker | null {
  const m = /^(?:(wss?|https?):\/\/)?([a-z0-9.-]+|\[[0-9a-f:]+\]):(\d{1,5})(\/[^\s?#]*)?$/i.exec(raw.trim());
  if (!m) return null;
  const port = Number(m[3]);
  if (port < 1 || port > 65535) return null;
  const scheme = m[1]?.toLowerCase();
  const secure = pageIsHttps || (scheme ? scheme === 'wss' || scheme === 'https' : port === 443);
  return { host: m[2], port, path: m[4] || '/', secure };
}

/** The broker this device uses: null means PeerJS's cloud broker. */
export function currentBroker(): Broker | null {
  return parseBroker(load<string>(KEY, ''));
}

/** The raw setting, for links and the connection popup ('' for the cloud). */
export const brokerSetting = (): string => (currentBroker() ? load<string>(KEY, '') : '');

/** Saves a setting typed by hand or found in the address. Returns false when it is not valid. */
export function setBroker(raw: string): boolean {
  const t = raw.trim();
  if (!t || /^(cloud|default)$/i.test(t)) { remove(KEY); return true; }
  if (!parseBroker(t)) return false;
  save(KEY, t);
  return true;
}

/** Picks up `?peer=` from the real query string or the hash route's. */
export function brokerFromAddress(hashParams: URLSearchParams): void {
  const raw = hashParams.get('peer') ?? new URLSearchParams(location.search).get('peer');
  if (raw !== null) setBroker(raw);
}

export const brokerLabel = (): string => {
  const b = currentBroker();
  return b ? `${b.host}:${b.port}` : 'PeerJS cloud';
};
