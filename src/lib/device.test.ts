import { describe, expect, it } from 'vitest';
import { deviceOf, soundHint, vibrationHint } from './device';

describe('device', () => {
  it('tells iPhone, iPad (even posing as a Mac), Android and the rest apart', () => {
    expect(deviceOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari', 5)).toBe('iphone');
    expect(deviceOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 5)).toBe('ipad');
    expect(deviceOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 0)).toBe('other');
    expect(deviceOf('Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome Mobile', 5)).toBe('android');
    expect(deviceOf('Mozilla/5.0 (X11; Linux x86_64) Firefox', 0)).toBe('other');
  });

  it('only mentions what applies to the device', () => {
    expect(soundHint('iphone')).toMatch(/silent switch/);
    expect(soundHint('android')).toBeUndefined();
    expect(vibrationHint('android')).not.toMatch(/iPhone/);
    expect(vibrationHint('iphone')).not.toMatch(/Android/);
  });
});
