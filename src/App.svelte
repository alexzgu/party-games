<script lang="ts">
  import { untrack } from 'svelte';
  import { route } from './lib/router.svelte';
  import { GAMES } from './app.config';
  import Home from './pages/Home.svelte';
  import Games from './pages/Games.svelte';
  import Settings from './pages/Settings.svelte';
  import History from './pages/History.svelte';
  import Crashed from './pages/Crashed.svelte';
  import Joined from './pages/Joined.svelte';
  import CommunityPage from './pages/CommunityPage.svelte';
  import { communityGames, tabOf } from './lib/communityView';
  import Tooltip from './components/Tooltip.svelte';
  import ShareNote from './components/ShareNote.svelte';
  import { acceptInvite } from './lib/join';

  // Games load on demand; the service worker has them cached, so this is instant offline too.
  const games: Record<string, () => Promise<{ default: any }>> = {
    forehead: () => import('./games/forehead/Game.svelte'),
    dial: () => import('./games/dial/Game.svelte'),
    gibberish: () => import('./games/gibberish/Game.svelte'),
    quiz: () => import('./games/quiz/Game.svelte'),
    taboo: () => import('./games/taboo/Game.svelte'),
    quick: () => import('./games/quick/Game.svelte'),
    snark: () => import('./games/snark/Game.svelte'),
    salad: () => import('./games/salad/Game.svelte'),
    brawl: () => import('./games/brawl/Game.svelte'),
    sketch: () => import('./games/sketch/Game.svelte'),
    hand: () => import('./games/hand/Game.svelte'),
    odd: () => import('./games/odd/Game.svelte'),
    rather: () => import('./games/rather/Game.svelte'),
    fish: () => import('./games/fish/Game.svelte'),
  };

  const segment = $derived(route.path.split('/').filter(Boolean)[0] ?? '');

  // An invite link (#/join/<key>): the key is stored and wiped from the address bar at once,
  // then a short page says whether it worked, until its button or any other page closes it.
  let invite = $state<'ok' | 'broken' | null>(null);
  $effect.pre(() => {
    if (segment !== 'join') {
      if (segment !== '') invite = null;
      return;
    }
    const path = route.path;
    invite = untrack(() => acceptInvite(path)) ? 'ok' : 'broken';
  });

  // The Community page, while the library is on (a wizard server); otherwise its address shows Home.
  const community = communityGames();

  // The page glow and every default accent follow the game on screen (Community: the open tab's;
  // the main menu and the Games page: the default).
  $effect(() => {
    const id = segment === 'community' ? tabOf(route.path, community) : segment;
    const game = GAMES.find((g) => g.id === id);
    document.documentElement.style.setProperty('--accent', game ? game.accent : 'var(--c-gibberish)');
  });
</script>

{#if invite}
  <Joined ok={invite === 'ok'} ondone={() => (invite = null)} />
{:else if segment === 'join'}
  <!-- the invite effect takes it from here -->
{:else if segment === '' }
  <Home />
{:else if segment === 'games'}
  <Games />
{:else if segment === 'settings'}
  <Settings />
{:else if segment === 'history'}
  <History />
{:else if segment === 'community' && community.length}
  <CommunityPage />
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

<ShareNote />
<Tooltip />
