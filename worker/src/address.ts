// Which "address" a guess counts against. One IPv6 subscriber usually holds at least a /64 (often
// a /56 or /48), so an IPv6 address counts by its /64; IPv4 counts by the full address. The
// "network" around it (IPv6 /48, IPv4 /24) bounds what fresh addresses can claim: see limits.ts.
import { addressLabel } from './crypto';

export interface Client {
  /** One-way labels: storage never holds the address itself. */
  address: string;
  network: string;
}

function ipv4(text: string): number[] | null {
  const parts = text.split('.');
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p))) return null;
  const n = parts.map(Number);
  return n.every((x) => x <= 255) ? n : null;
}

/** The eight 16-bit groups of an IPv6 address, or null when `text` is not one. */
function ipv6(text: string): number[] | null {
  let t = text.toLowerCase().replace(/%.*$/, '');
  // A trailing dotted IPv4 (::ffff:1.2.3.4) is the last two groups.
  const dotted = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(t);
  if (dotted) {
    const v4 = ipv4(dotted[2]);
    if (!v4) return null;
    t = dotted[1] + ((v4[0] << 8) | v4[1]).toString(16) + ':' + ((v4[2] << 8) | v4[3]).toString(16);
  }
  const halves = t.split('::');
  if (halves.length > 2) return null;
  const groups = (h: string) => (h ? h.split(':') : []);
  const head = groups(halves[0]);
  const tail = halves.length === 2 ? groups(halves[1]) : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 2 ? fill < 1 : fill !== 0) return null;
  const all = [...head, ...Array(halves.length === 2 ? fill : 0).fill('0'), ...tail];
  if (!all.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return all.map((g) => parseInt(g, 16));
}

/** The address and network a client IP counts as, in plain text (before labelling). */
export function buckets(ip: string): { address: string; network: string } {
  const raw = ip.trim();
  const v4 = ipv4(raw);
  if (v4) return { address: `v4 ${v4.join('.')}`, network: `v4 ${v4.slice(0, 3).join('.')}/24` };
  const v6 = ipv6(raw);
  if (v6) {
    // An IPv4-mapped IPv6 address (::ffff:a.b.c.d) is that IPv4 address.
    if (v6.slice(0, 5).every((g) => g === 0) && v6[5] === 0xffff) {
      return buckets([v6[6] >> 8, v6[6] & 255, v6[7] >> 8, v6[7] & 255].join('.'));
    }
    const hex = v6.map((g) => g.toString(16));
    return { address: `v6 ${hex.slice(0, 4).join(':')}::/64`, network: `v6 ${hex.slice(0, 3).join(':')}::/48` };
  }
  // Not an IP (no header in local testing): everyone without one shares a bucket.
  return { address: `other ${raw}`, network: `other ${raw}` };
}

/** The labels a request's guesses count against, from Cloudflare's `cf-connecting-ip`. */
export async function clientOf(ip: string | null): Promise<Client> {
  const b = buckets(ip ?? 'unknown');
  return { address: await addressLabel(b.address), network: await addressLabel(b.network) };
}
