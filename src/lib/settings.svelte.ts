import { load, save } from './storage';
import { DEFAULT_MODEL } from './wizard';
import type { PackView } from './packList';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  /** Anthropic API key for live generation, stored by the host's invite link. Stays on this device only. */
  apiKey: string;
  /** Session token from the wizard server after the magic words (wizardServer.ts). Never an API key; never in an invite link. */
  wizardPass: string;
  /** The model behind the wizard's effort choice (one of `EFFORTS` in wizard.ts). */
  model: string;
  /** Heads Down.: how a scored word shows. 'edge' lights the edge on the side picked; 'screen' flashes the whole screen. */
  headsDownFeedback: 'edge' | 'screen';
  /** Colour scheme; 'system' follows the phone. */
  theme: 'system' | 'light' | 'dark';
  /** How every game's pack list on setup shows its packs. */
  packView: PackView;
  /** "Got it" tapped on the note under Fizzwick's results (wizardNote.ts): it never shows again on this phone. */
  wizardNoteSeen: boolean;
  /** Display: the size of all text (Small/Normal/Large), except text read from across the room. */
  textSize: TextSize;
  /** Display: padding and gaps across the app; 'compact' takes about a third of the height out. */
  spacing: Spacing;
}

export const TEXT_SIZES = ['small', 'normal', 'large'] as const;
export const SPACINGS = ['compact', 'normal'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export type Spacing = (typeof SPACINGS)[number];

/** A stored value this version does not know (or none) reads as Normal. */
const pick = <T extends string>(allowed: readonly T[], v: unknown): T | 'normal' => (allowed as readonly unknown[]).includes(v) ? (v as T) : 'normal';
export const textSizeOf = (v: unknown): TextSize => pick(TEXT_SIZES, v);
export const spacingOf = (v: unknown): Spacing => pick(SPACINGS, v);

const DEFAULTS: Settings = {
  sound: true,
  haptics: true,
  apiKey: '',
  wizardPass: '',
  model: DEFAULT_MODEL,
  headsDownFeedback: 'edge',
  theme: 'dark',
  packView: 'tiles',
  wizardNoteSeen: false,
  textSize: 'normal',
  spacing: 'normal',
};

function stored(): Settings {
  const s = load('settings', DEFAULTS);
  return { ...s, textSize: textSizeOf(s.textSize), spacing: spacingOf(s.spacing) };
}

export const settings = $state<Settings>(stored());

export function saveSettings(): void {
  save('settings', $state.snapshot(settings));
}

/** Puts the chosen colour scheme on <html data-theme>, following the phone when 'system'. */
export function applyTheme(): void {
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#120d24');
}

/** Puts the display choices on <html> (data-text, data-density), where tokens.css turns them into
 *  sizes for every screen at once. index.html does the same from storage before the first paint. */
export function applyDisplay(root: { dataset: DOMStringMap } = document.documentElement): void {
  root.dataset.text = textSizeOf(settings.textSize);
  root.dataset.density = spacingOf(settings.spacing);
}
