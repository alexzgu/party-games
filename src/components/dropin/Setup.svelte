<script lang="ts">
  import Button from '../Button.svelte';
  import HowTo from '../HowTo.svelte';
  import ListTools from '../ListTools.svelte';
  import Screen from '../Screen.svelte';
  import { packAge, type DropInPack } from '../../lib/content';
  import { matches, sorted, type SortKey } from '../../lib/listing';
  import { back } from '../../lib/router.svelte';
  import { formatCard, isWarm, roomTypes, type Card, type DropInGame } from '../../lib/dropin/cards';
  import type { Options } from '../../lib/dropin/session';

  let { game, title, packs, options, resumed, onchange, onplay, onedit, onnew }: {
    game: DropInGame;
    title: string;
    packs: DropInPack<Card>[];
    options: Options;
    resumed: boolean;
    onchange: (options: Options) => void;
    onplay: (resume: boolean) => void;
    onedit: (pack: DropInPack<Card>) => void;
    onnew: () => void;
  } = $props();

  let query = $state('');
  let sort = $state<SortKey>('suggested');
  const visible = $derived(sorted(packs.flatMap((pack) => {
    if (matches(pack.name + ' ' + pack.blurb, query)) return [{ pack, hit: '' }];
    const card = pack.cards.find((card) => matches(formatCard(card), query));
    return card ? [{ pack, hit: isWarm(card) ? card.answer : formatCard(card) }] : [];
  }), sort, ({ pack }) => pack.name, ({ pack }) => packAge(pack)));
  const ready = $derived(packs.some((pack) => options.packs.includes(pack.id) &&
    pack.cards.some((card) => isWarm(card) || options.types.includes(card.type))));

  let lastTap = -Infinity;
  function guarded(action: () => void) {
    const now = performance.now();
    if (now - lastTap < 400) return;
    lastTap = now;
    action();
  }

  function toggle<T>(items: T[], item: T): T[] {
    return items.includes(item) ? items.filter((value) => value !== item) : [...items, item];
  }
</script>

<Screen {title} onback={() => back('/')}>
  {#snippet trailing()}
    <HowTo>
      {#if game === 'warm'}
        <ol>
          <li>Read the newest clue aloud. Everyone can shout a guess at any time.</li>
          <li>Tap the card for another clue, or set clues to appear automatically.</li>
          <li>Tap Reveal to settle it, then deal another card whenever the room is ready.</li>
        </ol>
      {:else}
        <ul>
          <li><b>Pick a side:</b> Point to your choice together, then make your case.</li>
          <li><b>Show proof:</b> Find something in the room or on you. Tap to end the search early.</li>
          <li><b>Make sounds:</b> Read each line aloud. Everyone joins in on the highlighted sounds.</li>
          <li><b>Say it together:</b> Think of an answer and shout it on cue. See who matched.</li>
        </ul>
      {/if}
    </HowTo>
  {/snippet}

  <section>
    <ListTools key={game + ':packs'} bind:query bind:sort shown={visible.length} total={packs.length} placeholder="Search packs">
      {#snippet title()}<h3>Packs</h3>{/snippet}
    </ListTools>
    <div class="packs">
      {#each visible as { pack, hit } (pack.id)}
        <div class="pack" class:selected={options.packs.includes(pack.id)}>
          <button class="pick" aria-pressed={options.packs.includes(pack.id)}
            onclick={() => guarded(() => onchange({ ...options, packs: toggle(options.packs, pack.id) }))}>
            <span class="check" aria-hidden="true">{options.packs.includes(pack.id) ? '✓' : '+'}</span>
            <span>
              <strong>{pack.name}</strong>
              <small>{pack.cards.length} cards · {hit ? `has “${hit}”` : pack.blurb}</small>
            </span>
          </button>
          <button class="open" aria-label={`View pack ${pack.name}`} onclick={() => guarded(() => onedit(pack))}>✎</button>
        </div>
      {:else}
        <p>No matching packs</p>
      {/each}
    </div>
    <button class="make" onclick={() => guarded(onnew)}>+ Make a pack</button>
  </section>

  <fieldset>
    <legend>{game === 'warm' ? 'Automatic clues' : 'Card types'}</legend>
    <div class="chips">
      {#if game === 'warm'}
        {#each [0, 8, 15] as seconds}
          <button aria-pressed={options.drip === seconds}
            onclick={() => guarded(() => onchange({ ...options, drip: seconds as Options['drip'] }))}>
            {seconds ? `Every ${seconds} s` : 'Off'}
          </button>
        {/each}
      {:else}
        {#each roomTypes as { type, label }}
          <button aria-pressed={options.types.includes(type)}
            onclick={() => guarded(() => onchange({ ...options, types: toggle(options.types, type) }))}>{label}</button>
        {/each}
      {/if}
    </div>
  </fieldset>

  {#snippet actions()}
    {#if resumed}<Button size="lg" onclick={() => onplay(true)}>Resume</Button>{/if}
    <Button size={resumed ? 'md' : 'lg'} variant={resumed ? 'secondary' : 'primary'} disabled={!ready} onclick={() => onplay(false)}>
      {resumed ? 'Start a new deck' : 'Start'}
    </Button>
  {/snippet}
</Screen>

<style>
  h3 { margin: 0; }
  .packs { display: grid; gap: var(--s-2); }
  .pack { display: flex; border: 1px solid var(--line); background: var(--surface); border-radius: var(--r-md); }
  .selected { border-color: var(--accent); }
  .pick, .open, .make { color: var(--text); background: transparent; border: 0; min-height: var(--tap); }
  .pick { flex: 1; display: flex; align-items: center; gap: var(--s-3); padding: var(--s-2) var(--s-3); text-align: left; min-width: 0; }
  .check { color: var(--accent); width: 1.4em; flex: none; font-weight: 800; }
  small { display: block; color: var(--text-dim); overflow-wrap: anywhere; }
  .open { min-width: 52px; color: var(--accent); font-size: 1.35rem; border-left: 1px solid var(--line); }
  .make { color: var(--accent); padding-inline: var(--s-3); font-weight: 700; }
  fieldset { padding: 0; margin: 0; border: 0; }
  legend { padding: 0; margin-bottom: var(--s-2); font-weight: 700; }
  .chips { display: flex; flex-wrap: wrap; gap: var(--s-2); }
  .chips button { min-height: 44px; padding-inline: var(--s-3); border: 1px solid var(--line); border-radius: var(--r-pill); color: var(--text-dim); background: var(--surface); }
  .chips button[aria-pressed='true'] { color: var(--text); border-color: var(--accent); background: color-mix(in srgb, var(--accent) 17%, var(--surface)); }
</style>
