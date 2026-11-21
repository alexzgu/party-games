<script lang="ts">
  // "Username:" and a text box, for Settings. What is typed is saved as it is typed (tidied,
  // lib/username.ts); a box left empty, or holding only spaces, when it loses focus or the page
  // is left gives the phone a fresh random username instead.
  import { onMount } from 'svelte';
  import { freshUsername, getUsername, setUsername, USERNAME_MAX } from '../lib/username';

  let name = $state(getUsername());

  /** The box as it is when the phone moves on: tidied, or a fresh name when nothing is left. */
  function settle() {
    name = setUsername(name) ?? freshUsername();
  }

  onMount(() => {
    const leave = () => { if (!name.trim()) settle(); };
    addEventListener('pagehide', leave);
    return () => { removeEventListener('pagehide', leave); leave(); };
  });
</script>

<label class="username">
  <span>Username:</span>
  <input type="text" bind:value={name} oninput={() => setUsername(name)} onblur={settle}
    onkeydown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} maxlength={USERNAME_MAX}
    autocomplete="nickname" autocapitalize="words" spellcheck="false" enterkeyhint="done" />
</label>

<style>
  .username { display: flex; align-items: center; gap: var(--s-3); }
  .username span { flex: none; font-weight: 700; }
  .username input { flex: 1; min-width: 0; }
</style>
