// The real combat behind ?real=1 (harness.ts) and its pre-flight check (jobs-check.mjs): one layout, one start, one
// window, so what node simulates is what the browser replays. Simulation only: no DOM, no renderer.
import { createCombatWithEvents, stepCombat } from '../../src/simulation/combat';
import { buildStrategySnapshot } from '../../src/simulation/strategy-snapshot';
import { DEFAULT_BOARD } from '../../src/simulation/board';
import { toDisplayEvents, toCombatViewState } from '../../src/presentation/combat-display';

export interface RealSetup { unit: string; star: number; form: string | null; foe: string; dist: number; nfoes: number; foestar: number;
  /** v-capture --foe-offset K: every foe K columns to the side (+ right), so the target stands ahead and to the side. */
  foeOffset?: number }
/** Ticks the replay keeps after the first cast of `me` when no window is asked for (3 s). */
export const DEFAULT_AFTER_TICKS = 60;
/** The replay starts this many ticks before the first cast of `me` (half a second). */
export const LEAD_TICKS = 10;
/** The recorded window of a real combat is chosen around one anchor cast of `me`: its first by default, its N-th with
 * castNumber (v-capture --cast-index N, ?castindex=N). Where the window starts, in ticks before that cast: LEAD_TICKS
 * (half a second) unless asked: fromStart (--from-start 1, ?fromstart=1) starts at combat start (tick 0, so the attacks
 * and casts before the anchor are in the window); leadMs (--lead-ms MS, ?leadms=MS) starts MS before the anchor cast,
 * never before combat start. */
export interface WindowStart { fromStart?: boolean; leadMs?: number | null; castNumber?: number }
export function leadTicksFor(castIndex: number, start: WindowStart = {}): number {
  if (start.fromStart) return Math.max(0, castIndex);
  if (start.leadMs != null) return Math.max(0, Math.min(castIndex, Math.round(start.leadMs / 50)));
  return LEAD_TICKS;
}
/** Ticks to replay past the anchor cast for a window of `windowMs`: from the default lead-in as before; with an asked-for
 * window the replay keeps windowMs past the anchor at least (a superset; extra ticks are never shown). */
export function afterTicksFor(windowMs: number, start: WindowStart = {}): number {
  return start.fromStart || start.leadMs != null || (start.castNumber ?? 1) !== 1 ? Math.max(DEFAULT_AFTER_TICKS, Math.ceil(windowMs / 50) + 1)
    : Math.max(DEFAULT_AFTER_TICKS, Math.ceil(windowMs / 50) - LEAD_TICKS + 1);
}

/** `me` on row 5; up to four foes `dist` rows in front ('training-dummy' is a Garen), shifted `foeOffset` columns (default 0). */
export function realUnits(s: RealSetup): any[] {
  const foe = s.foe === 'training-dummy' ? 'garen' : s.foe;
  const meRow = 5, foeRow = Math.max(0, Math.min(3, meRow - Math.max(2, s.dist)));
  // RECORDING ONLY (never merged): v-capture --foes "row,col;row,col" puts the foes on those cells, in order foe, foe2, ...
  const cells = (s as any).foeCells ? String((s as any).foeCells).split(';').map(pair => pair.split(',').map(Number)) : null;
  // RECORDING ONLY: v-capture --foe2 "model:star" makes the second foe another unit (a ranged one that holds its cell).
  const second = (s as any).foe2 ? String((s as any).foe2).split(':') : null;
  if (cells && second) return [
    { id: 'me', definitionId: s.unit, team: 'player', starLevel: s.star, location: { kind: 'board', cell: { col: 3, row: meRow } }, ...(s.form ? { form: s.form } : {}) },
    ...cells.map(([row, col], i) => ({ id: i === 0 ? 'foe' : `foe${i + 1}`, definitionId: i === 1 ? second[0] : foe, team: 'enemy', starLevel: i === 1 ? Number(second[1] ?? 1) : s.foestar, location: { kind: 'board', cell: { col, row } } })),
  ];
  if (cells) return [
    { id: 'me', definitionId: s.unit, team: 'player', starLevel: s.star, location: { kind: 'board', cell: { col: 3, row: meRow } }, ...(s.form ? { form: s.form } : {}) },
    ...cells.map(([row, col], i) => ({ id: i === 0 ? 'foe' : `foe${i + 1}`, definitionId: foe, team: 'enemy', starLevel: s.foestar, location: { kind: 'board', cell: { col, row } } })),
  ];
  return [
    { id: 'me', definitionId: s.unit, team: 'player', starLevel: s.star, location: { kind: 'board', cell: { col: 3, row: meRow } }, ...(s.form ? { form: s.form } : {}) },
    ...[['foe', 3, foeRow], ['foe2', 2, foeRow], ['foe3', 4, foeRow], ['foe4', 3, Math.max(0, foeRow - 1)]].slice(0, Math.max(1, Math.min(4, s.nfoes))).map(([id, col, row]) =>
      ({ id, definitionId: foe, team: 'enemy', starLevel: s.foestar, location: { kind: 'board', cell: { col: (col as number) + (s.foeOffset ?? 0), row } } })),
  ];
}

/** A real combat started the way the game starts one: strategy snapshot, then the combat-start hooks (applyCombatStart via
 * createCombatWithEvents; Viktor's chaos energy, opening mana and shields are set there). Plain createCombat skips them. */
