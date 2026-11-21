// YouTube's embedded player, used for two things only, never to play a clip: reading a
// playlist's video ids (a hidden player that is never played) and the reveal's music video,
// shown uncovered with YouTube's own controls. The player is a plain cross-origin iframe
// driven by postMessage (the protocol YouTube's own IFrame API speaks), so no YouTube script
// ever runs in this page, where it could read the phone's settings.

export const EMBED_ORIGIN = 'https://www.youtube-nocookie.com';
const TIMEOUT_MS = 15000;
/** How often to say hello until the player answers (it is not listening until it has loaded). */
const HELLO_MS = 250;
/** Player states, as YouTube numbers them. */
export const PLAYING = 1;
/** A playlist yields at most this many ids. */
export const PLAYLIST_MAX = 200;
const VIDEO_ID = /^[\w-]{11}$/;
/**
 * The frame's sandbox: scripts and its own origin (the player needs both to play and to talk),
 * the presentation API, and pop-ups (YouTube's logo and title open youtube.com in a new tab),
 * which leave the sandbox so YouTube works there. Never top navigation: the player can't move
 * this page elsewhere.
 */
export const SANDBOX = 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox';
/** Media permissions for a frame someone watches; a playlist reader gets none. */
const WATCH_ALLOW = 'encrypted-media; picture-in-picture; fullscreen';
/** The messages that say the player has loaded and is listening. */
const READY = new Set(['onReady', 'initialDelivery']);

/** YouTube answered but will not list the playlist (private, deleted or empty): not a connection problem. */
export class PlaylistError extends Error {}

export interface PlayerEvents {
  /** The player said it is ready (once). */
  onConnect?(): void;
  onState?(state: number): void;
  onError?(code: number): void;
  /** The ids of the playlist the player holds. */
  onPlaylist?(ids: string[]): void;
}

export interface Player { destroy(): void }

type Incoming = Pick<MessageEvent, 'origin' | 'source' | 'data'>;

/** The player's message as {event, info}, or null when it is not from `frame` on YouTube's embed origin. */
export function playerMessage(e: Incoming, frame: Window | null | undefined): { event: string; info: unknown } | null {
  if (!frame || e.source !== frame || e.origin !== EMBED_ORIGIN || typeof e.data !== 'string') return null;
  let d: unknown;
  try {
    d = JSON.parse(e.data);
  } catch {
    return null;
  }
  if (!d || typeof d !== 'object') return null;
  const { event, info } = d as { event?: unknown; info?: unknown };
  return typeof event === 'string' ? { event, info } : null;
}

/** The embed address for `path` ('/embed/<id>' or '/embed'), with the API turned on for this page's origin. */
export function embedUrl(path: string, params: Record<string, string | number>, origin = location.origin): string {
  const q = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), enablejsapi: '1', origin });
  return `${EMBED_ORIGIN}${path}?${q}`;
}

/**
 * Talks to one player frame: says hello until it answers, then asks for state changes and
 * errors and passes on what it reports. Everything not from that frame on EMBED_ORIGIN is ignored.
 */
export class PlayerLink {
  private connected = false;
  private state: number | null = null;

  constructor(private readonly frame: () => Window | null | undefined, private readonly on: PlayerEvents) {}

  private send(msg: Record<string, unknown>) {
    this.frame()?.postMessage(JSON.stringify({ ...msg, id: 1, channel: 'widget' }), EMBED_ORIGIN);
  }

  /** One hello; false once the player has answered (stop saying it). */
  hello(): boolean {
    if (this.connected) return false;
    this.send({ event: 'listening' });
    return true;
  }

  receive(e: Incoming): void {
    const m = playerMessage(e, this.frame());
    if (!m) return;
    if (!this.connected && READY.has(m.event)) {
      this.connected = true;
      for (const name of ['onStateChange', 'onError']) this.send({ event: 'command', func: 'addEventListener', args: [name] });
      this.on.onConnect?.();
    }
    const info = m.info;
    if (m.event === 'onStateChange' && typeof info === 'number') this.setState(info);
    else if (m.event === 'onError' && typeof info === 'number') this.on.onError?.(info);
    else if ((m.event === 'initialDelivery' || m.event === 'infoDelivery') && info && typeof info === 'object') {
      const { playerState, playlist } = info as { playerState?: unknown; playlist?: unknown };
      if (typeof playerState === 'number') this.setState(playerState);
      if (Array.isArray(playlist)) this.on.onPlaylist?.(playlist.filter((id): id is string => typeof id === 'string' && VIDEO_ID.test(id)));
    }
  }

