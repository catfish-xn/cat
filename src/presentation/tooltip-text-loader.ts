import { createAugmentTextLoader } from './augment-text-loader';
export const { loadAugmentText: loadTooltipText, readAugmentText: readTooltipText,
  peekAugmentText: peekTooltipText, augmentTextPlaceholder: tooltipTextPlaceholder,
  onAugmentTextChanged: onTooltipTextChanged } = createAugmentTextLoader(() => import('./tooltip-text-data'));
