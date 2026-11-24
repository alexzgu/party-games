<script lang="ts">
  import Dropdown from './Dropdown.svelte';
  import Button from './Button.svelte';
  import { pickedLabel, type Category } from '../lib/gamesView';

  // The drop-down's pick-several face for the Games page's categories: the closed box says what is
  // picked (tinted, with a clear button, while anything is); open, every category with its game
  // count, the phone's own tagged "yours" with a pencil, and New and Done under them. Picking keeps
  // it open, so the list behind changes as you go.
  let { categories, picked, ontoggle, onclear, onedit }: {
    categories: Category[];
    picked: string[];
    ontoggle: (id: string) => void;
    onclear: () => void;
    /** Open the category editor: an own category, or null for a new one. */
    onedit: (c: Category | null) => void;
  } = $props();

  let menu: Dropdown | undefined = $state();
  const label = $derived(pickedLabel(categories, picked));
  const byId = (id: string) => categories.find((c) => c.id === id);
  const count = (n: number) => `${n} game${n === 1 ? '' : 's'}`;

  /** After the editor closes: focus to the search field when what opened it is gone. */
  export function refocus(): void {
    if (!document.activeElement || document.activeElement === document.body) menu?.refocus();
  }
</script>

<Dropdown bind:this={menu} multi options={categories} label="Categories" spoken={label} searchLabel="Search categories" none="No categories match."
  tint={picked.length ? 'var(--accent)' : undefined} isOn={(id) => picked.includes(id)} onchoose={ontoggle}>
  {#snippet face()}
    <span class="name">{label}</span>
  {/snippet}
  {#snippet trailing()}
    {#if picked.length}
      <button type="button" class="clear" aria-label="Clear" data-tip="Shows every category's games again" onclick={onclear}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
      </button>
    {/if}
  {/snippet}
  {#snippet inside(o)}
    {#if byId(o.id)?.own}<span class="yours">yours</span>{/if}
    <span class="count">{count(byId(o.id)?.games.length ?? 0)}</span>
  {/snippet}
  {#snippet after(o)}
    {#if byId(o.id)?.own}
      <button type="button" class="edit" aria-label="Edit {o.name}" data-tip="Rename it, choose its games or delete it" onclick={() => onedit(byId(o.id)!)}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>
      </button>
    {/if}
  {/snippet}
  {#snippet foot(close)}
    <Button variant="secondary" size="sm" onclick={() => onedit(null)} tip="Makes a category of games on this device">New</Button>
    <Button size="sm" onclick={close}>Done</Button>
  {/snippet}
</Dropdown>

<style>
  .yours {
    flex: none; padding: 1px var(--s-2); border-radius: var(--r-pill); border: 1px dashed var(--line-strong);
    color: var(--text-dim); font-size: 0.75rem; font-weight: 700;
  }
  .count { flex: none; color: var(--text-dim); font-weight: 600; font-size: 0.85rem; }
  .clear, .edit {
    flex: none; width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: var(--r-pill);
    background: var(--overlay); color: var(--text);
  }
  .clear:active, .edit:active { background: var(--overlay-strong); }
</style>
