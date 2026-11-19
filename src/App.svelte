<script lang="ts">
  import { route } from './lib/router.svelte';
  import { GAMES } from './app.config';
  import Home from './pages/Home.svelte';
  import Settings from './pages/Settings.svelte';
  import History from './pages/History.svelte';
  import Crashed from './pages/Crashed.svelte';

  // Games load on demand; the service worker has them cached, so this is instant offline too.
  const games: Record<string, () => Promise<{ default: any }>> = {
    forehead: () => import('./games/forehead/Game.svelte'),
    dial: () => import('./games/dial/Game.svelte'),
    gibberish: () => import('./games/gibberish/Game.svelte'),
    quiz: () => import('./games/quiz/Game.svelte'),
  };

  const segment = $derived(route.path.split('/').filter(Boolean)[0] ?? '');

  // The page glow and every default accent follow the game on screen.
  $effect(() => {
    const game = GAMES.find((g) => g.id === segment);
    document.documentElement.style.setProperty('--accent', game ? game.accent : 'var(--c-gibberish)');
  });
</script>

{#if segment === '' }
  <Home />
{:else if segment === 'settings'}
  <Settings />
{:else if segment === 'history'}
  <History />
{:else if games[segment]}
  <svelte:boundary>
    {#await games[segment]() then mod}
      <mod.default />
    {/await}
    {#snippet failed(error, reset)}
      <Crashed game={segment} {error} {reset} />
    {/snippet}
  </svelte:boundary>
{:else}
  <Home />
{/if}
