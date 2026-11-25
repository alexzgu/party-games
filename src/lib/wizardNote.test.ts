// The note under Fizzwick's results: shown until "Got it", then never again on this phone, in any game.
import { afterEach, describe, expect, it, vi } from 'vitest';

/** A fresh copy of the note's module (and the settings behind it), reading `storage`. */
async function phone(storage: Pick<Storage, 'getItem' | 'setItem'>) {
  vi.stubGlobal('localStorage', storage);
  vi.resetModules();
  return import('./wizardNote');
}

function memory() {
  const mem = new Map<string, string>();
  return { mem, storage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) } };
}

afterEach(() => vi.unstubAllGlobals());

describe('the wizard note', () => {
  it('shows by default and hides at once after Got it', async () => {
    const note = await phone(memory().storage);
    expect(note.wizardNoteShows()).toBe(true);
    note.hideWizardNote();
    expect(note.wizardNoteShows()).toBe(false);
  });

  it('stays hidden after a reload, through one flag in this phone\'s settings', async () => {
    const { mem, storage } = memory();
    (await phone(storage)).hideWizardNote();
    expect([...mem.keys()]).toEqual(['hr:settings']);
    expect(JSON.parse(mem.get('hr:settings')!).wizardNoteSeen).toBe(true);
    expect((await phone(storage)).wizardNoteShows()).toBe(false);
  });

  it('still shows, and Got it still hides it, when storage throws', async () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    const note = await phone(blocked);
    expect(note.wizardNoteShows()).toBe(true);
    expect(() => note.hideWizardNote()).not.toThrow();
    expect(note.wizardNoteShows()).toBe(false);
    expect((await phone(blocked)).wizardNoteShows()).toBe(true);
  });
});
