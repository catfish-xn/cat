/** Multiplayer display projection only. Reuse the frozen-roster Scrap selector; never modify battle assets or stats. */
import { readCombatStrategyInputs } from '../../simulation/combat-input';
import { enforcerConfiscates } from '../../simulation/strategy-snapshot';
import { scrapConversions, g22Equipment } from '../../simulation/strategy-g2-2';
import { ITEM_DEFINITIONS } from '../../simulation/content/g2-3-item-registry';
import { battleLocalId } from '../../simulation/battle-equipment';
import type { BattleInput } from '../../simulation/two-sided-types';
import type { MatchState } from '../../simulation/match-types';
import type { Unit } from '../../simulation/unit-types';
import type { TraitSnapshot } from '../../simulation/strategy-types';
import type { CombatReplay, CombatReplayTick, CombatViewState, CombatViewUnit } from '../../simulation/combat-replay-view';

type Gear = NonNullable<CombatViewUnit['equipment']>;
type Held = { id: string; unitId: string; definitionId: string; slot: number; temporary: boolean };
interface Side { seatId: string; units: readonly Unit[]; traits: readonly TraitSnapshot[]; seed: number; round: number; held: Held[]; namespaced: boolean }
const held = (state: Pick<MatchState, 'items' | 'temporaryEquipment'>, seatId: string, namespaced: boolean): Held[] => {
  const id = (kind: string, value: string) => namespaced ? battleLocalId(seatId, kind, value) : value;
  return [...state.items.flatMap(i => i.location.kind === 'unit' ? [{ id: id('item', i.id), unitId: id('unit', i.location.unitId), definitionId: i.definitionId, slot: i.location.slot, temporary: false }] : []),
    ...state.temporaryEquipment.map(i => ({ id: id('temporary-item', i.temporaryId), unitId: id('unit', i.holderId), definitionId: i.definitionId, slot: i.slot, temporary: true }))];
};

