<script lang="ts">
  // One large row that opens a page: a game on the Games page, or Games and Community packs on the
  // main menu. The emoji, the name in its colour and a line under it (the players).
  let { emoji, name, sub, accent, delay = 0, onclick }: {
    emoji: string;
    name: string;
    sub: string;
    accent: string;
    /** When its pop-in starts, so a list comes in one row after another. */
    delay?: number;
    onclick: () => void;
  } = $props();
</script>

<button class="card pop-in" style:--accent={accent} style:animation-delay="{delay}ms" {onclick}>
  <span class="emoji" aria-hidden="true">{emoji}</span>
  <span class="txt">
    <span class="name" class:long={name.length > 13}>{name}</span>
    <span class="sub">{sub}</span>
  </span>
  <svg class="chev" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
</button>

<style>
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
  .txt { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .name { font-family: var(--font-display); font-weight: 800; font-size: 1.6rem; color: var(--accent); letter-spacing: -0.02em; }
  /* A long name (Inn Co Hear Ant) a size down, so it stays on one line on a phone. */
  .name.long { font-size: min(1.32rem, 5.6vw); white-space: nowrap; }
  .sub { color: var(--text-dim); font-weight: 700; font-size: 0.92rem; margin-top: 2px; }
  .chev { color: var(--text-faint); flex: none; }
  /* A narrow phone: less room around the words, so a long name and its line fit inside the card. */
  @media (max-width: 359.98px) {
    .card { gap: var(--s-2); padding-inline: var(--s-3); }
    .emoji { font-size: 2.2rem; }
    .sub { font-size: min(0.92rem, 4vw); }
  }
</style>
