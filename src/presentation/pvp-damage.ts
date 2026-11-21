/** On-demand PvP settlement feedback. No runtime imports: this chunk cannot pull rules or the app back in. */
import type { MatchState, RoundResult } from '../simulation/match-types';
import type { PlayerView } from '../rendering/online/protocol';
import type { FinishedBattle } from '../rendering/online/remote-session';

export interface PvpDamage {
  readonly key: string;
  readonly target: 'me' | 'opponent';
  readonly damage: number;
  readonly sources: readonly { readonly col: number; readonly row: number }[];
}
const HIT_MS = 2600;
let nextMatchId = 0;
const validDamage = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
/** Definition-identifiable exclusions from countsG23SurvivorDamage, including origin-tagged summons.
 * Compact replay omits itemSummon/anomalySummon. Copies sharing a roster definition cannot be
 * distinguished here; never exclude their ordinary roster counterpart. Rule parity is tested
 * without importing the rule graph into this standalone UI chunk. */
const NON_DAMAGE_SURVIVOR_DEFINITIONS: readonly string[] = [
  'g23-sion', 'g23-forge', 'g23-barrel', 'v20-silco-minion',
  'b5-voidling', 'trainer-golem', 'carry-golem',
  's13-wolf', 's13-mini', 's13-crab', 'g24-voidspawn',
];

/** Only settlement player HP fields are used; unit damage totals never enter this path. */
export function pvpDamagePlans(result: Pick<RoundResult, 'round' | 'roundId' | 'roundKind' | 'result' | 'damageDealt' | 'hpLost'>,
  battle: FinishedBattle | null): PvpDamage[] {
  if (result.roundKind !== 'pvp') return [];
  const key = `round:${result.round}:${result.roundId}`;
  const units = battle?.round === result.round && battle.roundId === result.roundId && battle.replay.stream?.ended !== false
    ? battle.replay.terminal.units : [];
  const sources = (team: 'player' | 'enemy') => units.filter(unit => unit.team === team && unit.alive
    && !NON_DAMAGE_SURVIVOR_DEFINITIONS.includes(unit.definitionId)).map(unit => ({ ...unit.cell }));
  return [
    ...((result.result === 'playerWin' || result.result === 'draw') && validDamage(result.damageDealt) ? [{ key, target: 'opponent' as const, damage: result.damageDealt, sources: sources('player') }] : []),
    ...(validDamage(result.hpLost) ? [{ key, target: 'me' as const, damage: result.hpLost, sources: sources('enemy') }] : []),
  ];
}

/** Public views identify the opponent of THIS round; private states supply the actual loss. Either may arrive first. */
export function createPvpDamageFeedback(root: HTMLElement, publish: (hit: PvpDamage) => void) {
  let matchId = nextMatchId++;
  let seeded = false, latestRound = -1, disposed = false, view: PlayerView | null = null;
  const opponents = new Map<number, string>();
  const pending = new Map<string, { hit: PvpDamage; round: number }>();
  const hits = new Map<string, { damage: number; at: number }>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Callers (and disposed test doubles) may hand a root that is not an element.
  // querySelectorAll throwing here becomes an unhandled rejection: reset/dispose
  // run from an uncaught dynamic-import continuation.
  const seats = () => typeof root?.querySelectorAll === 'function' ? root.querySelectorAll<HTMLElement>('.online-seat') : [];
  const damageNodes = () => typeof root?.querySelectorAll === 'function' ? root.querySelectorAll('[data-pvp-damage]') : [];
  const rowFor = (id: string) => Array.from(seats()).find(row => row.dataset.debug === `online:seat:${id}`);
  const paint = () => {
    const now = performance.now();
    for (const [id, hit] of hits) {
      if (now - hit.at >= HIT_MS) { hits.delete(id); continue; }
      const row = rowFor(id), seat = view?.seats.find(seat => seat.seatId === id);
      const bar = row?.querySelector<HTMLElement>('.seat-bar'), foot = row?.querySelector<HTMLElement>('.seat-foot');
      if (!row || !bar || !foot || !seat) continue;
      const chip = row.querySelector<HTMLElement>('.seat-damage') ?? document.createElement('span');
      chip.className = 'seat-damage'; chip.textContent = `-${hit.damage}`; chip.dataset.debug = `online:seat-damage:${id}`;
      chip.dataset.pvpDamage = 'true'; chip.style.animationDelay = `${-(now - hit.at)}ms`;
      if (!chip.parentNode) foot.insertBefore(chip, foot.lastChild);
      const lost = bar.querySelector<HTMLElement>('.seat-lost') ?? document.createElement('div');
      lost.className = 'seat-lost'; lost.dataset.pvpDamage = 'true'; lost.style.animationDelay = chip.style.animationDelay;
      const percent = (hp: number) => `${Math.max(0, Math.min(100, hp))}%`;
      lost.style.setProperty('--lost-from', percent(seat.hp + hit.damage)); lost.style.setProperty('--lost-to', percent(seat.hp));
      if (!lost.parentNode) bar.prepend(lost);
      row.classList.add('hit'); row.style.animationDelay = chip.style.animationDelay;
    }
  };
  const flush = () => {
    if (!view || disposed) return;
    for (const [key, entry] of pending) {
      const id = entry.hit.target === 'me' ? view.mySeatId : opponents.get(entry.round);
      if (!id) continue;
      pending.delete(key); hits.set(id, { damage: entry.hit.damage, at: performance.now() });
      publish(entry.hit);
    }
    paint();
    clearTimeout(timer);
    if (hits.size) timer = setTimeout(() => {
      for (const node of Array.from(damageNodes())) node.remove();
      hits.clear(); timer = undefined;
    }, HIT_MS);
  };
  const reset = () => {
    matchId = nextMatchId++;
    seeded = false; latestRound = -1; view = null; opponents.clear(); pending.clear(); hits.clear(); clearTimeout(timer);
    for (const node of Array.from(damageNodes())) node.remove();
  };
  return {
    view(next: PlayerView) {
      if (disposed) return;
      view = next;
      if (next.opponentSeatId) opponents.set(next.phase.round, next.opponentSeatId);
      for (const round of opponents.keys()) if (round < next.phase.round - 1) opponents.delete(round);
      for (const [key, entry] of pending) if (entry.round < next.phase.round - 1) pending.delete(key);
      flush();
    },
    state(state: MatchState, battle: FinishedBattle | null) {
      if (disposed) return;
      const result = state.roundResults.at(-1);
      if (seeded && result && result.round > latestRound) for (const hit of pvpDamagePlans(result, battle)) {
        const scoped = { ...hit, key: `${matchId}:${hit.key}` };
        pending.set(`${scoped.key}:${hit.target}`, { hit: scoped, round: result.round });
      }
      latestRound = Math.max(latestRound, result?.round ?? -1); seeded = true;
      flush();
    },
    reset,
    dispose() { reset(); disposed = true; },
  };
}
export type PvpDamageFeedback = ReturnType<typeof createPvpDamageFeedback>;
