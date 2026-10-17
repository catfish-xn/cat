/** G2-4b support auras at the strategy compile boundary. Pure board geometry on preparation cells; the receiver owns
 * each grant (ownerId = receiver, instanceId = `support:<holder item instance>`), so restore recompiles it exactly. */
import { hexDistance, type HexCell, type Team } from './board';
import { G24_SUPPORT_DECLARATIONS, type G24AuraArea } from './content/g2-4-support-items';
import { amount, selector, shield } from './content/item-programs';
import type { ItemProgram } from './m8/item-program';
import type { Effect, ItemDefinition } from './strategy-types';

export interface G24BoardUnit { readonly id: string; readonly team: Team; readonly cell: HexCell }
export interface G24HeldItem { readonly definition: ItemDefinition; readonly instanceId: string }
export interface G24SupportGrant { readonly definitionId: string; readonly instanceId: string; readonly effects: readonly Effect[]; readonly program?: ItemProgram }

export const supportInstanceId = (itemInstanceId: string, part: string) => `support:${itemInstanceId}:${part}`;
/** Smeech counts carried items; an aura received from an ally's support item is not one of them. */
export const isSupportAuraInstance = (instanceId: string) => instanceId.startsWith('support:');

/** 约定值 G24-SUPPORT-01: "behind" is any row further from the enemy, within one column of the holder. */
export function inSupportArea(area: G24AuraArea, radius: number, holder: G24BoardUnit, other: G24BoardUnit): boolean {
  if (other.team !== holder.team) return false;
  const distance = hexDistance(holder.cell, other.cell), sameRow = other.cell.row === holder.cell.row;
  switch (area) {
    case 'team': return true;
    case 'adjacent': return distance <= radius;
    case 'same-row': return sameRow && distance <= radius;
    case 'row-and-behind': {
      const behind = holder.team === 'player' ? other.cell.row > holder.cell.row : other.cell.row < holder.cell.row;
      return sameRow && distance <= radius || behind && Math.abs(other.cell.col - holder.cell.col) <= radius;
    }
  }
}

/** Every grant each board unit receives from support items held on its own board, in holder/instance order. */
export function compileSupportGrants(units: readonly G24BoardUnit[], held: ReadonlyMap<string, readonly G24HeldItem[]>, stage: number): Map<string, G24SupportGrant[]> {
  const grants = new Map<string, G24SupportGrant[]>();
  const holders = [...units].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const holder of holders) for (const item of [...held.get(holder.id) ?? []].sort((a, b) => a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0)) {
    const declaration = Object.hasOwn(G24_SUPPORT_DECLARATIONS, item.definition.id) ? G24_SUPPORT_DECLARATIONS[item.definition.id] : undefined;
    if (!declaration) continue;
    const add = (unitId: string, grant: G24SupportGrant) => { const list = grants.get(unitId) ?? []; list.push(grant); grants.set(unitId, list); };
    declaration.auras.forEach((aura, index) => { for (const receiver of holders.filter(u => inSupportArea(aura.area, aura.radius, holder, u)))
      add(receiver.id, { definitionId: item.definition.id, instanceId: supportInstanceId(item.instanceId, `aura${index}`), effects: aura.effects, ...(aura.program ? { program: aura.program } : {}) }); });
    const s = declaration.stageShield;
    if (s) {
      // The stage is frozen at compile time; the holder shields its lowest-percent-health allies each period.
      const value = s.byStage[Math.min(Math.max(stage, 1), s.byStage.length) - 1];
      add(holder.id, { definitionId: item.definition.id, instanceId: supportInstanceId(item.instanceId, 'shield'), effects: [], program: { periodic: [{ periodTicks: s.periodTicks,
        program: { selector: selector({ relation: 'ally', maxTargets: s.targets, order: 'hp-ratio-id', sample: 'each-pulse' }), targetSnapshot: 'once-per-pulse',
          effects: [{ ...shield(0, s.durationTicks), amount: amount({ flat: value }) }] } }] } });
    }
  }
  return grants;
}
