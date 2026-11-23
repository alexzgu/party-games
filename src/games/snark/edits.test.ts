// Typed changes land on the pack as saved now, whatever another tab did to it meanwhile.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { customSnark, type SnarkFinal, type SnarkPack } from '../../lib/content';
import { NO_ROOM } from '../../lib/packfile';
import { changeFinal, changePrompt, changeSaved, GONE } from './edits';

const final = (prompt: string): SnarkFinal => ({ prompt, house: ['Iceberg', 'Oops', 'Swim?'] });
const boat = final('Three things to never say on a boat'), pet = final('Three bad pets to get');
const pack: SnarkPack = { id: 'my-boats', name: 'Boats', blurb: '', prompts: ['A bad name for a boat'], safety: { 'A bad name for a boat': 'Floaty' }, finals: [boat] };
const saved = () => customSnark.saved().find((p) => p.id === pack.id);
let full: boolean;

beforeEach(() => {
  const mem = new Map<string, string>();
  full = false;
  const setItem = (k: string, v: string) => { if (full) throw new Error('full'); mem.set(k, v); };
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem, removeItem: (k: string) => mem.delete(k) });
  customSnark.put(pack);
});
afterEach(() => vi.unstubAllGlobals());

describe('changing a saved pack', () => {
  it('keeps what another tab saved meanwhile', () => {
    changeSaved(pack.id, changeFinal(null, pet)); // the other tab
    expect(changeSaved(pack.id, changeFinal(boat, final('Three things to say on a boat'))).problem).toBe('');
    expect(saved()?.finals?.map((f) => f.prompt)).toEqual([pet.prompt, 'Three things to say on a boat']);
    changeSaved(pack.id, changePrompt(null, { text: 'A bad pet', stock: '' }));
    expect(changeSaved(pack.id, changePrompt({ text: 'A bad name for a boat', stock: 'Floaty' }, { text: 'A good boat name', stock: 'Boaty' })).problem).toBe('');
    expect([saved()?.prompts, saved()?.safety]).toEqual([['A bad pet', 'A good boat name'], { 'A good boat name': 'Boaty' }]);
  });

  it('changes nothing when the item itself was changed or deleted elsewhere, or the pack already has the new one', () => {
    changeSaved(pack.id, changeFinal(boat, pet));
    changeSaved(pack.id, changePrompt({ text: 'A bad name for a boat', stock: 'Floaty' }, { text: 'A bad name for a boat', stock: 'Boaty' }));
    const before = saved();
    for (const change of [changeFinal(boat, boat), changeFinal(boat, null), changePrompt({ text: 'A bad name for a boat', stock: 'Floaty' }, null)]) {
      expect(changeSaved(pack.id, change)).toEqual({ pack: before, problem: expect.stringMatching(/changed or deleted somewhere else/) });
    }
    expect(changeSaved(pack.id, changeFinal(null, pet)).problem).toMatch(/already/);
    expect(changeSaved(pack.id, changePrompt(null, { text: 'a bad name for a BOAT', stock: '' })).problem).toMatch(/already/);
    expect(changeSaved(pack.id, changePrompt(null, { text: pet.prompt, stock: '' })).problem).toMatch(/already/);
    expect(saved()).toEqual(before);
  });

  it('never brings a deleted pack back', () => {
    customSnark.remove(pack.id);
    expect(changeSaved(pack.id, changeFinal(boat, pet))).toEqual({ pack: null, problem: GONE });
    expect(saved()).toBeUndefined();
  });

  it('says so when there is no room, and deletes when asked', () => {
    full = true;
    expect(changeSaved(pack.id, changeFinal(boat, pet)).problem).toBe(NO_ROOM);
    expect(saved()?.finals).toEqual([boat]);
    full = false;
    expect(changeSaved(pack.id, changeFinal(boat, null)).pack?.finals).toBeUndefined();
    expect(changeSaved(pack.id, changePrompt({ text: 'A bad name for a boat', stock: 'Floaty' }, null)).pack).toMatchObject({ prompts: [] });
  });
});
