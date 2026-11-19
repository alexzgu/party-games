import { load, save } from './storage';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  /** Anthropic API key for live generation. Stays on this device only. */
  apiKey: string;
  model: string;
  /** Heads Down.: how a scored word shows. 'edge' lights the edge on the side picked; 'screen' flashes the whole screen. */
  headsDownFeedback: 'edge' | 'screen';
}

const DEFAULTS: Settings = {
  sound: true,
  haptics: true,
  apiKey: '',
  model: 'claude-opus-5-5',
  headsDownFeedback: 'edge',
};

export const settings = $state<Settings>(load('settings', DEFAULTS));

export function saveSettings(): void {
  save('settings', $state.snapshot(settings));
}
