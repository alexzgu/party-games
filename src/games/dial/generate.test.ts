import { describe, expect, it } from 'vitest';
import { buildPrompt, parsePair } from './generate';

describe('parsePair', () => {
  it('reads the requested format', () => {
    expect(parsePair('Cold | Hot')).toEqual({ left: 'Cold', right: 'Hot' });
    expect(parsePair('bad movie|good movie')).toEqual({ left: 'Bad movie', right: 'Good movie' });
  });

  it('tolerates list markers, bold, quotes, tables and other separators', () => {
    expect(parsePair('1. **Underrated** | **Overrated**')).toEqual({ left: 'Underrated', right: 'Overrated' });
    expect(parsePair('- "Quiet" | "Loud".')).toEqual({ left: 'Quiet', right: 'Loud' });
    expect(parsePair('| Cheap | Expensive |')).toEqual({ left: 'Cheap', right: 'Expensive' });
    expect(parsePair('Soft vs. Hard')).toEqual({ left: 'Soft', right: 'Hard' });
    expect(parsePair('Tiny — Huge')).toEqual({ left: 'Tiny', right: 'Huge' });
    expect(parsePair('Low-key ↔ Extra')).toEqual({ left: 'Low-key', right: 'Extra' });
  });

  it('keeps apostrophes that belong to a word and strips "Card N:" prefixes', () => {
    expect(parsePair("'90s kid | Gen Z kid")).toEqual({ left: "'90s kid", right: 'Gen Z kid' });
    expect(parsePair("'Quiet' | 'Loud'")).toEqual({ left: 'Quiet', right: 'Loud' });
    expect(parsePair("Card 1: Cold | Hot")).toEqual({ left: 'Cold', right: 'Hot' });
    expect(parsePair("Rock 'n' roll | Classical")).toEqual({ left: "Rock 'n' roll", right: 'Classical' });
  });

  it('keeps hyphens and slashes inside an end', () => {
    expect(parsePair('Lo-fi | Hi-fi')).toEqual({ left: 'Lo-fi', right: 'Hi-fi' });
    expect(parsePair('AC/DC fan | Taylor Swift fan')).toEqual({ left: 'AC/DC fan', right: 'Taylor Swift fan' });
  });

  it('rejects chatter, headers, echoes and broken rows', () => {
    for (const line of ['Here are 20 cards:', '## Food', 'Left | Right', '---|---', 'A | B | C', 'Same | same', 'Just one end', '']) {
      expect(parsePair(line)).toBeNull();
    }
  });
});

describe('buildPrompt', () => {
  it('lists existing cards to avoid', () => {
    const p = buildPrompt('Food', [{ left: 'Bland', right: 'Spicy' }]);
    expect(p).toContain('Theme: Food');
    expect(p).toContain('Bland | Spicy');
  });
});
