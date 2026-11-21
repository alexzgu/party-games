<script lang="ts">
  import type { PackGameId } from '../app.config';

  // A Community pack's contents before it is imported, as plain text in a simple list per game
  // (Snark Tank: with each prompt's stock answer, then its finals). The items come from strangers'
  // phones, already rebuilt field by field (libraryShape.ts); each field is still read as text.
  let { game, items, extra = {} }: { game: PackGameId; items: unknown[]; extra?: Record<string, unknown> } = $props();

  const t = (x: unknown): string => (typeof x === 'string' ? x : '');
  const obj = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {});
  const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
  const stock = $derived(obj(extra.safety));
  const finals = $derived(list(extra.finals));
</script>

{#if game === 'quiz'}
  {#each items as c, i (i)}
    <section class="cat">
      <h4>{t(obj(c).name) || `Category ${i + 1}`}</h4>
      <ol class="list">
        {#each list(obj(c).clues) as k, r (r)}
          {#if t(obj(k).clue).trim()}
            <li class="row"><span>{t(obj(k).clue)}</span><span class="answer">{t(obj(k).answer)}</span></li>
          {/if}
        {/each}
      </ol>
    </section>
  {/each}
{:else}
  <ul class="list" class:words={game === 'forehead'}>
    {#each items as x, i (i)}
      {@const o = obj(x)}
      {#if game === 'forehead'}<li class="word">{t(x)}</li>
      {:else if game === 'dial'}<li class="row line">{t(o.left)} <span class="sep" aria-label="to">↔</span> {t(o.right)}</li>
      {:else if game === 'gibberish'}<li class="row"><span>{t(o.phrase)}</span><span class="answer">→ {t(o.answer)}{#if t(o.hint)} · {t(o.hint)}{/if}</span></li>
      {:else if game === 'quick'}<li class="row line"><span class="dim">Name 3</span> {t(x)}</li>
      {:else if game === 'taboo'}<li class="row"><span>{t(o.word)}</span><span class="answer">{list(o.banned).map(t).join(' · ')}</span></li>
      {:else if game === 'snark'}<li class="row"><span>{t(x)}</span>{#if t(stock[t(x)])}<span class="answer">Give me one: {t(stock[t(x)])}</span>{/if}</li>
      {:else}<li class="row line">{t(x)}</li>
      {/if}
    {/each}
  </ul>
  {#if game === 'snark' && finals.length}
    <h4 class="finals">{finals.length} {finals.length === 1 ? 'final' : 'finals'} for three-line duels</h4>
    <ul class="list">
      {#each finals as f, i (i)}
        <li class="row"><span>{t(obj(f).prompt)}</span><span class="answer">House: {list(obj(f).house).map(t).join(' · ')}</span></li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-1); }
  .list.words { flex-direction: row; flex-wrap: wrap; gap: 6px; }
  .word { padding: 6px var(--s-3); border-radius: var(--r-pill); background: var(--surface); font-family: var(--font-display); font-weight: 700; }
  .row {
    display: flex; flex-direction: column; gap: 2px; padding: var(--s-2) var(--s-3); border-radius: var(--r-md);
    background: var(--surface); overflow-wrap: anywhere; line-height: 1.3;
  }
  .line { display: block; }
  .answer, .dim { color: var(--text-dim); font-size: 0.9rem; }
  .sep { color: var(--accent); padding: 0 2px; }
  .cat { display: flex; flex-direction: column; gap: var(--s-1); }
  .cat h4, .finals { margin: var(--s-2) 0 0; font-size: 1rem; }
</style>
