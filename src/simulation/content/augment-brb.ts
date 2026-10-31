import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';

/** D2 effect declaration; registered by D5. */
export const BRB_DEFINITION: ChoiceDefinition = freezeContent({
  id: 'brb', name: '假装摸鱼',
  description: '你在接下来的3个回合里无法采取任何行动，随后获得2个【成装锻造器】。',
  effects: [{ kind: 'mechanic', mechanic: 'acquisitionBundle', values: { enabled: 1 } }],
});
