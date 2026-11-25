<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Avatar from './Avatar.svelte';
  import { sfx } from '../../lib/sound';
  import type { GameState } from './logic';

  // The room points out loud; the phone records the one name the room settles on.
  let { game, onpick, onleave }: { game: GameState; onpick: (seat: number) => void; onleave: () => void } = $props();
  let chosen = $state(-1);

  function choose(i: number) {
    chosen = i;
    sfx.tap();
  }
</script>

<Screen title={gameName('odd')} onback={onleave} backLabel="Back to setup">
  <div class="vote">
    <p class="ask">Count to three and point. Who does the room pick?</p>
    <ul class="players" role="radiogroup" aria-label="The room's pick">
      {#each game.players as p, i (i)}
        <li>
          <button role="radio" aria-checked={chosen === i} class:on={chosen === i} onclick={() => choose(i)}>
            <Avatar name={p.name} index={i} size={32} />
            <span class="pname">{p.name}</span>
            <span class="mark" aria-hidden="true">{chosen === i ? '👉' : ''}</span>
          </button>
        </li>
      {/each}
    </ul>
  </div>

  {#snippet actions()}
    <Button size="lg" disabled={chosen < 0} onclick={() => onpick(chosen)}>{chosen < 0 ? 'Pick one' : 'Confirm'}</Button>
  {/snippet}
</Screen>

<style>
  .vote { display: flex; flex-direction: column; gap: var(--s-3); }
  .ask { font-family: var(--font-display); font-weight: 800; font-size: 1.5rem; line-height: 1.15; text-align: center; padding-top: var(--s-2); }
  .players { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  button {
    width: 100%; min-height: var(--tap); display: flex; align-items: center; gap: var(--s-3); padding: var(--s-2) var(--s-3);
    border-radius: var(--r-md); border: 2px solid var(--line); background: var(--surface); color: var(--text); text-align: left;
  }
  button.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, var(--surface)); }
  .pname { flex: 1; min-width: 0; font-weight: 800; font-size: 1.15rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mark { width: 1.5em; font-size: 1.3rem; text-align: center; }
</style>
