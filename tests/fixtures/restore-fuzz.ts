import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import * as match from '../../src/simulation/match';
import { canonicalContent } from '../../src/simulation/content';
import { restoreMatch, serializeMatch } from '../../src/simulation/serialization';
import { needsCrownHistory } from '../../src/simulation/crown-history';
import { BattleHistory } from '../../src/replay/history';
import type { MatchState, MatchCommandResult, MatchStep } from '../../src/simulation/match';

export type Operation = (state: MatchState) => MatchCommandResult | MatchStep;
export const bytes = canonicalContent;
export function sameBytes(actual: unknown, expected: unknown, label: string): void {
  // Strict graph equality implies identical canonical bytes; shared immutable declarations
  // can be skipped by identity. On any difference retain the full byte comparison.
  if (isDeepStrictEqual(actual, expected)) return;
  const a = bytes(actual), b = bytes(expected);
  if (a === b) return;
  let offset = 0;
  while (offset < Math.min(a.length, b.length) && a[offset] === b[offset]) offset++;
  throw new Error(`${label}: byte ${offset}; actual=${a.slice(Math.max(0, offset - 60), offset + 100)} expected=${b.slice(Math.max(0, offset - 60), offset + 100)}`);
}
export function seeded(seed: number): (limit: number) => number {
  let word = seed >>> 0;
  return limit => { word = (Math.imul(word, 1664525) + 1013904223) >>> 0; return word % limit; };
}
export interface Failure { seed: number; build: string; step: number; round: number; tick: number | null; phase: string; entry: string; message: string }
/** Three independent entrances, never gated behind serializeMatch. No state field is excluded. */
export class RestoreProbe {
  step = 0;
  checkpoints = 0;
  continuations = 0;
  failures: Failure[] = [];
  coverage: Record<string, number> = {};
  private lanes = new Map<string, MatchState>();
  private history: BattleHistory;
  constructor(readonly seed: number, readonly build: string, readonly failFast = true) {
    this.history = new BattleHistory(`restore-fuzz-${seed}`);
  }
  private failure(state: MatchState, entry: string, error: unknown): void {
    const failure = { seed: this.seed, build: this.build, step: this.step, round: state.round,
      tick: state.combat?.tick ?? null, phase: state.phase, entry, message: String(error) };
    this.failures.push(failure);
    if (this.failFast) throw new Error(JSON.stringify(failure));
  }
  checkpoint(state: MatchState): void {
    this.checkpoints++;
    this.coverage[state.phase] = (this.coverage[state.phase] ?? 0) + 1;
    const expected = bytes(state);
    const history = needsCrownHistory(state) ? this.history.completedRecords : undefined;
    const entrances: Record<string, () => MatchState> = {
      json: () => restoreMatch(JSON.stringify(state), history),
      object: () => restoreMatch(state, history),
      serialized: () => restoreMatch(serializeMatch(state, history), history),
    };
    for (const [entry, restore] of Object.entries(entrances)) {
      try {
        const restored = restore();
        assert.equal(bytes(restored), expected, `${entry}: checkpoint bytes (including RNG/receipts)`);
        assert.equal(bytes(state), expected, `${entry}: restore must not mutate its input`);
        this.lanes.set(entry, restored);
      } catch (error) { this.lanes.delete(entry); this.failure(state, entry, error); }
    }
  }
  observe(before: MatchState, result: MatchCommandResult | MatchStep, operation: Operation): void {
    const expected = result;
    for (const [entry, state] of this.lanes) {
      try {
        const actual = operation(state);
        sameBytes(actual, expected, `${entry}: continuation bytes (state/RNG/events/receipts)`);
        this.lanes.set(entry, actual.state);
        this.continuations++;
      } catch (error) { this.lanes.delete(entry); this.failure(before, `${entry}:continue`, error); }
    }
    this.history.observe({ before, after: result.state, reason: before.phase === 'combat' ? 'tick' : 'command',
      events: ('events' in result ? result.events : []).filter(event => event.domain === 'combat') });
    this.step++;
  }
}

