import { describe, expect, it, vi } from 'vitest';
import type { SnarkPack } from '../../lib/content';

// A fake wizard: records each request and answers with the lines `reply` holds.
const sent: { system: string; prompt: string }[] = [];
let reply: string[] = [];
vi.mock('../../lib/claude', async (real) => ({
  ...(await real<typeof import('../../lib/claude')>()),
  streamLines: async (o: { system: string; prompt: string; onLine: (l: string) => void }) => {
    sent.push(o);
    reply.forEach(o.onLine);
  },
}));

const { buildPrompt, fillStock, finalsFor, generateItems, moreItems, readItem, SYSTEM, toFill } = await import('./generate');
const { addItems, addStock, removePrompt, setPrompt } = await import('./pack');

describe('Snark Tank wizard lines', () => {
  it('reads a prompt with its stock answer, tidied to sentence case without end punctuation', () => {
    expect(readItem('1. "the worst thing to hear from your Uber driver?" | **we\'re taking the scenic route.**')).toEqual(
      { kind: 'prompt', prompt: 'The worst thing to hear from your Uber driver', safety: "We're taking the scenic route" });
  });

  it('reads a final with exactly three house lines', () => {
    expect(readItem('Final: Three things you should never say to your landlord | I have a snake now | Smell that? | Rent is a construct')).toEqual(
      { kind: 'final', prompt: 'Three things you should never say to your landlord', house: ['I have a snake now', 'Smell that?', 'Rent is a construct'] });
  });

  it('drops lines that break the rules', () => {
    expect(readItem('A terrible name for a boat')).toBeNull(); // no stock answer
    expect(readItem('Boat names | The Unsinkable II')).toBeNull(); // prompt under 3 words
    expect(readItem(`${'very '.repeat(14)}long prompt | Yes`)).toBeNull(); // over 14 words
    expect(readItem('A terrible name for a boat | one two three four five six seven eight nine')).toBeNull(); // stock over 8 words
    expect(readItem('Final: Things you should never say to a pilot | Oops | Where are we | Hold my drink')).toBeNull(); // not "Three …"
    expect(readItem('Final: Three things you should never say to a pilot | Oops | Hold my drink')).toBeNull(); // two lines
    expect(readItem('Final: Three things you should never say to a pilot | Oops | one two three four five six seven | Hold my drink')).toBeNull(); // over 6 words
    expect(readItem('Prompt | Stock answer')).toBeNull();
  });

  it('asks for the prompts, about one final per five, the rules and every prompt already used', () => {
    expect([10, 15, 30, 3].map(finalsFor)).toEqual([2, 3, 6, 1]);
    const p = buildPrompt('Roommates', 30, 6, ['A terrible name for a boat']);
    expect(p).toContain('The player asks for: Roommates');
    expect(p).toContain('Write 30 prompts with stock answers and 6 finals');
    expect(p).toMatch(/already in use[^\n]*\nA terrible name for a boat$/);
    expect(SYSTEM).toMatch(/3 to 14 words, sentence case, no punctuation at the end/);
    expect(SYSTEM).toMatch(/Stock answers[^\n]*1 to 8 words/);
    expect(SYSTEM).toMatch(/starts with "Three"[^\n]*1 to 6 words \(at most 40 characters\)/);
  });
});

