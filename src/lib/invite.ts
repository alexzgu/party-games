// Invite links: the host's phone builds `<site>#/join/<key>`; opening it on a friend's phone puts
// the key in that phone's settings so the wizard can make packs there. Pure, so it is tested
// without a browser. The key itself never appears anywhere but the link and that phone.

const KEY = /^sk-ant-[A-Za-z0-9_-]+$/;

/** The key from a router path `/join/<key>`, or null when the path or the key looks wrong. */
export function keyFromInvite(path: string): string | null {
  const m = /^\/join\/([^/?#]*)\/?$/.exec(path);
  if (!m) return null;
  let key: string;
  try {
    key = decodeURIComponent(m[1]).trim();
  } catch {
    return null;
  }
  return key.length >= 20 && key.length <= 300 && KEY.test(key) ? key : null;
}

/** The link that carries `key`; `base` is the site's address without a hash (origin + pathname). */
export function inviteLink(key: string, base: string): string {
  return `${base.replace(/#.*$/, '')}#/join/${key}`;
}

/**
 * A key from what someone typed into the magic-words box: a whole invite link or a bare key
 * (for the host's own testing; players are only told about the magic words), else null.
 */
export function keyFromTyped(text: string): string | null {
  const t = text.trim();
  if (t.startsWith('sk-ant-')) return keyFromInvite(`/join/${t}`);
  return t.includes('#/join/') ? keyFromInvite(t.replace(/^[^#]*#/, '')) : null;
}
