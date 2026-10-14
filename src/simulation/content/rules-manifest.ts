import { freezeContent } from './freeze';
import { ORB_RULES, ORB_SLOTS } from './orbs';
import { CONSUMABLE_RULES, CONSUMABLE_DEFINITIONS, REFORGE_POOLS } from './consumables';
import { EQUIPMENT_RULES_VERSION } from '../equipment-policy';
import { EQUIPMENT_OPERATION_RULES_VERSION, MULTIPLAYER_OPERATION_RULES } from '../operation-policy';
import { OPENING_INITIAL_STATE, OPENING_ECONOMY_RULES } from '../opening-economy';

/** One release manifest is included in both content and loot replay identities. */
export const RULES_GAP_MANIFEST = freezeContent({
  opening: { initial: OPENING_INITIAL_STATE, economy: OPENING_ECONOMY_RULES },
  equipment: { version: EQUIPMENT_RULES_VERSION, operations: EQUIPMENT_OPERATION_RULES_VERSION,
    multiplayer: MULTIPLAYER_OPERATION_RULES, autoCombine: 'lowest-permanent-component-slot' },
  orbs: { rules: ORB_RULES, slots: ORB_SLOTS },
  consumables: { rules: CONSUMABLE_RULES, definitions: CONSUMABLE_DEFINITIONS, pools: REFORGE_POOLS },
  restoration: 'burn-refresh-canonical-program-v1',
  provenance: 'consumable-use-after-grant-v1',
});
