// Loads the official YouTube IFrame Player API and makes one hidden-able player. Nothing is
// downloaded or stored: the songs stream from YouTube while the game runs.
import type { PlayerLike } from './clip';

export const API_URL = 'https://www.youtube.com/iframe_api';
const LOAD_TIMEOUT_MS = 15000;

interface YTPlayer extends PlayerLike { destroy(): void }
interface YTNamespace {
  Player: new (el: HTMLElement, opts: {
    width?: number | string;
    height?: number | string;
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

let loading: Promise<YTNamespace> | null = null;

/**
 * The API, loaded once; rejects when YouTube cannot be reached, so a retry can try again. It always
 * tries, even when the browser says it is offline, because that flag is wrong on some networks.
 */
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

export interface PlayerHooks { onError(code: number): void; onState(): void }

/** A player in `el` (replaced by YouTube's iframe), resolved once it is ready for commands. */
export function makePlayer(YT: YTNamespace, el: HTMLElement, hooks: PlayerHooks): Promise<YTPlayer> {
  return new Promise((resolve) => {
    const player: YTPlayer = new YT.Player(el, {
      width: '100%',
      height: '100%',
      playerVars: {
        playsinline: 1, // iPhone: play in the page, not full screen
        controls: 0,
        disablekb: 1,
        fs: 0,
        rel: 0,
        iv_load_policy: 3,
        origin: location.origin,
      },
      events: {
        onReady: () => resolve(player),
        onError: (e) => hooks.onError(e.data),
        onStateChange: () => hooks.onState(),
      },
    });
  });
}