/** Random candidates are filtered by public command acceptance, never by guessed costs/rules. */
export function randomOperation(state: MatchState, draw: (n: number) => number): Operation {
  if (state.phase === 'combat') return match.stepMatch;
  if (state.phase === 'settlement') {
    const advance = match.nextRound(state, state.round);
    if (advance.ok) return s => match.nextRound(s, state.round);
    // Ordinary loot capacity recovery, as in generate-m5-route.cjs: sell a reserve, then retry.
    assert.equal(advance.reason, 'unsettled-round');
    for (const unit of state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench')) {
      if (match.sellUnit(state, unit.id).ok) return s => match.sellUnit(s, unit.id);
    }
    throw new Error(`no legal capacity recovery round=${state.round}`);
  }
  if (state.phase === 'choice') {
    const choice = state.pendingChoice!;
    if (choice.step === 'target') {
      const units = state.preparation.units.filter(u => u.team === 'player');
      const unit = units[draw(units.length)];
      return s => match.selectAnomalyTarget(s, choice.choiceId, choice.generation, unit.id);
    }
    const id = choice.offers[draw(choice.offers.length)];
    return s => match.selectChoice(s, choice.choiceId, choice.generation, id);
  }
  assert.equal(state.phase, 'preparation');
  const candidates: Operation[] = [match.buyXp, match.rerollShop];
  for (let slot = 0; slot < state.shop.slots.length; slot++) candidates.push(s => match.buyUnit(s, slot, state.shop.generation));
  candidates.push(s => match.setShopLock(s, !state.shop.locked, state.shop.generation));
  for (const unit of state.preparation.units.filter(u => u.team === 'player')) {
    const target = { kind: 'board' as const, cell: { col: draw(7), row: 4 + draw(4) } };
    candidates.push(s => match.deployMatchUnit(s, unit.id, target));
    if (draw(8) === 0) candidates.push(s => match.sellUnit(s, unit.id));
    for (const item of state.items.filter(i => i.location.kind === 'inventory')) {
      const slot = draw(3);
      candidates.push(s => match.equipItem(s, item.id, unit.id, slot));
    }
  }
  const inventory = state.items.filter(i => i.location.kind === 'inventory');
  if (inventory.length > 1) {
    const a = draw(inventory.length), b = (a + 1 + draw(inventory.length - 1)) % inventory.length;
    candidates.push(s => match.combineItems(s, inventory[a].id, inventory[b].id));
  }
  // Fisher-Yates preserves deterministic choice without a random comparator.
  for (let i = candidates.length - 1; i > 0; i--) { const j = draw(i + 1); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
  for (const operation of candidates) {
    const result = operation(state);
    if (!('ok' in result) || result.ok) return operation;
    assert.strictEqual(result.state, state);
    assert.equal('events' in result, false);
  }
  return match.startMatchCombat;
}

export function randomWalk(seed: number, maxSteps: number, failFast = true, checkpointRate = 7, checkpointFrom = 0): { state: MatchState; probe: RestoreProbe } {
  const draw = seeded(seed ^ 0xf022), sample = seeded(seed ^ 0x51a7);
  const probe = new RestoreProbe(seed, 'random', failFast);
  let state = match.createMatch(seed), prepSteps = 0, round = state.round;
  for (let i = 0; i < maxSteps && state.phase !== 'gameOver'; i++) {
    if (round !== state.round) { round = state.round; prepSteps = 0; }
    const chosen = i === 0 || sample(checkpointRate) === 0;
    if (i >= checkpointFrom && (i === 0 || chosen)) probe.checkpoint(state);
    const operation = state.phase === 'preparation' && prepSteps++ >= 18 ? match.startMatchCombat : randomOperation(state, draw);
    const result = operation(state);
    assert.ok(!('ok' in result) || result.ok, `random seed=${seed} step=${i}: ${'reason' in result ? result.reason : ''}`);
    probe.observe(state, result, operation); state = result.state;
  }
  return { state, probe };
}