  /** The player reports a state both ways; each change is passed on once. */
  private setState(s: number) {
    if (s === this.state) return;
    this.state = s;
    this.on.onState?.(s);
  }
}

/**
 * A sandboxed player frame for `src` inside `parent`; `watch` gives it the media permissions a
 * watched video needs. `destroy` removes it and stops listening.
 */
export function embed(parent: HTMLElement, src: string, on: PlayerEvents, opts: { size?: number; watch?: boolean } = {}): Player {
  const { size, watch = false } = opts;
  const frame = document.createElement('iframe');
  const link = new PlayerLink(() => frame.contentWindow, on);
  let hello: ReturnType<typeof setInterval> | undefined;
  const listen = (e: MessageEvent) => link.receive(e);
  frame.title = 'YouTube video player';
  // Set before src: a sandbox applies from the frame's next navigation.
  frame.setAttribute('sandbox', SANDBOX);
  if (watch) {
    frame.allow = WATCH_ALLOW;
    frame.allowFullscreen = true;
  }
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  if (size) { frame.width = String(size); frame.height = String(size); }
  // Hello only once the frame holds YouTube's page; before that it would go nowhere.
  frame.addEventListener('load', () => {
    clearInterval(hello);
    if (link.hello()) hello = setInterval(() => { if (!link.hello()) clearInterval(hello); }, HELLO_MS);
  });
  window.addEventListener('message', listen);
  frame.src = src;
  parent.appendChild(frame);
  return {
    destroy() {
      clearInterval(hello);
      window.removeEventListener('message', listen);
      frame.remove();
    },
  };
}

/**
 * The video ids in a playlist (up to 200), read by a hidden player that is never played and is
 * removed as soon as the ids are in. Rejects with a PlaylistError when the player answered but
 * gives no videos (an error, or none in time); a player that never answers is a plain Error
 * (the connection).
 */
export function readPlaylist(list: string): Promise<string[]> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:200px;height:200px;';
  document.body.appendChild(host);
  return new Promise<string[]>((resolve, reject) => {
    let done = false;
    const finish = (settle: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      player.destroy();
      host.remove();
      settle();
    };
    const fail = (e: Error) => () => finish(() => reject(e));
    let timer = setTimeout(fail(new Error('timeout')), TIMEOUT_MS);
    const src = embedUrl('/embed', { listType: 'playlist', list, autoplay: 0, controls: 0, playsinline: 1 });
    const player = embed(host, src, {
      onConnect: () => { clearTimeout(timer); timer = setTimeout(fail(new PlaylistError('no videos')), TIMEOUT_MS); },
      onPlaylist: (ids) => { if (ids.length) finish(() => resolve(ids.slice(0, PLAYLIST_MAX))); },
      onError: () => fail(new PlaylistError('playlist'))(),
    }, { size: 200 });
  });
}

/**
 * The reveal's video in `el`, shown with YouTube's normal controls. Resolves once the player
 * says it is ready; rejects (and removes it) when it never does or reports an error first. An
 * error after that (the video can't be played here, say) removes it and calls `onfail`.
 * `onplay` fires each time someone starts it.
 */
export function revealPlayer(el: HTMLElement, videoId: string, onplay: () => void, onfail: () => void = () => {}): Promise<Player> {
  return new Promise((resolve, reject) => {
    let ready = false;
    const src = embedUrl(`/embed/${encodeURIComponent(videoId)}`, { playsinline: 1, rel: 0, controls: 1 });
    const timer = setTimeout(() => { player.destroy(); reject(new Error('timeout')); }, TIMEOUT_MS);
    const player = embed(el, src, {
      onConnect: () => { ready = true; clearTimeout(timer); resolve(player); },
      onState: (s) => { if (s === PLAYING) onplay(); },
      onError: (code) => {
        clearTimeout(timer);
        player.destroy();
        if (ready) onfail();
        else reject(new Error(`player error ${code}`));
      },
    }, { watch: true });
  });
}
