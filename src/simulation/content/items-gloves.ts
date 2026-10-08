import type { ItemDefinition } from '../strategy-types';
import { modifier } from './item-programs';
export const GLOVES_ITEMS: readonly ItemDefinition[] = [
{
  "id": "thiefs-gloves",
  "name": "窃贼手套",
  "kind": "completed",
  "apiName": "TFT_Item_ThiefsGloves",
  "unique": false,
  "slotCost": 3,
  "conventionIds": [
    "GLOBAL-STAT-01"
  ],
  "recipe": [
    "gloves",
    "gloves"
  ],
  "effectDescriptions": ["暴击率+20%；本体与临时件占用3槽。TG-01临时装备生成、刷新、清理在B5接入；B4仅本体属性生效。"],
  "effects": [
    {
      "kind": "statFlat",
      "stat": "maxHp",
      "amount": 150
    }
  ],
  combatProgram: {modifiers:[modifier('critChance',2000,'bps')],effects:[{kind:'temporary-equipment',policyId:'TG-01',lifetime:'round'}]}
}
];
