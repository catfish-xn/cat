import { createAugmentTextLoader } from './augment-text-loader';
export const { loadAugmentText: loadTooltipText, readAugmentText: readTooltipText,
  peekAugmentText: peekTooltipText, augmentTextPlaceholder: tooltipTextPlaceholder,
  onAugmentTextChanged: onTooltipTextChanged } = createAugmentTextLoader(() => import('./tooltip-text-data'), '技能和装备说明');
