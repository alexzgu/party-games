<script lang="ts">
  import { art, tidy, type Track } from './match';
  import type { Item } from './adding';

  // One line of the "Add songs" review: what it matched (art, title, artist), a ▶ to hear the
  // preview, keep or drop, and the other search results when the match is wrong.
  let { item, playing, onpreview, ontoggle, onchoose }: {
    item: Item;
    /** The preview URL playing now ('' for none). */
    playing: string;
    onpreview: (url: string) => void;
    ontoggle: () => void;
    onchoose: (t: Track) => void;
  } = $props();

  let open = $state(false);
  // Rows stream in under the finger: a tap this soon after one appears is meant for what was there.
  const shownAt = performance.now();
  const guard = (fn: () => void) => () => { if (performance.now() - shownAt >= 400) fn(); };

  const m = $derived(item.match);
  const t = $derived(m?.track ?? null);
  // A Spotify line Apple could not match still shows the title Spotify gave (artist 'N/A').
  const names = $derived(t ? tidy(t) : (m?.linked ?? null));
  const playable = $derived(!!t?.preview && !item.dup);
  const label = $derived(
    item.state !== 'done' ? (item.state === 'matching' ? 'Finding it…' : 'Waiting…')
    : item.wanted.kind === 'playlist' ? (m?.retry ? m.why ?? '' : `Playlist: ${m?.why?.replace(/^a playlist of /, '') ?? ''}`)
    : item.wanted.kind === 'skip' ? item.wanted.why.charAt(0).toUpperCase() + item.wanted.why.slice(1)
    : item.dup ? 'Already in this pack'
    : !t ? `Not found (${m?.why ?? 'no match'})`
    : !t.preview ? 'Apple has no preview for it'
    : !m?.sure ? (m?.linked ? 'Check this match: Spotify gave only the title' : 'Check this match') : '',
  );
</script>

<li class="row" class:off={!item.keep} class:doubt={item.state === 'done' && !!t && !m?.sure && !item.dup} class:miss={item.state === 'done' && !t && item.wanted.kind !== 'playlist'}>
  <div class="main">
    {#if t?.artwork}<img class="art" src={art(t.artwork, 100)} alt="" loading="lazy" />{:else}<span class="art ph" class:spin={item.state === 'matching'} aria-hidden="true">{item.wanted.kind === 'playlist' ? '☰' : '♪'}</span>{/if}
    <div class="txt">
      {#if names}
        <b>{names.title}</b>
        <span class="ar">{names.artist}</span>
      {:else}
        <b class="line">{item.wanted.line}</b>
      {/if}
      {#if label}<span class="tag">{label}</span>{/if}
      {#if t && m?.linked}<span class="from">from Spotify: {m.linked.title} · {m.linked.artist}</span>
      {:else if t && (!m?.sure || item.wanted.kind === 'youtube')}<span class="from">from: {item.wanted.line}</span>{/if}
    </div>
    {#if t?.preview}
      <button class="icon" class:on={playing === t.preview} onclick={() => onpreview(t.preview)} aria-label={playing === t.preview ? 'Stop the preview' : `Hear ${names?.title}`}>{playing === t.preview ? '■' : '▶'}</button>
    {/if}
    {#if item.state === 'done' && item.wanted.kind !== 'playlist'}
      <button class="keep" class:on={item.keep} disabled={!playable} aria-pressed={item.keep} onclick={guard(ontoggle)} aria-label={item.keep ? `Drop ${names?.title ?? 'this'}` : `Keep ${names?.title ?? 'this'}`}>{item.keep ? '✓' : ''}</button>
    {/if}
  </div>
  {#if item.state === 'done' && m && m.others.length && item.wanted.kind !== 'playlist'}
    <button class="other" onclick={guard(() => (open = !open))} aria-expanded={open}>{open ? 'Hide the other matches' : t ? 'Wrong match? Pick another' : 'Pick one of these'}</button>
    {#if open}
      <ul class="alts">
        {#each m.others.slice(0, 8) as o (o.id)}
          {@const n = tidy(o)}
          <li>
            {#if o.artwork}<img class="art sm" src={art(o.artwork, 60)} alt="" loading="lazy" />{:else}<span class="art sm ph" aria-hidden="true">♪</span>{/if}
            <span class="txt"><b>{n.title}</b><span class="ar">{n.artist} · {o.album}</span></span>
            {#if o.preview}<button class="icon sm" class:on={playing === o.preview} onclick={() => onpreview(o.preview)} aria-label="Hear {n.title} by {n.artist}">{playing === o.preview ? '■' : '▶'}</button>{/if}
            <button class="use" disabled={!o.preview} onclick={() => { onchoose(o); open = false; }}>Use this</button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</li>

<style>
  .row { list-style: none; padding: var(--s-2) var(--s-3); border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--surface); display: flex; flex-direction: column; align-items: stretch; gap: var(--s-1); min-width: 0; }
  .row.off { opacity: 0.62; }
  .row.doubt { border-color: color-mix(in srgb, var(--c-pass) 70%, transparent); }
  .row.miss { border-style: dashed; }
  .main { display: flex; align-items: center; gap: var(--s-3); min-width: 0; }
  .art { width: 52px; height: 52px; border-radius: var(--r-sm); flex: none; object-fit: cover; background: var(--bg-sunk); }
  .art.sm { width: 40px; height: 40px; }
  .ph { display: grid; place-items: center; color: var(--accent); font-size: 1.2rem; }
  .ph.spin { animation: breathe 1.2s ease-in-out infinite; }
  .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .txt b { font-family: var(--font-display); font-weight: 800; line-height: 1.15; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow-wrap: anywhere; }
  .txt b.line { font-family: var(--font-body); font-weight: 600; color: var(--text-dim); font-size: 0.92rem; }
  .ar { color: var(--text-dim); font-weight: 600; font-size: 0.9rem; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
  .tag { font-size: 0.8rem; font-weight: 700; color: var(--text-faint); }
  .doubt .tag { color: var(--c-pass); }
  .from { font-size: 0.75rem; color: var(--text-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .icon, .keep {
    width: 44px; height: 44px; flex: none; border-radius: 50%; border: 1.5px solid var(--line-strong);
    background: var(--bg-raised); color: var(--text); font-weight: 900; display: grid; place-items: center;
  }
  .icon.sm { width: 40px; height: 40px; }
  .icon.on { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
  .keep.on { background: var(--c-good); border-color: var(--c-good); color: var(--on-accent); }
  .keep:disabled { opacity: 0.35; }
  .other { align-self: flex-start; min-height: 36px; border: 0; background: none; color: var(--accent); font-weight: 700; padding: 0; font-size: 0.9rem; }
  .alts { margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  .alts li { list-style: none; display: flex; align-items: center; gap: var(--s-2); }
  .use { min-height: 40px; padding: 0 var(--s-3); border-radius: var(--r-pill); border: 0; background: var(--accent); color: var(--on-accent); font-weight: 700; flex: none; }
  .use:disabled { opacity: 0.4; }
  @keyframes breathe { 50% { opacity: 0.4; } }
  @media (prefers-reduced-motion: reduce) { .ph.spin { animation: none; } }
</style>