export class ScrapDisplay {
  private readonly stackSlots = new Map<number, ReadonlyMap<string, { readonly slot: number; readonly temporary: boolean }>>();
  private readonly changes = new Map<number, ReadonlyMap<string, Gear>>();
  private current = new Map<string, Gear>();
  private readonly frames = new WeakMap<CombatReplayTick, CombatReplayTick>();
  constructor(private readonly sides: Side[]) { this.refresh(0); }
  static pvp(input: BattleInput, round: number): ScrapDisplay {
    return new ScrapDisplay([input.a, input.b].map((s, index) => {
      const team = index === 0 ? 'player' : 'enemy';
      return { seatId: s.seatId, units: input.preparation.units.filter(u => u.team === team), traits: input.strategy.traits.filter(t => t.team === team),
        seed: s.g23?.seed ?? 0, round, held: held(s, s.seatId, true), namespaced: true };
    }));
  }
  static pve(state: MatchState, strategy: { traits: readonly TraitSnapshot[] }, round: number): ScrapDisplay {
    const basis = state.combatInputBasis?.inputs ?? readCombatStrategyInputs(state);
    const gear = g22Equipment(basis);
    const owned = held(basis, '', false);
    return new ScrapDisplay([{ seatId: '', units: basis.preparation.units, traits: strategy.traits, seed: basis.g23?.seed ?? 0, round,
      held: gear.map(i => owned.find(o => o.id === i.id) ?? { ...i, slot: Number(i.id.split(':').at(-1)), temporary: false }), namespaced: false }]);
  }
  queue(tick: number, seatId: string, state: MatchState): void {
    const side = this.sides.find(s => s.seatId === seatId || !s.namespaced);
    if (!side) return;
    const own = held(state, side.seatId, side.namespaced);
    const owners = new Set(side.units.filter(u => u.team === 'player' || side.namespaced).map(u => u.id));
    side.held = [...side.held.filter(i => !owners.has(i.unitId)), ...own.filter(i => owners.has(i.unitId))];
    this.refresh(tick);
  }
  private refresh(tick: number): void {
    const next = new Map<string, Gear>();
    const stackSlots = new Map<string, { slot: number; temporary: boolean }>();
    for (const side of this.sides) {
      const converted = new Map<string, string>();
      for (const team of ['player', 'enemy'] as const) if (!enforcerConfiscates(this.sides.flatMap(s => s.traits), team)) {
        const selected = scrapConversions(side.units, side.traits.filter(t => t.team === team), side.held, ITEM_DEFINITIONS, { seed: side.seed, round: side.round });
        for (const [id, definition] of selected) converted.set(id, definition);
      }
      for (const item of side.held) stackSlots.set(item.id, { slot: item.slot, temporary: item.temporary || converted.has(item.id) });
      const owners = new Set(side.held.filter(i => converted.has(i.id)).map(i => i.unitId));
      // Keep formerly converted holders explicit, so removing/combining a component clears the old temporary icon.
      for (const id of this.current.keys()) if (side.units.some(u => u.id === id)) owners.add(id);
      for (const id of owners) next.set(id, side.held.filter(i => i.unitId === id).map(i => ({ definitionId: converted.get(i.id) ?? i.definitionId, slot: i.slot, temporary: i.temporary || converted.has(i.id) })).sort((a, b) => a.slot - b.slot));
    }
    this.stackSlots.set(tick, stackSlots);
    this.current = next; this.changes.set(tick, next);
  }
  private at(tick: number): ReadonlyMap<string, Gear> {
    let latest: ReadonlyMap<string, Gear> = new Map();
    for (const [effectiveTick, value] of this.changes) if (effectiveTick <= tick) latest = value;
    return latest;
  }
  private stacks(tick: number, rows: CombatViewUnit['itemStacks']): CombatViewUnit['itemStacks'] {
    if (rows === undefined) return undefined;
    let slots: ReadonlyMap<string, { readonly slot: number; readonly temporary: boolean }> = new Map();
    for (const [at, value] of this.stackSlots) if (at <= tick) slots = value;
    return rows.map(row => slots.has(row.instanceId) ? { ...row, ...slots.get(row.instanceId)! } : row);
  }
  state(state: CombatViewState): CombatViewState {
    const equipment = this.at(state.tick);
    return { ...state, units: state.units.map(u => ({ ...u, ...(equipment.has(u.id) ? { equipment: equipment.get(u.id)! } : {}), ...(u.itemStacks !== undefined ? { itemStacks: this.stacks(state.tick, u.itemStacks) } : {}) })) };
  }
  frame(frame: CombatReplayTick): CombatReplayTick {
    const cached = this.frames.get(frame); if (cached) return cached;
    const equipment = this.at(frame.tick);
    const events = frame.events.map(e => e.type === 'unitUpdated'
      ? { ...e, changes: { ...e.changes,
        ...(e.changes.equipment !== undefined && equipment.has(e.unitId) ? { equipment: equipment.get(e.unitId)! } : {}),
        ...(e.changes.itemStacks !== undefined ? { itemStacks: this.stacks(frame.tick, e.changes.itemStacks) } : {}) } }
      : e.type === 'unitEntered' ? { ...e, unit: { ...e.unit,
        ...(e.unit.itemStacks !== undefined ? { itemStacks: this.stacks(frame.tick, e.unit.itemStacks) } : {}) } } : e);
    if (frame.tick > 0 && this.changes.has(frame.tick)) {
      const before = this.at(frame.tick - 1);
      for (const [id, gear] of equipment) if (JSON.stringify(gear) !== JSON.stringify(before.get(id)))
        events.push({ type: 'unitUpdated', unitId: id, changes: { equipment: gear } });
    }
    const projected = { ...frame, events, ...(frame.keyframe ? { keyframe: this.state(frame.keyframe) } : {}) };
    this.frames.set(frame, projected); return projected;
  }
  replay(replay: CombatReplay): CombatReplay {
    return { ...replay, initial: this.state(replay.initial), ticks: replay.ticks.map(frame => this.frame(frame)), terminal: this.state(replay.terminal) };
  }
}
