<script lang="ts">
  import Button from '../../components/Button.svelte';
  import FitText from '../../components/FitText.svelte';
  import Confetti from './Confetti.svelte';
  import RevealVideo from './RevealVideo.svelte';
  import { playerColor } from './ui';
  import { art, type Track } from './match';
  import { winner, type GameState } from './logic';

  // Shown to the whole room: who got it, the song big with its album art, and the song playing on.
  // A song with a YouTube video shows the video itself, uncovered, with YouTube's own controls.
  let { game, track, playing, demo = false, onhear, onstop, onnext, onundo }: {
    game: GameState;
    /** The song's Apple Music track (art and link); null while unknown. */
    track: Track | null;
    /** The preview is playing on. */
    playing: boolean;
    demo?: boolean;
    onhear: () => void;
    onstop: () => void;
    onnext: () => void;
    onundo: () => void;
  } = $props();

  const outcome = $derived(game.outcome!);
  const scorer = $derived(outcome.kind === 'point' ? outcome.scorer : -1);
  const won = $derived(winner(game) >= 0);
  const video = $derived(game.song?.youtube ?? '');
  const cover = $derived(track?.artwork ? art(track.artwork, 600) : '');
</script>

{#if scorer >= 0}<Confetti />{/if}

<header class="banner" style:--c={scorer >= 0 ? playerColor(scorer) : 'var(--text-dim)'}>
  {#if outcome.kind === 'point'}
    <span class="big pop-in">🎉 {game.players[scorer].name} <b>+{outcome.points}</b></span>
  {:else}
    <span class="big">🤷 Nobody got it</span>
  {/if}
</header>

<div class="media" class:wide={!!video}>
  {#if video}
    <RevealVideo id={video} {demo} onplay={onstop} />
  {:else if cover}
    <img class="art pop-in" src={cover} alt="Album art for {game.song?.title}" />
  {:else}
    <div class="art blank" aria-hidden="true"><span>♪</span></div>
  {/if}
</div>

<div class="body">
  <section class="answer pop-in" aria-label="The song">
    {#if video && cover}<img class="thumb" src={art(track!.artwork, 200)} alt="" />{/if}
    <div class="names">
      <div class="fit"><FitText text={game.song?.title ?? ''} max={84} min={24} /></div>
      <p class="artist">{game.song?.artist}</p>
    </div>
  </section>

  <div class="music">
    {#if playing}
      <button class="pill" onclick={onstop}><span aria-hidden="true">■</span> Stop the music</button>
    {:else}
      <button class="pill" onclick={onhear}><span aria-hidden="true">▶</span> Hear it again</button>
    {/if}
    {#if track?.link}
      <a class="apple" href={track.link} target="_blank" rel="noopener noreferrer">Listen on Apple Music <span aria-hidden="true">↗</span></a>
    {/if}
  </div>

  <div class="acts">
    <Button size="lg" onclick={onnext}>{won ? '🏆 See who won' : 'Scores →'}</Button>
    <Button variant="ghost" size="sm" onclick={onundo}>{scorer >= 0 ? 'Wrong name? Undo' : 'Undo, back to the song'}</Button>
  </div>
</div>

<style>
  .banner { order: 0; text-align: center; padding: var(--s-2) 0; min-height: 56px; display: grid; place-items: center; }
  .big { display: inline-block; font-family: var(--font-display); font-weight: 800; font-size: 1.9rem; color: var(--c); line-height: 1.1; }
  .big b { color: var(--c-gold); }
  .media { order: 1; display: grid; place-items: center; width: 100%; max-width: 560px; margin: 0 auto; }
  .art {
    width: min(64vw, 30dvh, 300px); aspect-ratio: 1; border-radius: var(--r-lg); object-fit: cover;
    box-shadow: var(--shadow); border: 2px solid color-mix(in srgb, var(--c-gold) 50%, transparent); background: var(--bg-sunk);
  }
  .blank { display: grid; place-items: center; font-size: 4rem; color: var(--accent); background: radial-gradient(circle, color-mix(in srgb, var(--accent) 30%, var(--bg-raised)), var(--bg-sunk)); }
  .body { order: 2; display: flex; flex-direction: column; gap: var(--s-3); padding-bottom: calc(var(--safe-bottom) + var(--s-3)); }
  .answer {
    display: flex; align-items: center; gap: var(--s-3);
    padding: var(--s-3) var(--s-4); border-radius: var(--r-lg);
    background: radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--c-gold) 22%, transparent), transparent 70%), var(--bg-raised);
    border: 2px solid color-mix(in srgb, var(--c-gold) 60%, transparent);
  }
  .thumb { width: 72px; height: 72px; border-radius: var(--r-md); flex: none; object-fit: cover; }
  .names { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: var(--s-1); }
  .fit { width: 100%; height: 96px; color: var(--c-gold); }
  .wide + .body .fit { height: 72px; }
  .artist { font-family: var(--font-display); font-weight: 700; font-size: 1.3rem; color: var(--text); text-align: center; }
  .music { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: var(--s-2) var(--s-4); }
  .pill {
    min-height: 48px; padding: 0 var(--s-4); border-radius: var(--r-pill); border: 1.5px solid var(--line-strong);
    background: var(--surface); color: var(--text); font-weight: 700; display: inline-flex; align-items: center; gap: var(--s-2);
  }
  .pill:active { transform: scale(0.97); }
  .apple { color: var(--accent); font-weight: 700; min-height: 44px; display: inline-flex; align-items: center; gap: 4px; text-decoration: none; }
  .apple:hover { text-decoration: underline; }
  .acts { display: flex; flex-direction: column; align-items: center; gap: var(--s-1); }
  @media (min-width: 900px) and (orientation: landscape) {
    .art { width: min(100%, 62dvh); }
  }
</style>
