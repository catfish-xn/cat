import { scaleItemSummonHp } from './g2-4b-summons';
/** Battle-time equipment uses the opening strategy compiler and preserves runtime.
 * Receipts are server-private source inputs, not client-supplied resolved numbers. */
import type { Team } from './board';
import type { CombatState, CombatUnit } from './combat-types';
import type { CombatStrategyInputs } from './combat-input';
import type { MatchState } from './match-types';
import type { StrategySnapshot } from './strategy-types';
import type { BattleEquipmentInput } from './battle-input-log';
import { buildStrategySnapshot } from './strategy-snapshot';
import { canonicalContent } from './content';
import { freezeContent } from './content/freeze';
import { initializeEffectRuntime } from './effects';
import { compileItemCrit } from './m8/item-program';
import { compileMechanismDefinitions } from './m8/s13-definitions';
import { changeMaxHp, resolveStat } from './m8/stats';
import { constantModifier, hpSample } from './combat-s13-state';
import { createItemRandomStreams } from './g2-4b-item-kernel';
import { freezeCombatDeclarations } from './combat-static';

export interface BattleEquipmentReceipt {
  readonly input: BattleEquipmentInput;
  readonly team: Team;
  readonly combatUnitId: string;
  /** Frozen non-equipment inputs plus the equipment accepted by Match. No RNG is drawn here. */
  readonly before: CombatStrategyInputs;
  readonly after: CombatStrategyInputs;
  readonly battleSeed: number;
  readonly resourceSequence: number;
}
export type BattleEquipmentFailure = 'battle-input-invalid' | 'battle-unit-unavailable';
export const battleLocalId = (seat: string, kind: string, id: string) => JSON.stringify(['t2', seat, kind, id]);
export function validBattleInput(input: BattleEquipmentInput): boolean {
  return !!input && input.kind === 'equipment' && Number.isSafeInteger(input.seq) && input.seq > 0
    && Number.isSafeInteger(input.effectiveTick) && input.effectiveTick > 0 && input.effectiveTick <= 1200
    && [input.seatId, input.itemId, input.unitId].every(id => typeof id === 'string' && id.length > 0)
    && Number.isSafeInteger(input.slot) && input.slot >= 0 && input.slot < 3
    && Object.keys(input).sort().join() === 'effectiveTick,itemId,kind,seatId,seq,slot,unitId';
}
/** Called only with the result of a successful authoritative equipItem transaction. */
export function prepareBattleEquipment(before: CombatStrategyInputs, input: BattleEquipmentInput, equipped: MatchState,
  team: Team, battleSeed: number, namespaced = false): BattleEquipmentReceipt {
  if (!validBattleInput(input)) throw new RangeError('battle-input-invalid');
  const id = (kind: string, value: string) => namespaced ? battleLocalId(input.seatId, kind, value) : value;
  const combatUnitId = id('unit', input.unitId);
  if (!before.preparation.units.some(u => u.id === combatUnitId && u.location.kind === 'board')) throw new RangeError('battle-unit-unavailable');
  const items = equipped.items.filter(i => i.location.kind === 'unit' && i.location.unitId === input.unitId)
    .map(i => ({ ...i, id: id('item', i.id), location: { ...i.location, kind: 'unit' as const, unitId: combatUnitId, slot: i.location.kind === 'unit' ? i.location.slot : 0 } }));
  const temporaryEquipment = equipped.temporaryEquipment.filter(i => i.holderId === input.unitId).map(i => ({ ...i,
    temporaryId: id('temporary-item', i.temporaryId), parentItemInstanceId: id('item', i.parentItemInstanceId), holderId: combatUnitId }));
  return freezeContent(structuredClone({ input, team, combatUnitId, before, battleSeed, resourceSequence: equipped.resourceProvenance.entries.length - 1,
    after: { ...before, items: [...before.items.filter(i => i.id !== id('item', input.itemId) && (i.location.kind !== 'unit' || i.location.unitId !== combatUnitId)), ...items],
      temporaryEquipment: [...before.temporaryEquipment.filter(i => i.holderId !== combatUnitId), ...temporaryEquipment],
      // A newly equipped Gambler needs the authenticated bank, even when absent at opening.
      ...(items.some(i => i.definitionId === 'TFT7_Item_ShimmerscaleGamblersBlade') ? { bankGold: equipped.gold } : {}) } }));
}
function strategy(inputs: CombatStrategyInputs, opening: StrategySnapshot, team: Team): StrategySnapshot {
  const ids = new Set(inputs.preparation.units.map(u => u.id));
  const frozen = { traits: opening.traits.filter(t => t.team === team).map(t => ({ ...t, team: 'player' as const })),
    units: opening.units.filter(u => ids.has(u.unitId)) };
  const compiled = buildStrategySnapshot(inputs, undefined, undefined, frozen);
  return { ...compiled, traits: compiled.traits.map(t => ({ ...t, team })) };
}
const hpParts = (unit: StrategySnapshot['units'][number]) => ({
  flat: unit.sources.reduce((sum, s) => sum + (s.effect.kind === 'statFlat' && s.effect.stat === 'maxHp' ? s.effect.amount : 0), 0),
  bps: unit.sources.reduce((sum, s) => sum + (s.effect.kind === 'statPercentBps' && s.effect.stat === 'maxHp' ? s.effect.bps : 0), 0),
});
/** Pure install at the unsealed boundary. A refusal returns the exact original object. */
export function applyBattleEquipment(state: CombatState, receipt: BattleEquipmentReceipt):
  { readonly ok: true; readonly state: CombatState } | { readonly ok: false; readonly state: CombatState; readonly reason: BattleEquipmentFailure } {
  const refuse = (reason: BattleEquipmentFailure) => ({ ok: false as const, state, reason });
  const input = receipt.input;
  if (!validBattleInput(input) || input.effectiveTick !== state.tick + 1 || state.status !== 'running'
    || (state.equipmentReceipts?.at(-1)?.input.seq ?? 0) >= input.seq) return refuse('battle-input-invalid');
  const target = state.units.find(u => u.id === receipt.combatUnitId && u.team === receipt.team && !u.itemSummon && !u.anomalySummon);
  if (!target || !state.strategy) return refuse('battle-unit-unavailable');
  try {
    const { items: _beforeItems, temporaryEquipment: _beforeTemporary, bankGold: _beforeBank, ...beforeBasis } = receipt.before;
    const { items: _afterItems, temporaryEquipment: _afterTemporary, bankGold: _afterBank, ...afterBasis } = receipt.after;
    if (canonicalContent(beforeBasis) !== canonicalContent(afterBasis)
      || ![input.unitId, battleLocalId(input.seatId, 'unit', input.unitId)].includes(receipt.combatUnitId)) return refuse('battle-input-invalid');
    const prior = state.equipmentReceipts?.filter(r => r.team === receipt.team).at(-1);
    if (prior && canonicalContent(prior.after) !== canonicalContent(receipt.before)) return refuse('battle-input-invalid');
    const before = strategy(receipt.before, state.strategy, receipt.team), after = strategy(receipt.after, state.strategy, receipt.team);
    if (!prior) for (const unit of before.units) {
      const original = state.strategy.units.find(u => u.unitId === unit.unitId);
      if (!original || canonicalContent(unit.stats) !== canonicalContent(original.stats)
        || canonicalContent(unit.ability) !== canonicalContent(original.ability)) return refuse('battle-input-invalid');
    }
    const units = state.units.map(unit => {
      const old = before.units.find(u => u.unitId === unit.id), next = after.units.find(u => u.unitId === unit.id);
      if (!old || !next || canonicalContent(old) === canonicalContent(next) && unit.id !== receipt.combatUnitId) return unit;
      const result: { -readonly [K in keyof CombatUnit]: CombatUnit[K] } = { ...unit };
      // Static base deltas preserve damage, casts, accumulated buffs, cooldowns and shields.
      result.attackDamage += next.stats.attack - old.stats.attack;
      result.armor += next.stats.armor - old.stats.armor;
      result.magicResist += next.stats.magicResist - old.stats.magicResist;
      result.attackRange += next.stats.attackRange - old.stats.attackRange;
      result.attackIntervalTicks = next.stats.attackIntervalTicks;
      result.attackDamageBase = (unit.attackDamageBase ?? old.attackDamageBase ?? 0) + (next.attackDamageBase ?? 0) - (old.attackDamageBase ?? 0);
      result.attackDamagePercentBps = (unit.attackDamagePercentBps ?? 0) + (next.attackDamagePercentBps ?? 0) - (old.attackDamagePercentBps ?? 0);
      result.abilityPower = (unit.abilityPower ?? 100) + (next.abilityPower ?? 100) - (old.abilityPower ?? 100);
      // These two are replaced, not shifted by a delta: they must stay static during a battle (in-combat haste lives in
      // separate status fields), so the recompiled values are the right ones to carry forward.
      result.baseAttackSpeedBps = next.stats.baseAttackSpeedBps ?? Math.floor(200000 / next.stats.attackIntervalTicks);
      result.attackSpeedBonusBps = next.stats.attackSpeedBonusBps ?? 0;
      result.maxMana += next.stats.maxMana - old.stats.maxMana;
      result.mana = unit.alive ? Math.min(result.maxMana, unit.mana + Math.max(0, next.stats.initialMana - old.stats.initialMana)) : 0;
      const oldHp = hpParts(old), newHp = hpParts(next);
      if (result.maxHpBasis) {
        result.maxHpBasis = { ...result.maxHpBasis, flat: result.maxHpBasis.flat + newHp.flat - oldHp.flat,
          bps: result.maxHpBasis.bps + newHp.bps - oldHp.bps };
        const b = result.maxHpBasis;
        const maximum = scaleItemSummonHp(unit, resolveStat('maxHp', b.base, [constantModifier('maxHp', b.flat), constantModifier('maxHp', b.bps + b.bonusBps, 'bps')], { holder: hpSample(unit) }));
        result.hp = unit.alive ? changeMaxHp(unit.maxHp, unit.hp, maximum).afterHp : 0;
        result.maxHp = maximum;
      }
      result.sources = next.sources; result.triggers = next.triggers; result.mechanics = next.mechanics;
      result.itemPrograms = next.itemPrograms ?? [];
      result.effectRuntime = initializeEffectRuntime(next.triggers).map(r => unit.effectRuntime?.find(old => old.key === r.key) ?? r);
      const itemIds = (s: typeof old) => [...s.sources.filter(e => e.source.sourceKind === 'item').map(e => e.source.sourceInstanceId),
        ...s.itemPrograms?.filter(p => p.source.sourceKind === 'item').map(p => p.source.instanceId) ?? []];
      const oldItems = new Set(itemIds(old));
      const added = [...new Set(itemIds(next).filter(id => !oldItems.has(id)))];
      const nextItems = new Set(itemIds(next));
      const removed = (source: { sourceKind: string; instanceId: string }) => source.sourceKind === 'item' && oldItems.has(source.instanceId) && !nextItems.has(source.instanceId);
      if (result.mechanismState) result.mechanismState = { ...result.mechanismState,
        periodicTasks: result.mechanismState.periodicTasks.filter(t => !removed(t.source)),
        activities: result.mechanismState.activities.filter(a => !removed(a.source)),
      };
      if (added.length && unit.alive) result.pendingEquipmentSources = [...unit.pendingEquipmentSources ?? [], ...added];
      result.spellCrit = compileItemCrit(result);
      result.mechanismDefinitions = compileMechanismDefinitions(result, state.combatId!);
      if (next.openingItemBankGold !== undefined && result.openingItemBankGold === undefined) {
        result.openingItemBankGold = next.openingItemBankGold; result.currentItemBankGold = next.openingItemBankGold;
      }
      if (next.mechanics?.some(m => m.mechanic === 'g24Mogul')) result.itemMogulHits ??= [];
      if (next.mechanics?.some(m => m.mechanic === 'g24DeathsDefiance')) result.deferredItemDamage ??= [];
      if (unit.id === receipt.combatUnitId) result.equipment = [
        ...receipt.after.items.flatMap(i => i.location.kind === 'unit' && i.location.unitId === unit.id ? [{ definitionId: i.definitionId, slot: i.location.slot, temporary: false }] : []),
        ...receipt.after.temporaryEquipment.filter(i => i.holderId === unit.id).map(i => ({ definitionId: i.definitionId, slot: i.slot, temporary: true })),
      ].sort((a, b) => a.slot - b.slot);
      return freezeCombatDeclarations(result);
    });
    const randomItems = units.some(u => u.mechanics?.some(m => ['g24Fishbones','g24Collector','g24Gambler','g24Mogul','v19Chainblade'].includes(m.mechanic)));
    return { ok: true, state: { ...state, units, ...(randomItems && !state.itemRandomStreams ? { itemRandomStreams: createItemRandomStreams(receipt.battleSeed), itemGoldReceipts: [] } : {}),
      equipmentReceipts: [...state.equipmentReceipts ?? [], receipt] } };
  } catch { return refuse('battle-input-invalid'); }
}
/** Validate the private parallel transcript before replay; no extra or missing successes. */
export function validateBattleEquipmentLog(inputs: readonly BattleEquipmentInput[] | undefined, receipts: readonly BattleEquipmentReceipt[] | undefined, tick: number): void {
  if (inputs === undefined && receipts === undefined) return;
  if (!Array.isArray(inputs) || !Array.isArray(receipts) || inputs.length !== receipts.length) throw new RangeError('battle-input-invalid');
  let seq = 0, previousTick = 0;
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    if (!validBattleInput(input) || input.seq <= seq || input.effectiveTick < previousTick || input.effectiveTick > tick
      || canonicalContent(input) !== canonicalContent(receipts[i].input)) throw new RangeError('battle-input-invalid');
    seq = input.seq; previousTick = input.effectiveTick;
  }
}
export function installBattleEquipmentBatch(state: CombatState, receipts: readonly BattleEquipmentReceipt[]): CombatState {
  let next = state;
  for (const receipt of receipts) {
    const applied = applyBattleEquipment(next, receipt);
    if (!applied.ok) throw new RangeError(applied.reason);
    next = applied.state;
  }
  return next;
}
