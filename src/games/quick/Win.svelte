<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Avatar from './Avatar.svelte';
  import Confetti from './Confetti.svelte';
  import { playerColor } from './ui';
  import { standings, winner, type GameState } from './logic';

  let { game, onrematch, onnew, onhome }: { game: GameState; onrematch: () => void; onnew: () => void; onhome: () => void } = $props();
  const w = $derived(Math.max(0, winner(game)));
  const rows = $derived(standings(game));
</script>

<Confetti count={70} />

<Screen title="Game over" onback={onhome} backLabel="Home" split>
  <div class="split-main">
    <div class="champ" style:--c={playerColor(w)}>
      <span class="trophy pop-in" aria-hidden="true">🏆</span>
      <p class="name pop-in">{game.players[w].name}</p>
      <p class="wins">wins with {game.players[w].score} points after {game.log.length} {game.log.length === 1 ? 'turn' : 'turns'}</p>
    </div>
  </div>
  <div class="split-side">
    <ol class="board" class:two={rows.length > 5} style:--half={Math.ceil(rows.length / 2)} aria-label="Final scores">
      {#each rows as { player, index } (index)}
        <li class:top={index === w}>
          <Avatar name={player.name} {index} size={34} />
          <span class="pname">{player.name}</span>
          <b class="score">{player.score}</b>
        </li>
      {/each}
    </ol>
  </div>

  {#snippet actions()}
    <Button size="lg" onclick={onrematch} tip="Same players and packs, scores back to zero">Rematch</Button>
    <Button variant="secondary" onclick={onnew}>Change players or packs</Button>
    <Button variant="ghost" size="sm" onclick={onhome}>Home</Button>
  {/snippet}
</Screen>

<style>
  .champ { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--s-2); padding: var(--s-4) 0 var(--s-2); }
  .trophy { font-size: 5rem; line-height: 1; filter: drop-shadow(0 10px 30px color-mix(in srgb, var(--c-gold) calc(50% * var(--glow)), transparent)); }
  .name { font-family: var(--font-display); font-weight: 800; font-size: clamp(2.6rem, 15vw, 4.5rem); line-height: 1; color: var(--c); letter-spacing: -0.03em; overflow-wrap: anywhere; animation-delay: 120ms; }
  .wins { color: var(--text-dim); font-size: 1.05rem; }
  .board { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  li { display: flex; align-items: center; gap: var(--s-3); padding: var(--s-2) var(--s-3); border-radius: var(--r-md); background: var(--surface); min-height: 52px; }
  li.top { box-shadow: inset 0 0 0 2px var(--c-gold); }
  .pname { flex: 1; min-width: 0; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .score { font-family: var(--font-display); font-size: 1.5rem; font-variant-numeric: tabular-nums; }
  /* A phone on its side (Screen's split): the scores on the left (six players or more in two
     columns, leader first, down the left, names in place of the avatars); the winner, trophy
     beside the name, and the buttons on the right. */
  @media (orientation: landscape) and (max-height: 500px) {
    .champ { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: var(--s-3); row-gap: var(--s-1); align-items: center; text-align: left; padding: 0; }
    .trophy { grid-row: 1 / 3; font-size: 3.2rem; filter: none; } /* its glow would be cut square by the column's edge */
    .name { font-size: clamp(2rem, 6vw, 3rem); }
    .wins { font-size: 1rem; }
    .board { gap: 6px; }
    li { min-height: 44px; padding: 4px var(--s-3) 4px var(--s-2); }
    .two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(var(--half), auto); grid-auto-flow: column; column-gap: var(--s-2); }
    .two li { gap: var(--s-2); padding-left: var(--s-3); }
    .two :global(.avatar) { display: none; }
  }
</style>
