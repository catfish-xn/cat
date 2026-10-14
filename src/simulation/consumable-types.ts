import type { CONSUMABLE_DEFINITIONS } from './content/consumables';
import type { ItemInstance } from './strategy-types';
import type { RngStream } from './m8/contracts';
export type ConsumableDefinitionId = keyof typeof CONSUMABLE_DEFINITIONS;
export interface ConsumableInstance { readonly consumableId:string; readonly definitionId:ConsumableDefinitionId }
export type ConsumableTarget = {readonly kind:'item';readonly itemId:string} | {readonly kind:'unit';readonly unitId:string};
export type ConsumableEffect = 'remove-all'|'reforge-component'|'reforge-completed';
export type ConsumableFailure = 'wrong-phase'|'unknown-consumable'|'temporary-item'|'unknown-item'|'unknown-unit'
  | 'invalid-consumable-target'|'no-removable-items';
export type ConsumablePreview = {readonly ok:true;readonly effect:ConsumableEffect;readonly affectedItemIds:readonly string[];
  readonly destination:'inventory';readonly affectsCurrentBattle:false} | {readonly ok:false;readonly reason:ConsumableFailure};
export interface ConsumableUseRecord {
  readonly consumableId:string; readonly definitionId:ConsumableDefinitionId; readonly target:ConsumableTarget;
  readonly effect:ConsumableEffect; readonly affectedItems:readonly ItemInstance[];
  readonly output: {readonly id:string;readonly definitionId:string}|null;
  readonly rngBefore:RngStream; readonly rngAfter:RngStream;
}
export type ConsumableEvent =
  | {readonly type:'consumableUsed';readonly consumableId:string;readonly definitionId:ConsumableDefinitionId;
      readonly target:ConsumableTarget;readonly effect:ConsumableEffect;readonly affectedItemIds:readonly string[];readonly outputItemId:string|null}
  | {readonly type:'itemReforged';readonly itemId:string;readonly definitionId:string;readonly outputItemId:string;
      readonly outputDefinitionId:string;readonly consumableId:string}
  | {readonly type:'itemsRemoved';readonly unitId:string;readonly itemIds:readonly string[]};
