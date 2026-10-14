import type { ResolvedAbility } from './ability-types';
import type { CombatUnit } from './combat-types';
import type { StrategyUnitSnapshot } from './strategy-types';
import type { ResolvedUnitStats } from './unit-types';
import { collectTriggers } from './effects';
import { compileItemCrit, itemPrograms } from './m8/item-program';
import { compileUnitInputs } from './m8/unit-inputs';

/** Pure numeric inputs shared by Combat construction and current-round previews.
 * No Combat state, event, mechanism execution, random draw or identity allocation. */
export function compileCombatInitialInputs(id: string, stats: ResolvedUnitStats, ability: ResolvedAbility,
  resolved?: Pick<StrategyUnitSnapshot, 'mechanics' | 'abilityPower' | 'itemPrograms'>) {
  const inputs = {
    ...compileUnitInputs(stats),
    hp: Math.floor(stats.health * (resolved?.mechanics?.find(m => m.mechanic === 'glassCannon')?.values.startingHealthBps ?? 10000) / 10000),
    maxHp: stats.health, mana: stats.initialMana, maxMana: stats.maxMana,
    ...(ability.kind === 's13' ? { abilityPower: resolved?.abilityPower ?? 100,
      ...(resolved?.itemPrograms ? { itemPrograms: structuredClone(resolved.itemPrograms) } : {}) } : {}),
  };
  return itemPrograms(inputs).length
    ? { ...inputs, spellCrit: compileItemCrit({ ...inputs, id, ability }) }
    : inputs;
}

/** The actual combatStart trigger batch and capped mana result, without events.
 * Callers use the same batch for shields and receipts; preview discards that metadata. */
export function projectCombatStartMana(unit: Pick<CombatUnit, 'id' | 'mana' | 'maxMana' | 'triggers' | 'effectRuntime'>) {
  const batch = collectTriggers(unit.triggers ?? [], unit.effectRuntime ?? [], 'combatStart', unit.id, null);
  const gain = batch.invocations.reduce((sum, invocation) => sum + (invocation.action.kind === 'gainMana' ? invocation.action.amount : 0), 0);
  return { ...batch, gain, after: Math.min(unit.maxMana, unit.mana + gain), overflow: Math.max(0, unit.mana + gain - unit.maxMana) };
}
