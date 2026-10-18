/** Deterministic item primitives. Integration into combat is deliberately separate.
 * All state returned here is plain data; no random state lives in a closure.
 */
import { nextRandom, validateSeed } from './rng';
import { contains, hexDistance, type Board, type HexCell } from './board';

export type ItemRandomPurpose = 'fishbones' | 'collector' | 'gamblers-blade';
const STREAM_SALTS: Readonly<Record<ItemRandomPurpose, number>> = {
  fishbones: 0x66697368, collector: 0x636f6c6c, 'gamblers-blade': 0x67616d62,
};
export interface ItemRandomStream { readonly state: number; readonly draws: number }
export type ItemRandomStreams = Readonly<Record<ItemRandomPurpose, ItemRandomStream>>;

export function createItemRandomStreams(battleSeed: number): ItemRandomStreams {
  validateSeed(battleSeed);
  return Object.fromEntries(Object.entries(STREAM_SALTS).map(([purpose, salt]) =>
    [purpose, {state: (battleSeed ^ salt) >>> 0, draws: 0}])) as unknown as ItemRandomStreams;
}

export function drawItemRandom(streams: ItemRandomStreams, purpose: ItemRandomPurpose) {
  const previous = streams[purpose], next = nextRandom(previous.state);
  if (!Number.isSafeInteger(previous.draws) || previous.draws < 0 || previous.draws === Number.MAX_SAFE_INTEGER)
    throw new RangeError('Invalid item random draw count');
  return {word: next.word, streams: {...streams, [purpose]: {state: next.state, draws: previous.draws + 1}}};
}

/** lcg skip-ahead in O(log n), with uint32 arithmetic. Restore never consumes RNG. */
function advanceWord(seed: number, draws: number): number {
  let multiplier = 1664525, increment = 1013904223, resultMultiplier = 1, resultIncrement = 0;
  for (let remaining = draws; remaining > 0; remaining = Math.floor(remaining / 2)) {
    if (remaining % 2) {
      resultIncrement = (Math.imul(resultIncrement, multiplier) + increment) >>> 0;
      resultMultiplier = Math.imul(resultMultiplier, multiplier) >>> 0;
    }
    increment = Math.imul(increment, (multiplier + 1) >>> 0) >>> 0;
    multiplier = Math.imul(multiplier, multiplier) >>> 0;
  }
  return (Math.imul(seed, resultMultiplier) + resultIncrement) >>> 0;
}

export function validateItemRandomStreams(streams: ItemRandomStreams, battleSeed: number,
  expectedDraws: Readonly<Record<ItemRandomPurpose, number>>): void {
  const initial = createItemRandomStreams(battleSeed);
  if (!streams || Object.keys(streams).length !== 3) throw new RangeError('Invalid item random streams');
  for (const purpose of Object.keys(initial) as ItemRandomPurpose[]) {
    const stream = streams[purpose], count = expectedDraws[purpose];
    if (!stream || Object.keys(stream).length !== 2 || !Number.isSafeInteger(count) || count < 0
      || stream.draws !== count || stream.state !== advanceWord(initial[purpose].state, count))
      throw new RangeError('Invalid item random streams');
  }
}

/** Caller supplies the eligible enemies at the attack barrier, not all board units.
 * An empty pool is not an attack and does not advance any stream.
 */
export function chooseFishbonesTarget(streams: ItemRandomStreams, eligibleIds: readonly string[]) {
  if (new Set(eligibleIds).size !== eligibleIds.length || eligibleIds.some(id => !id))
    throw new RangeError('Invalid fishbones target pool');
  if (!eligibleIds.length) return {targetId: null, streams};
  const ids = [...eligibleIds].sort(), draw = drawItemRandom(streams, 'fishbones');
  return {targetId: ids[Math.floor(draw.word * ids.length / 2 ** 32)], streams: draw.streams};
}

export interface DeferredItemDamage {
  readonly packetId: string;
  readonly startedAtTick: number;
  readonly amount: number;
  readonly paid: number;
  readonly elapsedTicks: number;
}
const integer = (value: number) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Invalid item integer');
};

/** Split an already-mitigated eligible amount. Shield/redirect ordering belongs
 * to the combat adapter and must be documented before this is connected.
 */
export function deferItemDamage(packetId: string, amount: number, tick: number, fractionBps: number) {
  integer(amount); integer(tick); integer(fractionBps);
  if (!packetId || fractionBps > 10000) throw new RangeError('Invalid deferred item damage');
  const delayed = Number(BigInt(amount) * BigInt(fractionBps) / 10000n);
  return {immediate: amount - delayed,
    debt: {packetId, startedAtTick: tick, amount: delayed, paid: 0, elapsedTicks: 0} satisfies DeferredItemDamage};
}

/** Cumulative division preserves every remainder. Nonlethal excess is consumed,
 * never carried forward to kill a unit after a later heal. Duplicate ticks pay 0.
 */
export function advanceDeferredItemDamage(debt: DeferredItemDamage, tick: number, hp: number, durationTicks: number) {
  integer(tick); integer(hp); integer(durationTicks);
  if (durationTicks === 0) throw new RangeError('Invalid deferred damage duration');
  validateDeferredItemDamage(debt, tick, durationTicks);
  const elapsedTicks = Math.min(durationTicks, tick - debt.startedAtTick);
  if (elapsedTicks < debt.elapsedTicks) throw new RangeError('Deferred damage time reversal');
  const paid = Number(BigInt(debt.amount) * BigInt(elapsedTicks) / BigInt(durationTicks));
  const damage = Math.min(Math.max(0, hp - 1), paid - debt.paid);
  return {damage, hpAfter: hp - damage, debt: {...debt, paid, elapsedTicks}, finished: elapsedTicks === durationTicks};
}

export function validateDeferredItemDamage(debt: DeferredItemDamage, tick: number, durationTicks: number): void {
  if (!debt || Object.keys(debt).length !== 5 || typeof debt.packetId !== 'string' || !debt.packetId)
    throw new RangeError('Invalid deferred item damage');
  for (const value of [debt.startedAtTick, debt.amount, debt.paid, debt.elapsedTicks, tick, durationTicks]) integer(value);
  if (!durationTicks || debt.startedAtTick > tick || debt.elapsedTicks > durationTicks
    || debt.elapsedTicks > tick - debt.startedAtTick
    || debt.paid !== Number(BigInt(debt.amount) * BigInt(debt.elapsedTicks) / BigInt(durationTicks)))
    throw new RangeError('Invalid deferred item damage');
}

export function manaReavedMaximum(baseMaximum: number, reaveBps: number): number {
  integer(baseMaximum); integer(reaveBps);
  const value = BigInt(baseMaximum) * (10000n + BigInt(reaveBps));
  const result = Number((value + 9999n) / 10000n);
  integer(result); return result;
}

export function mirroredItemCell(board: Board, cell: HexCell): HexCell {
  if (!contains(board, cell)) throw new RangeError('Invalid item origin cell');
  return {col: board.columns - 1 - cell.col, row: board.rows - 1 - cell.row};
}

/** No collision policy is silently encoded here: caller decides the eligible
 * cells first. Distance ties use row then column, a project convention.
 */
export function nearestItemCell(origin: HexCell, candidates: readonly HexCell[]): HexCell | null {
  const cell = [...candidates].sort((a, b) => hexDistance(origin, a) - hexDistance(origin, b)
    || a.row - b.row || a.col - b.col)[0];
  return cell ? {...cell} : null;
}
