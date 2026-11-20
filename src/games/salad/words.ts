export const categories = ['person', 'place', 'thing', 'story'] as const;
export const levels = ['easy', 'medium', 'hard'] as const;
export type Category = typeof categories[number];
export type Slot = 'adjective' | 'noun' | 'verb' | 'place' | 'time';

export interface Secret {
  answer: string;
  category: Category;
  level: typeof levels[number];
  also: string[];
  words: Partial<Record<Slot, string[]>>;
}

export interface Frame {
  text: string;
  slots: (Slot | 'guess')[];
}

const frame = (text: string, ...slots: Frame['slots']): Frame => ({ text, slots });

export const opening: Record<Category, Frame> = {
  person: frame("Think of ___ who can ___.", 'noun', 'verb'),
  place: frame("Picture ___ somewhere ___.", 'noun', 'adjective'),
  thing: frame("It looks like ___ and it's ___.", 'noun', 'adjective'),
  story: frame("It's about ___ trying to ___.", 'noun', 'verb'),
};

const similar = frame("It's like ___.", 'guess');
const different = frame("It's not like ___.", 'guess');
const twist = frame("It's ___ but ___.", 'guess', 'adjective');

export const followups: Record<Category, Frame[]> = {
  person: [
    frame("They're especially ___ when they ___.", 'adjective', 'verb'),
    frame("Look for them ___.", 'place'),
    similar,
    frame("Picture ___ with the confidence of ___.", 'noun', 'noun'),
    frame("They would ___ in the middle of a party.", 'verb'),
    frame("You might hear about them ___.", 'time'),
    different,
    frame("As people go, they're pretty ___.", 'adjective'),
    frame("They would rather ___ than ___.", 'verb', 'verb'),
    twist,
    frame("If they walked in, you'd expect to see ___.", 'noun'),
    frame("They know how to ___, especially ___.", 'verb', 'place'),
  ],
  place: [
    frame("You could go there to ___.", 'verb'),
    frame("You'd probably see ___ there.", 'noun'),
    similar,
    frame("It's ___ even ___.", 'adjective', 'time'),
    frame("Start looking ___.", 'place'),
    frame("If you go there, be ready to ___.", 'verb'),
    different,
    frame("Picture ___ in every direction.", 'noun'),
    frame("It gets pretty ___ around there.", 'adjective'),
    twist,
    frame("You could find yourself trying to ___ ___.", 'verb', 'place'),
    frame("Go there ___ for the full experience.", 'time'),
  ],
  thing: [
    frame("You might run into it ___.", 'place'),
    frame("Compared with ___, it seems ___.", 'noun', 'adjective'),
    similar,
    frame("It might make you want to ___.", 'verb'),
    frame("It seems right at home beside ___.", 'noun'),
    frame("You'll notice it most ___.", 'time'),
    different,
    frame("It's surprisingly ___.", 'adjective'),
    frame("If you spot it, you might ___ or ___.", 'verb', 'verb'),
    twist,
    frame("Tell a friend to look for ___ ___.", 'noun', 'place'),
    frame("Imagine ___, only more ___.", 'noun', 'adjective'),
  ],
  story: [
    frame("A good chunk of it happens ___.", 'place'),
    frame("Eventually, things get ___.", 'adjective'),
    similar,
    frame("Somebody has to ___ before they can ___.", 'verb', 'verb'),
    frame("It would make sense to see ___ in it.", 'noun'),
    frame("The trouble starts ___.", 'time'),
    different,
    frame("The main character reminds me of ___.", 'noun'),
    frame("The people in it have a good reason to ___.", 'verb'),
    twist,
    frame("Think of a ___ scene with ___ in the middle.", 'adjective', 'noun'),
    frame("You'd probably want to ___ if you were there.", 'verb'),
  ],
};

const list = (text: string) => text.trim().split(/\s*\|\s*/);

