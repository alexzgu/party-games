<script lang="ts">
  import { untrack } from 'svelte';
  import { gameName } from '../../app.config';
  import { customRoom, customWarm, roomPacks, warmPacks, type DropInPack, type RoomCard, type WarmCard } from '../../lib/content';
  import { go, route } from '../../lib/router.svelte';
  import { load, remove as clearSaved, save } from '../../lib/storage';
  import { unlockAudio } from '../../lib/sound';
  import { roomTypes, type Card, type DropInGame } from '../../lib/dropin/cards';
  import { begin, draw, readRound, saveRound, type Options } from '../../lib/dropin/session';
  import Editor from './Editor.svelte';
  import Setup from './Setup.svelte';
  import Stage from './Stage.svelte';

  let { game }: { game: DropInGame } = $props();
  const id = untrack(() => game);
  const packsForGame = id === 'warm' ? warmPacks : roomPacks;
  const store = id === 'warm' ? customWarm : customRoom;
  const title = gameName(id);
  const demoCards: Record<string, Card> = {
    warm: { answer: 'Tape measure', clues: ['I’m always under pressure to go farther.', 'I snap back if you let go.', 'I help decide if that couch will fit.', 'My metal ribbon is marked in inches.'] },
    side: { type: 'side', a: 'Always host', b: 'Always help clean up' },
    proof: { type: 'proof', text: 'Something with a price sticker still on it' },
    foley: { type: 'foley', lines: ['The porch step gives way [CRACK]', 'A furious goose comes charging [HONK HONK]'] },
    together: { type: 'together', text: 'Something everyone forgets on a weekend trip' },
  };
  const demo = new URLSearchParams(location.search).get('demo') ?? route.params.get('demo');
  const demoKey = (demo ?? '').replace(new RegExp(`^${id}-`), '');
  const demoCard = demo && demoKey !== 'setup'
    ? demoCards[id === 'warm' ? 'warm' : demoKey.split('-')[0]] ?? (demo === id ? demoCards.side : undefined)
    : undefined;
  const demoReveal = demoKey === 'reveal' || demoKey.endsWith('-reveal');
  let packs = $state<DropInPack<Card>[]>(packsForGame());
  const defaults: Options = { packs: packsForGame().slice(0, 1).map((pack) => pack.id), types: roomTypes.map(({ type }) => type), drip: 0 };
  let options = $state(load(`${id}:options`, defaults));
  let round = $state(demoCard ? {
    ...begin(demoCard, defaults),
    step: id === 'warm' ? 2 : 0,
    left: demoReveal ? 0 : begin(demoCard, defaults).left,
    revealed: demoReveal,
  } : readRound(id));
  let editing = $state<DropInPack<Card> | 'new'>();
  const playing = $derived(Boolean(demoCard || route.path === `/${id}/play`));

  function changeOptions(next: Options) {
    options = next;
    save(`${id}:options`, next);
  }

  function update(next: NonNullable<typeof round>) {
    round = next;
    if (!demo) saveRound(id, next);
  }

  function nextCard(settings: Options) {
    const card = demoCard || draw(id, packs, settings);
    if (!card) {
      round = null;
      clearSaved(`${id}:round`);
      go(`/${id}`, true);
      return;
    }
    update(begin(card, settings));
    go(`/${id}/play`, true);
  }

  function play(resume: boolean) {
    unlockAudio();
    if (resume && round) go(`/${id}/play`, true);
    else nextCard($state.snapshot(options));
  }

  function persist(pack: DropInPack<Card>) {
    if (id === 'warm') customWarm.put(pack as DropInPack<WarmCard>);
    else customRoom.put(pack as DropInPack<RoomCard>);
    packs = packsForGame();
    editing = packs.find((item) => item.id === pack.id);
  }

  function remove(packId: string, restore: boolean) {
    if (restore) store.restore(packId);
    else store.remove(packId);
    packs = packsForGame();
    editing = restore ? packs.find((item) => item.id === packId) : undefined;
    if (!restore) changeOptions({ ...options, packs: options.packs.filter((item) => item !== packId) });
  }
</script>

{#if playing && round}
  <Stage {title} {round} frozen={Boolean(demoCard)} onupdate={update} onnext={() => round && nextCard(round.options)} onexit={() => go(`/${id}`, true)} />
{:else if editing}
  {#key editing === 'new' ? 'new' : editing.id}
    <Editor game={id} pack={editing === 'new' ? undefined : editing} {packs}
      edited={editing !== 'new' && store.isEdited(editing.id)}
      onsave={persist} onremove={remove} onback={() => { editing = undefined; }} />
  {/key}
{:else}
  <Setup game={id} {title} {packs} {options} resumed={Boolean(round)} onchange={changeOptions}
    onplay={play} onedit={(pack) => { editing = pack; }} onnew={() => { editing = 'new'; }} />
{/if}
