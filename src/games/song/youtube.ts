// The official YouTube IFrame Player API, used for two things only, never to play a clip:
// reading a playlist's video ids (a player that is never played or shown, so no API key is
// needed) and the reveal's music video, shown uncovered with YouTube's own controls.

export const API_URL = 'https://www.youtube.com/iframe_api';
const LOAD_TIMEOUT_MS = 15000;
/** YT.PlayerState.PLAYING and CUED. */
export const PLAYING = 1;
const CUED = 5;
/** getPlaylist() returns at most this many ids. */
export const PLAYLIST_MAX = 200;

export interface YTPlayer {
  destroy(): void;
  pauseVideo(): void;
  cuePlaylist(o: { list: string; listType?: string }): void;
  getPlaylist(): string[] | null;
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: {
    width?: number | string;
    height?: number | string;
    videoId?: string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: () => void;
      onError?: (e: { data: number }) => void;
      onStateChange?: (e: { data: number }) => void;
    };
  }) => YTPlayer;
}

declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

/** YouTube answered but will not list the playlist (private, deleted or empty): not a connection problem. */
export class PlaylistError extends Error {}

let loading: Promise<YTNamespace> | null = null;

/** The API, loaded once; rejects when YouTube cannot be reached, so a retry can try again. */
export function loadYouTube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise<YTNamespace>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = (why: string) => {
      clearTimeout(timer);
      script.remove();
      reject(new Error(why));
    };
    const timer = setTimeout(() => fail('timeout'), LOAD_TIMEOUT_MS);
    const before = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      before?.();
      clearTimeout(timer);
      if (window.YT?.Player) resolve(window.YT);
      else fail('no player');
    };
    script.src = API_URL;
    script.async = true;
    script.onerror = () => fail('blocked');
    document.head.appendChild(script);
  }).catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

/**
 * The video ids in a playlist (up to 200). A player is made off screen just to ask YouTube for
 * the list; it is never played and is destroyed as soon as the ids are in. Rejects with a
 * PlaylistError when YouTube's player loaded but gives no videos (an error, or none in time);
 * a failure to load YouTube at all is a plain Error (the connection).
 */
export async function readPlaylist(list: string): Promise<string[]> {
  const YT = await loadYouTube();
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:200px;height:200px;';
  const el = document.createElement('div');
  host.appendChild(el);
  document.body.appendChild(host);
  let player: YTPlayer | null = null;
  try {
    return await new Promise<string[]>((resolve, reject) => {
      const timer = setTimeout(() => reject(new PlaylistError('no videos')), LOAD_TIMEOUT_MS);
      const read = () => {
        const ids = player?.getPlaylist();
        if (ids?.length) { clearTimeout(timer); resolve(ids.slice(0, PLAYLIST_MAX)); }
      };
      player = new YT.Player(el, {
        width: 200, height: 200,
        playerVars: { autoplay: 0, controls: 0, playsinline: 1, origin: location.origin },
        events: {
          onReady: () => player?.cuePlaylist({ list, listType: 'playlist' }),
          onStateChange: (e) => { if (e.data === CUED) read(); },
          onError: () => { clearTimeout(timer); reject(new PlaylistError('playlist')); },
        },
      });
    });
  } finally {
    try { (player as YTPlayer | null)?.destroy(); } catch { /* gone */ }
    host.remove();
  }
}

/** The reveal's video in `el`, shown with YouTube's normal controls. `onplay` fires when someone starts it. */
export async function revealPlayer(el: HTMLElement, videoId: string, onplay: () => void): Promise<YTPlayer> {
  const YT = await loadYouTube();
  return new Promise((resolve) => {
    const player: YTPlayer = new YT.Player(el, {
      width: '100%',
      height: '100%',
      videoId,
      playerVars: { playsinline: 1, rel: 0, controls: 1, origin: location.origin },
      events: {
        onReady: () => resolve(player),
        onStateChange: (e) => { if (e.data === PLAYING) onplay(); },
      },
    });
  });
}
