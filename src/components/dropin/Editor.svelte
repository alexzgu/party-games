<script lang="ts">
  import Button from '../Button.svelte';
  import ListTools from '../ListTools.svelte';
  import Popup from '../Popup.svelte';
  import Screen from '../Screen.svelte';
  import { slugify, type DropInPack } from '../../lib/content';
  import { matches, sorted, type SortKey } from '../../lib/listing';
  import { cardKey, formatCard, parseCards, type Card, type DropInGame } from '../../lib/dropin/cards';

  let { game, pack, packs, edited, onsave, onremove, onback }: {
    game: DropInGame;
    pack?: DropInPack<Card>;
    packs: DropInPack<Card>[];
    edited: boolean;
    onsave: (pack: DropInPack<Card>) => void;
    onremove: (id: string, restore: boolean) => void;
    onback: () => void;
  } = $props();

  let form = $state<'pack' | 'paste' | 'card'>();
  let index = $state<number>();
  let name = $state('');
  let blurb = $state('');
  let input = $state('');
  let error = $state('');
  let confirm = $state<'restore' | 'delete'>();
  let query = $state('');
  let sort = $state<SortKey>('suggested');
  const cards = $derived(pack?.cards ?? []);
  const visible = $derived(sorted(cards.map((card, i) => ({ text: formatCard(card), i }))
    .filter(({ text }) => matches(text, query)), sort, ({ text }) => text, ({ i }) => i));
  const help = $derived(game === 'warm'
    ? 'Answer: first clue; second clue; third clue; fourth clue; fifth clue'
    : 'side: Choice A | Choice B\nproof: something you can show\nfoley: First line [SOUND] / Next line [SOUND]\ntogether: something to say at once');
  let lastTap = -Infinity;

  function guarded(action: () => void) {
    const now = performance.now();
    if (now - lastTap < 400) return;
    lastTap = now;
    action();
  }

  function open(kind: typeof form, cardIndex?: number) {
    guarded(() => {
      index = cardIndex;
      name = pack?.name ?? '';
      blurb = pack?.blurb ?? '';
      input = cardIndex === undefined ? '' : formatCard(cards[cardIndex]);
      error = '';
      form = kind;
    });
  }

  function saveForm() {
    try {
      const nextName = name.trim();
      if (!nextName) throw new Error('Enter a pack name.');
      let nextCards = [...cards];
      if (!pack || form !== 'pack') {
        const parsed = parseCards(game, input);
        if (!parsed.length) throw new Error('Enter at least one card.');
        if (form === 'card' && parsed.length !== 1) throw new Error('Enter one card here. Use Paste cards for a list.');
        if (index === undefined) nextCards.push(...parsed);
        else nextCards.splice(index, 1, parsed[0]);
        const keys = new Set<string>();
        for (const card of nextCards) {
          const key = cardKey(card);
          if (keys.has(key)) throw new Error(`Repeated card “${formatCard(card).split(': ')[0]}”.`);
          keys.add(key);
        }
      }
      let id = pack?.id ?? slugify(nextName);
      if (!pack) {
        const base = id;
        for (let suffix = 2; packs.some((item) => item.id === id); suffix++) id = `${base}-${suffix}`;
      }
      onsave({ ...pack, id, name: nextName, blurb: blurb.trim(), cards: nextCards });
      form = undefined;
    } catch (problem) {
      error = (problem as Error).message;
    }
  }

  function deleteCard() {
    if (!pack || index === undefined) return;
    onsave({ ...pack, cards: cards.filter((_, i) => i !== index) });
    form = undefined;
  }
</script>

<Screen title={pack?.name ?? 'Make a pack'} {onback}>
  {#if pack}
    <p class="meta">{cards.length} cards{edited ? ' · Edited' : ''}{pack.custom ? ' · Your pack' : ''}</p>
    <div class="actions">
      <Button variant="secondary" size="sm" onclick={() => open('pack')}>Edit pack details</Button>
      {#if edited}<Button variant="secondary" size="sm" onclick={() => { confirm = 'restore'; }}>Restore original</Button>{/if}
      {#if pack.custom}<Button variant="danger" size="sm" onclick={() => { confirm = 'delete'; }}>Delete pack</Button>{/if}
    </div>
    <section>
      <ListTools key={game + ':cards'} bind:query bind:sort shown={visible.length} total={cards.length} placeholder="Search cards">
        {#snippet title()}<h3>Cards</h3>{/snippet}
      </ListTools>
      <ul>
        {#each visible as { text, i } (i)}
          <li><button onclick={() => open('card', i)} aria-label={`Edit card ${i + 1}: ${text}`}>{text}<span aria-hidden="true">✎</span></button></li>
        {:else}
          <li>{query ? 'No matching cards' : 'No cards yet'}</li>
        {/each}
      </ul>
    </section>
  {:else}
    <label>Pack name<input bind:value={name} maxlength="60" /></label>
    <label>Short description<input bind:value={blurb} maxlength="100" /></label>
    <label>Cards<textarea bind:value={input} rows="7" placeholder={help}></textarea></label>
    <p class="meta">Paste one card per line.</p>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  {/if}

  {#snippet actions()}
    {#if pack}
      <div class="actions">
        <Button onclick={() => open('card')}>Add card</Button>
        <Button variant="secondary" onclick={() => open('paste')}>Paste cards</Button>
      </div>
    {:else}
      <Button size="lg" onclick={saveForm}>Save pack</Button>
    {/if}
  {/snippet}
</Screen>

{#if form}
  <Popup title={form === 'pack' ? 'Edit pack details' : form === 'paste' ? 'Paste cards' : index === undefined ? 'Add card' : 'Edit card'}
    onclose={() => { form = undefined; }}>
    <div class="form">
      {#if form === 'pack'}
        <label>Pack name<input bind:value={name} maxlength="60" /></label>
        <label>Short description<input bind:value={blurb} maxlength="100" /></label>
      {:else}
        <label>{form === 'paste' ? 'Cards, one per line' : 'Card'}<textarea bind:value={input} rows="6" placeholder={help}></textarea></label>
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <Button onclick={saveForm}>Save changes</Button>
      {#if index !== undefined && form === 'card'}<Button variant="danger" onclick={deleteCard}>Delete card</Button>{/if}
    </div>
  </Popup>
{/if}

{#if confirm && pack}
  {@const target = pack.id}
  <Popup title={confirm === 'restore' ? 'Restore original?' : 'Delete this pack?'} onclose={() => { confirm = undefined; }}>
    <div class="form">
      <p>{confirm === 'restore' ? 'This replaces your edits with the original pack.' : 'This removes the pack from this device.'}</p>
      <Button variant="danger" onclick={() => { onremove(target, confirm === 'restore'); confirm = undefined; }}>
        {confirm === 'restore' ? 'Restore original' : 'Delete pack'}
      </Button>
    </div>
  </Popup>
{/if}

<style>
  h3, p { margin: 0; }
  .meta { color: var(--text-dim); }
  .error { color: var(--bad-ink); }
  .actions { display: flex; flex-wrap: wrap; gap: var(--s-2); }
  ul { padding: 0; margin: 0; list-style: none; display: grid; gap: var(--s-2); }
  li button { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: var(--s-3); text-align: left;
    overflow-wrap: anywhere; min-height: var(--tap); padding: var(--s-3); color: var(--text); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-sm); }
  li button span { color: var(--accent); }
  .form, label { display: grid; gap: var(--s-3); }
  input, textarea { min-height: 44px; width: 100%; padding: var(--s-3); border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-sunk); color: var(--text); font: inherit; }
  textarea { resize: vertical; }
</style>
