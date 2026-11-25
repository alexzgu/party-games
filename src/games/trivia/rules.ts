// What makes a Smarty Pants question usable: the content gate's rules (src/lib/content.test.ts),
// shared by the pack editor, "Make a pack" (pasted lists), the wizard and pack files
// (src/lib/listPack.ts). A pack stores each question as one line of six parts split by " | ":
// category | question | the right answer | three wrong answers
// ("Science | What gas do plants take in from the air? | Carbon dioxide | Oxygen | Nitrogen | Helium").
import { stripEnd, type ListSpec } from '../../lib/listSpec';

/** What splits the parts: a bar with a space on each side. */
export const SEP = ' | ';
export const CATEGORY_MAX = 24;
export const CATEGORY_WORDS_MAX = 3;
export const QUESTION_MAX = 140;
export const QUESTION_WORDS_MIN = 3;
export const QUESTION_WORDS_MAX = 30;
/** Each of the four answers. */
export const ANSWER_MAX = 40;
export const ANSWER_WORDS_MAX = 6;
/** The longest line the limits above allow (339 characters). */
export const LINE_MAX = CATEGORY_MAX + QUESTION_MAX + 4 * ANSWER_MAX + 5 * SEP.length;

/** One question's parts; `wrong` holds the three wrong answers in the order written. */
export type Parts = { category: string; question: string; right: string; wrong: [string, string, string] };

/** A line's parts as written (a missing part is ''). */
export function parts(line: string): Parts {
  const [category = '', question = '', right = '', a = '', b = '', c = ''] = line.split(SEP);
  return { category, question, right, wrong: [a, b, c] };
}

/** Text ignoring case, spacing and punctuation. */
const plain = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
const wordCount = (s: string): number => plain(s).split(' ').filter(Boolean).length;

/** A question's text ignoring case, spacing and punctuation. */
export const questionKey = (question: string): string => plain(question);

/** Two questions are the same when their question parts match ignoring case, spacing and punctuation. */
export const triviaKey = (line: string): string => questionKey(parts(line).question);

/** An answer as written but for case and spacing: how the four are told apart ("C" and "C#", "40" and "-40" differ). */
const answerKey = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** A last word that is an abbreviation: a full stop inside it ("D.C"), or a capitalised word of up to three letters ("Jr", "Inc"). */
const ABBREVIATION = /^(?:\S*\.\S*|\p{Lu}\p{Ll}{0,2})$/u;

/** An answer without its closing full stops, unless the one full stop ends an abbreviation ("Washington D.C.", "Martin Luther King Jr."). */
function dropStop(s: string): string {
  const body = stripEnd(s, '.').trim();
  const last = body.slice(body.lastIndexOf(' ') + 1);
  return s.length - body.length === 1 && ABBREVIATION.test(last) ? s : body;
}

/** Every part trimmed with its spaces squeezed, a closing full stop dropped from each answer (not an abbreviation's); nothing reordered. */
export function tidyTrivia(line: string): string {
  return line.split('|').map((p, i) => {
    const s = p.trim().replace(/\s+/g, ' ');
    return i >= 2 ? dropStop(s) : s;
  }).join(SEP);
}

/** The first letter or digit is not a lowercase letter, in any alphabet ("Édith…", a leading quotation mark, "1984…"). */
function capitalFirst(s: string): boolean {
  const first = /[\p{L}\p{N}]/u.exec(s)?.[0];
  return !!first && !/\p{Ll}/u.test(first);
}

/** Why a tidied line cannot be used, or '' when it can. */
export function triviaProblem(line: string): string {
  const all = line.split(SEP);
  if (all.length !== 6) return 'needs six parts';
  if (all.some((p) => !p.trim() || p.includes('|') || p !== p.trim())) return 'has an empty part';
  const { category, question, right, wrong } = parts(line);
  if (category.length > CATEGORY_MAX || wordCount(category) > CATEGORY_WORDS_MAX) return 'category too long';
  if (wordCount(question) < QUESTION_WORDS_MIN) return 'question too short';
  if (question.length > QUESTION_MAX || wordCount(question) > QUESTION_WORDS_MAX) return 'question too long';
  const answers = [right, ...wrong];
  if (answers.some((a) => a.length > ANSWER_MAX || wordCount(a) > ANSWER_WORDS_MAX)) return 'answer too long';
  if (new Set(answers.map(answerKey)).size !== 4) return 'answers repeat';
  if (!capitalFirst(category) || !capitalFirst(question)) return 'starts oddly';
  return '';
}

export const TRIVIA_LISTS: readonly ListSpec[] = [
  {
    field: 'questions', one: 'question', many: 'questions', tidy: tidyTrivia, problem: triviaProblem, key: triviaKey, max: LINE_MAX,
    example: 'Science | What gas do plants take in from the air? | Carbon dioxide | Oxygen | Nitrogen | Helium',
    hint: 'Six parts split by " | ": category | question | right answer | three wrong answers.',
  },
];
