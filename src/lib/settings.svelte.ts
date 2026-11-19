import { load, save } from './storage';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  /** Anthropic API key for live generation. Stays on this device only. */
  apiKey: string;
  model: string;
}

const DEFAULTS: Settings = {
  sound: true,
  haptics: true,
  apiKey: '',
  model: 'claude-opus-5-5',
};

export const settings = $state<Settings>(load('settings', DEFAULTS));

export function saveSettings(): void {
  save('settings', $state.snapshot(settings));
}
