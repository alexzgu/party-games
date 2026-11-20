import { settings } from './settings.svelte';

// Android: Vibration API, which Chrome skips while the phone's ringer is on silent (its
// VibrationManagerAndroid checks the ringer mode; nothing a page can change). iPhone: no Vibration API; Safari 18+ gives a light tick when a
// native switch toggles, so we toggle a hidden one. Silent no-op everywhere else.
let iosSwitch: HTMLLabelElement | null = null;

function iosTick(): void {
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

function buzz(pattern: number | number[]): void {
  if (!settings.haptics) return;
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
    else iosTick();
  } catch { /* ignore */ }
}

export const haptic = {
  light: () => buzz(12),
  correct: () => buzz([30, 60, 30]),
  pass: () => buzz(140),
  end: () => buzz([60, 40, 60, 40, 200]),
};