export const shared: Record<Slot, string[]> = {
  adjective: list(`
    angry | awake | bad | bald | beautiful | big | bitter | black | blue | bold |
    brave | bright | brown | bumpy | busy | careful | cheap | clean | clear | close |
    clumsy | cold | colorful | confused | cool | crowded | dark | deep | dirty | dry |
    dull | dusty | easy | empty | fast | fat | flat | foggy | fresh | friendly |
    funny | gentle | glad | good | green | hard | heavy | high | hot | huge |
    hungry | icy | jumpy | kind | late | lazy | light | little | lonely | loose |
    loud | messy | narrow | neat | new | nice | noisy | old | open | pale |
    pink | plain | proud | quick | quiet | red | rich | rough | round | sad |
    salty | scared | scary | shallow | sharp | shiny | short | silly | slow | small |
    smooth | soft | sour | steady | still | strange | strong | sweet | tall | thin |
    tight | tiny | tired | warm | weak | wet | white | wide | wild | wooden
  `),
  noun: list(`
    a bag | a ball | a basket | a beach | a bean | a bed | a bell | a bird | a boat | a book |
    a bowl | a box | a bridge | a broom | a brush | a bucket | a bus | a button | a cake | a camera |
    a can | a car | a card | a cat | a chair | a child | a clock | a cloud | a coat | a coin |
    a cook | a cup | a door | a drum | a farmer | a fence | a field | a fish | a flag | a flower |
    a fork | a frog | a friend | a game | a garden | a gate | a glass | a glove | a goat | a hat |
    a hill | a hook | a horse | a house | a jar | a key | a kite | a lake | a leaf | a letter |
    a lid | a light | a map | a mask | a mirror | a mouse | a nail | a nest | a net | a nurse |
    a painter | a pen | a pet | a phone | a pie | a pillow | a plant | a plate | a pool | a pot |
    a rabbit | a road | a rock | a roof | a rope | a rug | a sheet | a ship | a shoe | a sign |
    a sock | a spoon | a stick | a stone | a table | a tent | a tool | a tower | a train | a tree |
    a truck | a wall | a wheel | a window | a worker | an actor | an ant | an apple | an egg | an owl
  `),
  verb: list(`
    ask | bake | bend | blow | boil | bounce | break | build | buy | call |
    carry | catch | change | chase | clap | clean | climb | close | collect | count |
    crawl | cry | cut | dance | dig | dive | draw | drink | drive | drop |
    eat | fall | fight | fish | float | fold | follow | freeze | gather | grow |
    hang | hide | hike | hop | hug | hunt | jump | kick | laugh | learn |
    lift | listen | look | march | melt | move | nod | open | pack | paint |
    park | peel | plan | plant | play | point | pour | practice | pull | push |
    read | rest | ride | roll | rub | run | sail | save | search | shake |
    shave | shout | sing | skate | sleep | slide | smile | snap | spin | splash |
    stack | stare | stir | stretch | swim | tap | teach | throw | tie | travel |
    turn | twist | wait | walk | wash | wave | whisper | whistle | work | write
  `),
  place: list(`
    at a bus stop | at a party | at a picnic | at a playground | at a pool | at a store |
    at a wedding | at church | at home | at school | at work | by a fence |
    by a fire | by a lake | by a river | by a road | by the door | by the stairs |
    downtown | far away | in a bakery | in a bathroom | in a bedroom | in a boat |
    in a cave | in a city | in a classroom | in a closet | in a crowd | in a desert |
    in a field | in a forest | in a garage | in a garden | in a gym | in a hallway |
    in a kitchen | in a library | in a mall | in a market | in a park | in a tent |
    in a truck | in a tunnel | in a yard | in the air | in the dark | in the hills |
    in the rain | in the snow | in the woods | indoors | near a bridge | near a farm |
    near a pier | on a balcony | on a beach | on a bench | on a bike | on a bus |
    on a farm | on a mountain | on a porch | on a roof | on a train | on a trail |
    on a wall | on the ground | on the street | on the water | out back | outside |
    over a hill | under a bridge | underground | upstairs
  `),
  time: list(`
    after a break | after a game | after a nap | after a storm | after breakfast | after dark |
    after dinner | after hours | after lunch | after practice | after school | after the show |
    after work | all day | all night | around noon | at bedtime | at dawn |
    at daybreak | at dusk | at midnight | at night | at sunrise | at sunset |
    before a party | before a race | before bedtime | before breakfast | before class | before dawn |
    before dinner | before lunch | before practice | before school | before work | during a break |
    during a game | during a storm | during class | during dinner | during lunch | during practice |
    during the holidays | during the week | every day | every evening | every morning | every night |
    first thing | in a hurry | in autumn | in spring | in summer | in the afternoon |
    in the evening | in the future | in the morning | in the past | in winter | late at night |
    on a break | on a cold day | on a day off | on a hot day | on a rainy day | on a sunny day |
    on vacation | on weekdays | on weekends | once a day | once a month | once a week |
    once in a while | right away | right before bed | while you sleep
  `),
};

const tokens = (text: string): string[] => text.toLowerCase().normalize('NFKD')
  .replace(/\p{M}/gu, '').replace(/['’]/g, '').match(/[\p{L}\p{N}]+/gu) ?? [];

/** Catch an answer word in a clue, including hyphenated names written without the hyphen. */
export function leaksAnswer(clue: string, answer: string): boolean {
  const clueWords = tokens(clue);
  const answerWords = tokens(answer);
  return answerWords.some((word) => clueWords.includes(word)) ||
    clueWords.includes(answerWords.join(''));
}
