// The real combat behind ?real=1 (harness.ts) and its pre-flight check (jobs-check.mjs): one layout, one start, one
// window, so what node simulates is what the browser replays. Simulation only: no DOM, no renderer.
import { createCombatWithEvents, stepCombat } from '../../src/simulation/combat';
import { buildStrategySnapshot } from '../../src/simulation/strategy-snapshot';
import { DEFAULT_BOARD } from '../../src/simulation/board';
import { toDisplayEvents } from '../../src/presentation/combat-display';

export interface RealSetup { unit: string; star: number; form: string | null; foe: string; dist: number; nfoes: number; foestar: number }
/** Ticks the replay keeps after the first cast of `me` when no window is asked for (3 s). */
export const DEFAULT_AFTER_TICKS = 60;
/** The replay starts this many ticks before the first cast of `me` (half a second). */
export const LEAD_TICKS = 10;

/** `me` on row 5; up to four foes `dist` rows in front ('training-dummy' is a Garen). */
export function realUnits(s: RealSetup): any[] {
  const foe = s.foe === 'training-dummy' ? 'garen' : s.foe;
  const meRow = 5, foeRow = Math.max(0, Math.min(3, meRow - Math.max(2, s.dist)));
  return [
    { id: 'me', definitionId: s.unit, team: 'player', starLevel: s.star, location: { kind: 'board', cell: { col: 3, row: meRow } }, ...(s.form ? { form: s.form } : {}) },
    ...[['foe', 3, foeRow], ['foe2', 2, foeRow], ['foe3', 4, foeRow], ['foe4', 3, Math.max(0, foeRow - 1)]].slice(0, Math.max(1, Math.min(4, s.nfoes))).map(([id, col, row]) =>
      ({ id, definitionId: foe, team: 'enemy', starLevel: s.foestar, location: { kind: 'board', cell: { col, row } } })),
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

/** Steps the combat tick by tick: up to 30 s, or `afterTicks` past the first cast of `me`. `onTick` sees every tick's
 * state and display events (tick 0 carries the combat-start events). */
export function runRealCombat(units: any[], afterTicks: number, onTick: (state: any, shown: any[]) => void) {
  const started = startRealCombat(units);
  let state = started.state, castIndex = -1, ticks = 1;
  onTick(state, toDisplayEvents(started.events as any) as any[]);
  while (state.status !== 'finished' && ticks < 600 && (castIndex < 0 || ticks < castIndex + afterTicks)) {
    const stepped = stepCombat(state); state = stepped.state;
    const shown = toDisplayEvents(stepped.events as any) as any[];
    if (castIndex < 0 && shown.some(e => e.type === 'cast' && e.sourceId === 'me')) castIndex = ticks;
    onTick(state, shown); ticks++;
  }
  return { castIndex, ticks, combatStart: !!state.startEffectsApplied, finished: state.status === 'finished' };
}

/** What the recorded window [castIndex - LEAD_TICKS, + windowMs] holds: the first cast of `me`, its targets, whether they
 * are alive at the end of the window, and every other unit's cast inside it. */
export function auditWindow(events: readonly (readonly any[])[], alive: readonly Readonly<Record<string, boolean>>[], castIndex: number, windowMs: number) {
  const from = Math.max(0, castIndex - LEAD_TICKS), to = from + Math.ceil(windowMs / 50);
  const cast = (events[castIndex] ?? []).find(e => e.type === 'cast' && e.sourceId === 'me');
  const targets: string[] = [...(cast?.targetIds ?? [])];
  const end = Math.min(to, alive.length - 1);
  const otherCasts: { id: string; tick: number }[] = [];
  for (let t = from; t <= Math.min(to, events.length - 1); t++) for (const e of events[t] ?? []) if (e.type === 'cast' && e.sourceId !== 'me') otherCasts.push({ id: e.sourceId, tick: t });
  const myCasts = events.slice(from, to + 1).flat().filter(e => e.type === 'cast' && e.sourceId === 'me').length;
  return { castTick: castIndex, from, to, replayEnds: alive.length - 1, coversWindow: alive.length - 1 >= to, targets,
    targetsAliveAtEnd: Object.fromEntries(targets.map(id => [id, !!alive[end]?.[id]])), otherCasts, myCasts };
}
