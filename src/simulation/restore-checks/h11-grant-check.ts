// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { isAugmentOrdinaryHero } from '../augment-pool-batch5-h11-history';
import type { CombatItemGrant, CombatUnit } from '../combat-types';
import { canonicalSource } from '../m8/identity';
import { asSource } from '../m8/s13-definitions';

/** Local guards only; exact victim, RNG, recipient, item and tick are authenticated
 * by the normal full combat replay and augment-history-v1 command/authority proof. */
export function validateH11Grant(units: readonly CombatUnit[], receiver: CombatUnit, grant: CombatItemGrant): void {
  const source = grant.chest, holder = units.find(u => u.id === source.ownerId);
  const mechanic = holder?.mechanics?.find(m => m.mechanic === source.definitionId
    && canonicalSource(asSource(m.source)) === canonicalSource(source));
  const grants = units.flatMap(u => u.combatItemGrants ?? []).filter(g => canonicalSource(g.chest) === canonicalSource(source));
  if (!['scavenger', 'sponging'].includes(source.definitionId) || !holder || !mechanic || holder.team !== receiver.team || !isAugmentOrdinaryHero(receiver)
    || grants.length > (source.definitionId === 'scavenger' ? mechanic.values.numDeaths : mechanic.values.maxUnits)
    || (source.definitionId === 'sponging' && (grant.grantedAtTick !== 0 || new Set(units.filter(u => u.combatItemGrants?.some(g => canonicalSource(g.chest) === canonicalSource(source))).map(u => u.id)).size !== grants.length)) || grants.map(g => g.ordinal).sort((a, b) => a - b).some((n, i) => n !== i)
    // Slot eligibility belongs to the instant of the grant. Later chest grants
    // and successful permanent equipment commands may change the final count;
    // the authenticated replay checks the original grant boundary instead.
    || (receiver.combatItemGrants ?? []).filter(g => g.chest.sourceKind === 'augment').length > 3)
    throw new Error('Invalid Match save: H11 combat item grant');
}
