// Which matchmaking service ("broker") phones use to find the host. Default: PeerJS's free
// cloud broker. A `?peer=host:port` in the address (or `wss://host:port/path`) switches this
// device to another one, e.g. a laptop running `npx peer --port 9000`; `?peer=cloud` switches back.
// The choice is remembered on the device and carried in the join link and QR code.
import { load, remove, save } from '../../lib/storage';

export interface Broker { host: string; port: number; path: string; secure: boolean }

const KEY = 'snark:broker';

/** Reads "host:port", "host:port/path" or "ws(s)://host:port/path"; null when it is not one. */
export function parseBroker(raw: string): Broker | null {
  const m = /^(?:(wss?|https?):\/\/)?([a-z0-9.-]+|\[[0-9a-f:]+\]):(\d{1,5})(\/[^\s?#]*)?$/i.exec(raw.trim());
  if (!m) return null;
  const port = Number(m[3]);
  if (port < 1 || port > 65535) return null;
  const scheme = m[1]?.toLowerCase();
  const secure = scheme ? scheme === 'wss' || scheme === 'https' : port === 443;
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
