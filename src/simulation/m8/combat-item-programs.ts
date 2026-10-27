/** G2-4b: programs bound from items gained during combat (Unstable Treasure Chest). The grant record is the only
 * dynamic fact; the program itself always comes from the frozen pool, so compile and restore derive it identically. */
import { p3ItemProgram } from '../s13-p3-programs';
import type { CombatItemGrant, CombatUnit } from '../combat-types';
import type { BoundItemProgram, ItemProgram } from './item-program';
import type { Source } from './contracts';
import { G24_CHEST_PAYLOADS } from '../content/g2-4-chest-pool';
import { p2GrantedItemProgram } from '../s13-augments-p2-strategy';

export const GRANTED_ITEM_EFFECT_INDEX = 1024;
export const grantedItemInstanceId = (grant: CombatItemGrant): string =>
  JSON.stringify([grant.chest.sourceKind === 'augment' ? 'augment-h11' : 'chest', grant.chest.ownerId, grant.chest.instanceId, grant.chest.effectIndex, grant.ordinal]);
export function grantedItemSource(unitId: string, grant: CombatItemGrant): Source {
  return { ownerId: unitId, sourceKind: 'item', definitionId: grant.definitionId, instanceId: grantedItemInstanceId(grant), effectIndex: GRANTED_ITEM_EFFECT_INDEX, parentItemInstanceId: null };
}
/** The grant whose bound program declares this source, if any. */
export function grantOfSource(unit: Pick<CombatUnit, 'combatItemGrants'>, source: Pick<Source, 'sourceKind' | 'instanceId'>): CombatItemGrant | undefined {
  return source.sourceKind === 'item' ? unit.combatItemGrants?.find(g => grantedItemInstanceId(g) === source.instanceId) : undefined;
}
/** Periodic clocks start at the grant: a pulse is due one period after the item arrives, and windows shift with it. */
function shifted(program: ItemProgram, at: number): ItemProgram {
  if (!program.periodic) return program;
  return { ...program, periodic: program.periodic.map(p => ({ ...p, startsAtTick: at + (p.startsAtTick ?? p.periodTicks), ...(p.endsAtTick !== undefined ? { endsAtTick: at + p.endsAtTick } : {}) })) };
}
/** Saved grants are checked in full by validateCombatItemGrants; this guard only keeps a malformed one an invalid save. */
function payloadOf(grant: CombatItemGrant) {
  const payload = grant && typeof grant === 'object' && grant.chest && typeof grant.chest === 'object' && typeof grant.definitionId === 'string'
    && Object.hasOwn(G24_CHEST_PAYLOADS, grant.definitionId) ? G24_CHEST_PAYLOADS[grant.definitionId] : undefined;
  if (!payload) throw new Error('Invalid Match save: combat item grant');
  return payload;
}
let cache = new WeakMap<readonly CombatItemGrant[], { unitId: string; mechanics: CombatUnit['mechanics']; p3Key: string; bound: readonly BoundItemProgram[] }>();
/** External save candidates are mutable. Never read or populate the live combat
 * cache during validation; nested calls and failures restore the previous scope. */
export function withGrantedItemRestoreCache<T>(run: () => T): T {
  const previous = cache;
  cache = new WeakMap();
  try { return run(); } finally { cache = previous; }
}
export function grantedItemPrograms(unit: Pick<CombatUnit, 'id' | 'combatItemGrants'> & Partial<Pick<CombatUnit,'mechanics'>>): readonly BoundItemProgram[] {
  const grants = unit.combatItemGrants;
  if (grants !== undefined && !Array.isArray(grants)) throw new Error('Invalid Match save: combat item grants');
  if (!grants?.length) return [];
  const augments=(unit.mechanics??[]).filter(m=>m.mechanic==='s13P3'&&m.source.sourceKind==='augment');
  const ids=augments.map(m=>m.source.definitionId),stage=augments[0]?.values.stage??1,p3Key=JSON.stringify([ids,stage]);
  const hit = cache.get(grants);
  if (hit && hit.unitId === unit.id && hit.mechanics===unit.mechanics && hit.p3Key === p3Key) return hit.bound;
  const bound = grants.map(grant => {
    const payload = payloadOf(grant);
    return { source: grantedItemSource(unit.id, grant), program: shifted(p3ItemProgram(grant.definitionId,p2GrantedItemProgram(unit,grant.definitionId,payload.program),ids,stage), grant.grantedAtTick) };
  });
  cache.set(grants, { unitId: unit.id, mechanics:unit.mechanics, p3Key, bound });
  return bound;
}
/** Health basis added by grants received at or before `at` (all grants when omitted). */
export function grantedMaxHpBasis(unit: Pick<CombatUnit, 'combatItemGrants'>, at = Number.MAX_SAFE_INTEGER): { flat: number; bps: number } {
  let flat = 0, bps = 0;
  for (const grant of unit.combatItemGrants ?? []) if (grant.grantedAtTick <= at) {
    const payload = payloadOf(grant);
    flat += payload.maxHpFlat; bps += payload.maxHpBps;
  }
  return { flat, bps };
}
