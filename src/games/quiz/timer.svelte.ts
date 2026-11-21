// Big Board's cosmetic timer: whether it shows, its length and where it sits, remembered on the
// phone. It never touches the game.
import { load, save } from '../../lib/storage';
import type { Point } from '../../lib/drag';

export const LENGTHS = [10, 20, 30, 60] as const;
const KEY = 'quiz:timer';

interface Prefs { shown: boolean; seconds: number; pos: Point | null }
const saved = load<Partial<Prefs>>(KEY, {});
const okPos = (p: unknown): p is Point => !!p && Number.isFinite((p as Point).x) && Number.isFinite((p as Point).y);

export const timer = $state<Prefs>({
  shown: saved.shown !== false,
  seconds: (LENGTHS as readonly number[]).includes(saved.seconds as number) ? (saved.seconds as number) : 30,
  pos: okPos(saved.pos) ? saved.pos : null,
});

export const saveTimer = (): void => save(KEY, $state.snapshot(timer));
