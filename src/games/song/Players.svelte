<script lang="ts">
  import Avatar from './Avatar.svelte';
  import { checkName, MIN_PLAYERS } from './logic';
  import { sfx } from '../../lib/sound';

  // Add and remove players. The order is only for the scoreboard.
  let { names = $bindable() }: { names: string[] } = $props();
  let draft = $state('');
  let error = $state('');
  let input: HTMLInputElement;

  function add(e: SubmitEvent) {
    e.preventDefault();
    const { name, error: why } = checkName(draft, names);
    error = why;
    if (why) return;
    names = [...names, name];
    draft = '';
    sfx.tap();
    input.focus();
  }

  function removeAt(i: number) {
    names = names.filter((_, k) => k !== i);
    error = '';
  }
</script>

<section class="players" aria-labelledby="players-h">
  <div class="head">
    <h3 id="players-h">Players</h3>
    <span class="count" class:short={names.length < MIN_PLAYERS}>{names.length} {#if names.length < MIN_PLAYERS}· need {MIN_PLAYERS}+{/if}</span>
  </div>
  {#if names.length}
    <ul class="list">
      {#each names as name, i (name)}
        <li class="pop-in">
          <Avatar {name} index={i} size={32} />
          <span class="name">{name}</span>
          <button class="x" onclick={() => removeAt(i)} aria-label="Remove {name}">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <form class="add" onsubmit={add}>
    <input
      bind:this={input}
      bind:value={draft}
      type="text"
      placeholder={names.length ? 'Add another player' : 'First player’s name'}
      aria-label="Player name"
      autocomplete="off" autocapitalize="words" enterkeyhint="done" maxlength="18"
      oninput={() => (error = '')}
    />
    <button type="submit" class="plus" aria-label="Add player" disabled={!draft.trim()}>Add</button>
  </form>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
  .players { display: flex; flex-direction: column; gap: var(--s-2); }
  .head { display: flex; align-items: baseline; justify-content: space-between; }
  .count { color: var(--text-faint); font-weight: 600; font-size: 0.9rem; }
  .count.short { color: var(--c-pass); }
  .list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-2); }
  li { display: flex; align-items: center; gap: var(--s-2); padding: 6px 4px 6px 8px; border-radius: var(--r-md); background: var(--surface); min-height: 52px; }
  .name { flex: 1; min-width: 0; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .x { width: 44px; height: 44px; flex: none; border: 0; border-radius: var(--r-pill); background: transparent; color: var(--text-faint); display: grid; place-items: center; }
  .x:active { background: var(--surface-hi); }
  .add { display: flex; gap: var(--s-2); }
  .plus { flex: none; min-width: 84px; border-radius: var(--r-md); border: 0; background: var(--accent); color: var(--on-accent); font-weight: 800; font-family: var(--font-display); font-size: 1.05rem; }
  .plus:disabled { background: var(--surface); color: var(--text-faint); }
  .error { color: var(--c-pass); font-size: 0.95rem; }
</style>
