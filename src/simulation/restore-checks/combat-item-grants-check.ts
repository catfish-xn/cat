// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import type { CombatItemGrant, CombatUnit } from '../combat-types';
import { G24_CHEST_PAYLOADS } from '../content/g2-4-chest-pool';
import { isG23NonCombatant, isG23Summon } from '../g2-3-summons';
import type { Source } from '../m8/contracts';
import { canonicalSource } from '../m8/identity';
import { validateH11Grant } from './h11-grant-check';

/** Restore: every grant names a fired chest trigger of a dead ally, a pool item and a tick; a chest's grants share one
 * tick, number 0…n−1, go to distinct receivers and never exceed its target count. Runs before any unit is compiled, so a
 * malformed record (or a malformed holder declaration it points at) is always reported as an invalid save. */
export function validateCombatItemGrants(units: readonly CombatUnit[], tick: number, compiledEventTriggers: (unit: CombatUnit) => readonly import('../m8/contracts').TriggerDefinition[]): void {
  try { checkCombatItemGrants(units, tick, compiledEventTriggers); } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid Match save')) throw error;
    throw new Error('Invalid Match save: combat item grants');
  }
}

function checkCombatItemGrants(units: readonly CombatUnit[], tick: number, compiledEventTriggers: (unit: CombatUnit) => readonly import('../m8/contracts').TriggerDefinition[]): void {
  const fail = (message: string): never => { throw new Error(`Invalid Match save: ${message}`); };
  const isInt = (value: unknown, minimum = 0) => Number.isSafeInteger(value) && (value as number) >= minimum;
  const isRecord = (value: unknown, keys: string): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join() === keys;
  const byChest = new Map<string, { receiver: CombatUnit; grant: CombatItemGrant }[]>();
  for (const receiver of units) {
    const grants: unknown = receiver.combatItemGrants;
    if (grants === undefined) continue;
    if (!Array.isArray(grants)) fail('combat item grants');
    for (const grant of grants as unknown[]) {
      if (!isRecord(grant, 'chest,definitionId,grantedAtTick,ordinal')) return fail('combat item grant shape');
      const chest = grant.chest;
      if (!isRecord(chest, 'definitionId,effectIndex,instanceId,ownerId,parentItemInstanceId,sourceKind') || !['item', 'augment'].includes(chest.sourceKind as string) || chest.parentItemInstanceId !== null
        || typeof chest.ownerId !== 'string' || typeof chest.definitionId !== 'string' || typeof chest.instanceId !== 'string' || !isInt(chest.effectIndex)) return fail('combat item chest source');
      if (!isInt(grant.ordinal) || !isInt(grant.grantedAtTick, chest.sourceKind === 'augment' && chest.definitionId === 'sponging' ? 0 : 1) || (grant.grantedAtTick as number) > tick
        || typeof grant.definitionId !== 'string' || !Object.hasOwn(G24_CHEST_PAYLOADS, grant.definitionId)) fail('combat item grant item/tick');
      const valid = grant as unknown as CombatItemGrant;
      if (valid.chest.sourceKind === 'augment') { validateH11Grant(units, receiver, valid); continue; }
      const holder = units.find(u => u.id === valid.chest.ownerId);
      if (!holder || holder.alive || holder.team !== receiver.team || holder.id === receiver.id) return fail('combat item chest holder');
      const triggers: unknown = compiledEventTriggers(holder), runtimes: unknown = holder.triggerLedger?.runtimes;
      if (!Array.isArray(triggers) || !Array.isArray(runtimes)) return fail('combat item chest declaration');
      const trigger = (triggers as import('../m8/contracts').TriggerDefinition[]).find(d => canonicalSource(d.source) === canonicalSource({ ...valid.chest, effectIndex: d.source.effectIndex })
        && d.effects[valid.chest.effectIndex - d.source.effectIndex]?.kind === 'grant-combat-item');
      if (!trigger || trigger.event !== 'holder-death') return fail('combat item chest declaration');
      if (trigger.selector.excludeSummons && (isG23Summon(receiver) || isG23NonCombatant(receiver))) fail('combat item summon receiver');
      if (!(runtimes as { source: Source; triggerCount: number; startsAtTick: number }[]).some(r => canonicalSource(r.source) === canonicalSource(trigger.source) && r.triggerCount === 1 && r.startsAtTick === valid.grantedAtTick)) fail('combat item chest receipt');
      const list = byChest.get(canonicalSource(valid.chest)) ?? [];
      list.push({ receiver, grant: valid }); byChest.set(canonicalSource(valid.chest), list);
      if (list.length > trigger.selector.maxTargets) fail('combat item grant count');
    }
  }
  for (const list of byChest.values()) {
    const ordinals = list.map(e => e.grant.ordinal).sort((a, b) => a - b);
    if (ordinals.some((n, i) => n !== i) || new Set(list.map(e => e.receiver.id)).size !== list.length || new Set(list.map(e => e.grant.grantedAtTick)).size !== 1) fail('combat item grant set');
  }
}
