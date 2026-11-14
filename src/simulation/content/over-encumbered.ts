import type { ChoiceDefinition } from '../strategy-types';
import { freezeContent } from './freeze';

export const OVER_ENCUMBERED_DEFINITION: ChoiceDefinition = freezeContent({
  id: 'over-encumbered', name: '运力不足',
  description: '下一整个阶段仅有1个可用备战席栏位，期间不能购买弈子。多余弈子暂留场上不参战，只能出售；阶段结束获得3件随机基础装备。',
  effects: [{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}],
});
