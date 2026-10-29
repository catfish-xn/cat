import type { HexCell, Team } from './board';
import type { CombatUnit, CombatMechanic } from './combat-types';
import { getUnitStats } from './unit-stats';
import { resolveAbility } from './combat-abilities';
import { compileCombatInitialInputs } from './combat-initialization';
import { makeSourcedEffects, resolveEffects, initializeEffectRuntime } from './effects';
import { EMPTY_RUNTIME } from './combat-s13-state';
import { B5_G4_VOID_POLICY as POLICY } from './content/augment-pool-batch5-g4';

/** Fresh combat-only body: fixed approved stats and only the explicit Void Swarm linkage. */
export function createB5VoidBody(id: string, definitionId: 'b5-voidling' | 'g24-voidspawn', team: Team, cell: HexCell,
  health: number, attack: number, swarm?: CombatMechanic, itemSummon?: CombatUnit['itemSummon']): CombatUnit {
  const base = { ...getUnitStats(definitionId, 1), health, attack, armor: POLICY.armor, magicResist: POLICY.magicResist,
    attackRange: POLICY.range, attackIntervalTicks: 25, baseAttackSpeedBps: POLICY.attackSpeedBps };
  const sources = swarm ? makeSourcedEffects(id, 'augment', 'void-swarm', swarm.source.instanceId, [
    { kind: 'attackSpeedBps', bps: swarm.values.attackSpeedBps },
    { kind: 'mechanic', mechanic: 'voidSwarm', values: { ...swarm.values } },
  ]) : [];
  const resolved = resolveEffects(base, resolveAbility(base.abilityId, 1), sources), stats = resolved.stats;
  return {
    ...compileCombatInitialInputs(id, stats, resolved.ability, resolved), id, definitionId, team, starLevel: 1,
    ...(itemSummon ? { itemSummon } : {}), cell: { ...cell }, startingCell: { ...cell },
    attackDamage: stats.attack, attackDamageBase: resolved.attackDamageBase, attackDamagePercentBps: resolved.attackDamagePercentBps,
    attackRange: stats.attackRange, attackIntervalTicks: stats.attackIntervalTicks, baseAttackSpeedBps: stats.baseAttackSpeedBps,
    attackSpeedBonusBps: stats.attackSpeedBonusBps ?? 0, maxHpBasis: { base: health, flat: 0, bps: 0, bonusBps: 0 },
    cooldownTicks: 0, moveCooldownTicks: 0, armor: stats.armor, magicResist: stats.magicResist, ability: resolved.ability,
    sources: resolved.sources, triggers: resolved.triggers, effectRuntime: initializeEffectRuntime(resolved.triggers), mechanics: resolved.mechanics,
    shield: 0, shieldExpiresAtTick: null, shieldLayers: [], statuses: [], tasks: [], runtime: { ...EMPTY_RUNTIME }, alive: true, targetId: null,
  };
}
