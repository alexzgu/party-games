<script lang="ts">
  import { APP, GAMES } from '../app.config';
  import { go } from '../lib/router.svelte';
  import { unlockAudio, sfx } from '../lib/sound';
  import { haptic } from '../lib/haptics';
  import { forgetListings } from '../lib/communityCache';
  import { communityGames } from '../lib/communityView';

  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let showInstall = $state(false);

  function open(id: string) {
    unlockAudio();
    sfx.tap();
    haptic.light();
    go('/' + id);
  }

  // The Community page, while the library is on; opened anew, so its lists load fresh.
  const community = communityGames().length > 0;
  function openCommunity() {
    forgetListings();
    open('community');
  }
</script>

<div class="home">
  <header class="top pinned-bg pinned-lift">
    <div class="brand">
      <span class="logo" aria-hidden="true">🎲</span>
      <h1>{APP.name}</h1>
    </div>
    <div class="tools">
    <button class="gear" aria-label="History" onclick={() => { unlockAudio(); go('/history'); }} data-tip="Finished rounds and games on this device, with scores">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4h4M12 7.5V12l3 2"/></svg>
    </button>
    <button class="gear" aria-label="Settings" onclick={() => { unlockAudio(); go('/settings'); }} data-tip="Your username, sound, colors, tilt and the wizard">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.4 2.5h4l.4-2.5c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.6ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" transform="translate(-1 0)"/></svg>
    </button>
    </div>
  </header>

  <ul class="games">
    {#each GAMES as g, i (g.id)}
      <li class="pop-in" style:animation-delay="{60 + i * 70}ms">
        <button class="card" style:--accent={g.accent} onclick={() => open(g.id)}>
          <span class="emoji" aria-hidden="true">{g.emoji}</span>
          <span class="txt">
            <span class="name" class:long={g.name.length > 13}>{g.name}</span>
            <span class="players">{g.players}</span>
          </span>
          <svg class="chev" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </li>
    {/each}
  </ul>

  {#if community}
    <button class="community pop-in" style:animation-delay="{60 + GAMES.length * 70}ms" onclick={openCommunity}>
      <span class="emoji" aria-hidden="true">🌍</span>
      <span class="txt">
        <span class="cname">Community packs</span>
        <span class="players">Browse packs friends made</span>
      </span>
      <svg class="chev" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  {/if}

  {#if !standalone}
    <div class="install">
      <button class="install-btn" onclick={() => (showInstall = !showInstall)} aria-expanded={showInstall} data-tip="Shows how to install the app on this device">
        📲 Install help
      </button>
      {#if showInstall}
        <p class="how fade-in">
          {#if ios}
            In Safari, tap <b>Share</b> <span aria-hidden="true">⎋</span> then <b>Add to Home Screen</b>. Open it from the new icon.
          {:else}
            In Chrome, tap the <b>⋮</b> menu then <b>Add to Home screen</b> (or <b>Install app</b>).
          {/if}
          It keeps working with no signal once opened.
        </p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .home {
    --gutter-l: calc(var(--safe-left) + var(--s-4));
    --gutter-r: calc(var(--safe-right) + var(--s-4));
    max-width: 640px; margin: 0 auto;
    padding: 0 var(--gutter-r) calc(var(--safe-bottom) + var(--s-6)) var(--gutter-l);
    display: flex; flex-direction: column; gap: var(--s-4); min-height: 100dvh;
  }
  /* Pinned, edge to edge, in the page's own background: History and Settings are always in reach. */
  .top {
    position: sticky; top: 0; z-index: var(--z-pinned); display: flex; align-items: center; justify-content: space-between;
    margin: 0 calc(-1 * var(--gutter-r)) calc(-1 * var(--s-2)) calc(-1 * var(--gutter-l));
    padding: calc(var(--safe-top) + var(--s-4)) var(--gutter-r) var(--s-2) var(--gutter-l);
  }
  .tools { display: flex; gap: var(--s-2); }
  .brand { display: flex; align-items: center; gap: var(--s-3); }
  .logo { font-size: 2.2rem; }
  .gear { width: 48px; height: 48px; border-radius: var(--r-pill); border: 0; background: var(--surface); display: grid; place-items: center; color: var(--text-dim); }
  .games { list-style: none; padding: 0; margin: var(--s-3) 0 0; display: flex; flex-direction: column; gap: var(--s-3); }
  .card {
    width: 100%; text-align: left; display: flex; align-items: center; gap: var(--s-4);
    padding: var(--s-5) var(--s-4); border-radius: var(--r-lg); border: 1.5px solid color-mix(in srgb, var(--accent) 40%, transparent);
    background:
      radial-gradient(140% 120% at 0% 0%, color-mix(in srgb, var(--accent) 26%, transparent), transparent 60%),
      var(--bg-raised);
    box-shadow: var(--shadow);
    transition: transform var(--dur-fast) var(--ease-out);
  }
  .card:active { transform: scale(0.98); }
  .emoji { font-size: 2.6rem; flex: none; filter: drop-shadow(0 4px 10px color-mix(in srgb, var(--shade) 40%, transparent)); }
  .txt { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .name { font-family: var(--font-display); font-weight: 800; font-size: 1.6rem; color: var(--accent); letter-spacing: -0.02em; }
  /* A long name (Inn Co Hear Ant) a size down, so it stays on one line on a phone. */
  .name.long { font-size: min(1.32rem, 6vw); white-space: nowrap; }
  .players { color: var(--text-dim); font-weight: 700; font-size: 0.92rem; margin-top: 2px; }
  .chev { color: var(--text-faint); flex: none; }
  /* Community: a quieter row under the games, in the page's own colours. */
  .community {
    width: 100%; text-align: left; display: flex; align-items: center; gap: var(--s-3);
    padding: var(--s-4); border-radius: var(--r-lg); border: 1.5px solid var(--line-strong); background: var(--surface);
    color: var(--text); transition: transform var(--dur-fast) var(--ease-out);
  }
  .community:active { transform: scale(0.98); }
  .community .emoji { font-size: 1.9rem; }
  /* One line on a 320 px phone too. */
  .cname { font-family: var(--font-display); font-weight: 800; font-size: min(1.25rem, 5.6vw); letter-spacing: -0.01em; white-space: nowrap; }
  .install { margin-top: auto; }
  .install-btn { width: 100%; min-height: var(--tap); border-radius: var(--r-md); border: 1.5px dashed var(--line-strong); background: transparent; color: var(--text-dim); font-weight: 600; }
  .how { color: var(--text-dim); padding: var(--s-3) var(--s-2); font-size: 0.95rem; }
</style>