export function startRealCombat(units: any[]): { state: any; events: any[] } {
  const preparation: any = { board: DEFAULT_BOARD, benchSize: 7, units };
  const started = createCombatWithEvents(preparation, buildStrategySnapshot({ round: 1, preparation, items: [], temporaryEquipment: [],
    augments: [], persistentGrowth: [], augmentProgress: [] } as any), 'castcmp', 42);
  // Self-check: a replay that skipped combat start would silently change who casts and when.
  if (!(started.state as any).startEffectsApplied) throw new Error('real combat: combat-start hooks not applied');
  return started as { state: any; events: any[] };
}

/** Steps the combat tick by tick: up to 30 s, or `afterTicks` past the anchor cast of `me` (its first, or its
 * `castNumber`-th: v-capture --cast-index N). `onTick` sees every tick's state and display events (tick 0 carries the
 * combat-start events). `castIndex` is the anchor cast's tick (-1 when it never came). */
export function runRealCombat(units: any[], afterTicks: number, onTick: (state: any, shown: any[]) => void, castNumber = 1) {
  const started = startRealCombat(units);
  let state = started.state, castIndex = -1, ticks = 1, casts = 0;
  onTick(state, toDisplayEvents(started.events as any) as any[]);
  while (state.status !== 'finished' && ticks < 600 && (castIndex < 0 || ticks < castIndex + afterTicks)) {
    const stepped = stepCombat(state); state = stepped.state;
    const shown = toDisplayEvents(stepped.events as any) as any[];
    if (castIndex < 0 && shown.some(e => e.type === 'cast' && e.sourceId === 'me') && ++casts === castNumber) castIndex = ticks;
    onTick(state, shown); ticks++;
  }
  return { castIndex, ticks, combatStart: !!state.startEffectsApplied, finished: state.status === 'finished' };
}

/** What the recorded window [castIndex - lead (LEAD_TICKS unless asked, leadTicksFor), + windowMs] holds: the first cast
 * of `me`, its targets, whether they are alive at the end of the window, and every other unit's cast inside it. */
export function auditWindow(events: readonly (readonly any[])[], alive: readonly Readonly<Record<string, boolean>>[], castIndex: number, windowMs: number, lead: number = LEAD_TICKS) {
  const from = Math.max(0, castIndex - lead), to = from + Math.ceil(windowMs / 50);
  const cast = (events[castIndex] ?? []).find(e => e.type === 'cast' && e.sourceId === 'me');
  const targets: string[] = [...(cast?.targetIds ?? [])];
  const end = Math.min(to, alive.length - 1);
  const otherCasts: { id: string; tick: number }[] = [];
  for (let t = from; t <= Math.min(to, events.length - 1); t++) for (const e of events[t] ?? []) if (e.type === 'cast' && e.sourceId !== 'me') otherCasts.push({ id: e.sourceId, tick: t });
  const myCasts = events.slice(from, to + 1).flat().filter(e => e.type === 'cast' && e.sourceId === 'me').length;
  return { castTick: castIndex, from, to, replayEnds: alive.length - 1, coversWindow: alive.length - 1 >= to, targets,
    targetsAliveAtEnd: Object.fromEntries(targets.map(id => [id, !!alive[end]?.[id]])), otherCasts, myCasts };
}

/** Every unit's board cell this tick. */
export function cellsOf(state: any): Record<string, { row: number; col: number; alive: boolean }> {
  return Object.fromEntries(toCombatViewState(state).units.map((u: any) => [u.id, { row: u.cell.row, col: u.cell.col, alive: !!u.alive }]));
}
/** Hex distance on the harness's board (odd rows shifted half a cell right, as harness.ts hexOf draws them). */
export function hexDistance(a: { row: number; col: number }, b: { row: number; col: number }): number {
  const cube = (c: { row: number; col: number }) => { const x = c.col - (c.row - (c.row & 1)) / 2, z = c.row; return [x, z, -x - z]; };
  const [p, q] = [cube(a), cube(b)];
  return Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2]));
}
/** Foes that may hide the caster on screen when `me` casts: alive, next to `me`, on its row or nearer the camera
 * (the camera looks from the player's side, so a larger row is drawn lower and in front). A coarse stand-in for the
 * browser's box-overlap check in gate.cjs, which is the authority: a tall foe one row behind can still cover the caster
 * (Viktor vs two Garens: 36.5% on a Windows GPU run, 11-12) and only the gate sees that. */
export function frontBlockers(cells: Record<string, { row: number; col: number; alive: boolean }>): string[] {
  const me = cells.me; if (!me) return [];
  return Object.entries(cells).filter(([id, c]) => id !== 'me' && c.alive && c.row >= me.row && hexDistance(c, me) <= 1).map(([id]) => id);
}
/** Why a --foe-offset cannot be used with this many foes (every shifted foe must stay on the board's columns 0-6), or null. */
export function foeOffsetProblem(offset: number, nfoes: number): string | null {
  if (!Number.isInteger(offset)) return `--foe-offset must be a whole number of columns, got ${offset}`;
  const cols = [3, 2, 4, 3].slice(0, Math.max(1, Math.min(4, nfoes))).map(c => c + offset);
  return cols.every(c => c >= 0 && c <= 6) ? null : `--foe-offset ${offset} puts a foe off the board (columns ${cols.join(',')}; use --nfoes 1 or a smaller offset)`;
}
