import { load, save } from './storage';
import { DEFAULT_MODEL } from './wizard';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  /** Anthropic API key for live generation, stored by the host's invite link. Stays on this device only. */
  apiKey: string;
  /** The model behind the wizard's effort choice (one of `EFFORTS` in wizard.ts). */
  model: string;
  /** Heads Down.: how a scored word shows. 'edge' lights the edge on the side picked; 'screen' flashes the whole screen. */
  headsDownFeedback: 'edge' | 'screen';
  /** Colour scheme; 'system' follows the phone. */
  theme: 'system' | 'light' | 'dark';
}

const DEFAULTS: Settings = {
  sound: true,
  haptics: true,
  apiKey: '',
  model: DEFAULT_MODEL,
  headsDownFeedback: 'edge',
  theme: 'dark',
};

export const settings = $state<Settings>(load('settings', DEFAULTS));

export function saveSettings(): void {
  save('settings', $state.snapshot(settings));
}

/** Puts the chosen colour scheme on <html data-theme>, following the phone when 'system'. */
export function applyTheme(): void {
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#120d24');
}
