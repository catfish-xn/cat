import {expect,it} from 'vitest';
import {g23IconUrl,itemDisplayName} from '../../src/presentation/g23-display';
import {ITEM_DEFINITIONS} from '../../src/simulation/content/g2-3-item-registry';

it('the crown shows its official 14.24 name, its bundled loot icon and the permanent team-size text',()=>{
 expect(itemDisplayName('TFT_Item_ForceOfNature')).toBe('金铲铲冠冕');
 expect(g23IconUrl('item','TFT_Item_ForceOfNature')).toMatch(/assets\/s13\/g23\/loot\/tft_item_forceofnature\.png$/);
 expect(ITEM_DEFINITIONS.TFT_Item_ForceOfNature.effectDescriptions).toEqual(['获得时队伍人口上限永久+1，与是否装备无关。']);
});