describe('Snark Tank wizard streams', () => {
  it('keeps new prompts and finals up to their own counts, never one already used', async () => {
    reply = [
      'A terrible name for a boat | The Unsinkable II', // used in another pack
      'The worst chore to get stuck with | Cleaning the hair trap',
      'Final: Three rules for a shared fridge | Label everything | No touching my yogurt | Smell first',
      'Final: Three signs your roommate is a vampire | Never at brunch | Owns a coffin | Hates garlic bread',
      'What your roommate does when you leave | Wears your clothes',
      'A passive aggressive note on the fridge | Who ate my soup',
      'THE WORST CHORE TO GET STUCK WITH | Dishes', // a repeat
    ];
    const got: string[] = [];
    await generateItems({ theme: 'Roommates', count: 2, avoid: ['a terrible name for a boat'], onItem: (i) => got.push(`${i.kind}: ${i.prompt}`) });
    expect(got).toEqual(['prompt: The worst chore to get stuck with', 'final: Three rules for a shared fridge', 'prompt: What your roommate does when you leave']);
  });

  it('"Add more" never repeats a prompt or final of this pack, of other packs or on screen', async () => {
    reply = ['A rule for the group chat | No voice notes', 'Final: Three rules for a shared fridge | Label it | Mine | Ours', 'The worst chore to get stuck with | Dishes', 'A new house rule nobody asked for | Shoes off, socks off'];
    const pack: SnarkPack = { id: 'mine', name: 'Home', blurb: '12 prompts', prompts: ['A rule for the group chat'], finals: [{ prompt: 'Three rules for a shared fridge', house: ['a', 'b', 'c'] }] };
    const got: string[] = [];
    await moreItems(pack, ['The worst chore to get stuck with'], { count: 5, steer: '', avoid: [], onItem: (i) => got.push(i.prompt) });
    const prompt = sent.at(-1)!.prompt;
    expect(prompt).toContain('Write 5 more prompts with stock answers and 1 final');
    expect(prompt).not.toContain('About:');
    expect(prompt).toMatch(/Already in the pack[^\n]*\nA rule for the group chat\nThree rules for a shared fridge/);
    expect(got).toEqual(['A new house rule nobody asked for']);
  });

  it('"Fill in stock answers" asks only for missing ones and matches answers back to the pack\'s prompts', async () => {
    const pack: SnarkPack = { id: 'p', name: 'Pasted', blurb: 'Pasted list', prompts: ['A bad name for a dog?', 'A rule for the group chat', 'The worst first date idea'], safety: { 'A rule for the group chat': 'No voice notes' } };
    expect(toFill(pack)).toEqual(['A bad name for a dog?', 'The worst first date idea']);
    reply = ['a bad name for a dog | Sir Barksalot', 'A prompt nobody asked about | Hm', 'The worst first date idea | Splitting a single grape', 'A rule for the group chat | Ignored'];
    const got: { prompt: string; safety: string }[] = [];
    await fillStock(pack, { count: 1, steer: 'sillier', avoid: [], onItem: (s) => got.push(s) });
    expect(sent.at(-1)!.prompt).toMatch(/these 2 prompts:\nA bad name for a dog\?\nThe worst first date idea\n\nThe player asks for: sillier$/);
    expect(got).toEqual([{ prompt: 'A bad name for a dog?', safety: 'Sir Barksalot' }, { prompt: 'The worst first date idea', safety: 'Splitting a single grape' }]);
    expect(toFill(pack, got.slice(0, 1))).toEqual(['The worst first date idea']);
  });
});

describe('Snark pack changes', () => {
  const base: SnarkPack = { id: 'p', name: 'P', blurb: '', prompts: ['Old prompt here'], safety: { 'Old prompt here': 'Old answer' } };

  it('puts kept prompts with their stock answers and kept finals on top, skipping ones the pack has', () => {
    const next = addItems(base, [
      { kind: 'prompt', prompt: 'New prompt here', safety: 'New answer' },
      { kind: 'prompt', prompt: 'old prompt HERE', safety: 'Dupe' },
      { kind: 'final', prompt: 'Three new things', house: ['a', 'b', 'c'] },
    ]);
    expect(next.prompts).toEqual(['New prompt here', 'Old prompt here']);
    expect(next.safety).toEqual({ 'New prompt here': 'New answer', 'Old prompt here': 'Old answer' });
    expect(next.finals).toEqual([{ prompt: 'Three new things', house: ['a', 'b', 'c'] }]);
  });

  it('fills only missing stock answers; edits move a stock answer with its prompt; deletes drop it', () => {
    expect(addStock(base, [{ prompt: 'Old prompt here', safety: 'Other' }]).safety).toEqual({ 'Old prompt here': 'Old answer' });
    expect(setPrompt(base, 0, 'Reworded prompt here', 'Old answer').safety).toEqual({ 'Reworded prompt here': 'Old answer' });
    expect(setPrompt(base, 0, 'Old prompt here', '').safety).toBeUndefined();
    expect(setPrompt(base, 'new', 'Another prompt here', '').prompts).toEqual(['Another prompt here', 'Old prompt here']);
    expect(removePrompt(base, 0)).toEqual({ id: 'p', name: 'P', blurb: '', prompts: [] });
  });
});
