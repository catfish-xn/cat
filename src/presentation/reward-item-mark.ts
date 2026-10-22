/** Reward pools keep their identity: a black-market pool is not a preview of a randomly chosen concrete item. */
import { lootEntry } from './g23-display';
import { itemMarkHtml } from './item-codex';
import { s13AssetUrl } from './s13-assets';
import type { G23RewardIcon } from './g23-reward-text';

export function rewardItemMarkHtml(icon: Extract<G23RewardIcon, { kind: 'item' }>, size: number): string {
  if (icon.itemId) return itemMarkHtml(icon.itemId, size);
  const crime = /^Tier[0-3]$/.test(icon.source ?? '');
  const url = crime ? s13AssetUrl('trait', 'TFT13_Crime') : icon.source ? lootEntry(icon.source)?.iconUrl : null;
  const glyph = crime ? '黑市装备' : [...icon.name].slice(0, 2).join('');
  // Like item marks, the text stays underneath an optional image, including after an image error.
  return `<span class="item-mark reward-mark${crime ? ' market-pool-badge' : ''}" style="width:${size}px;height:${size}px" aria-hidden="true">`
    + `<span class="item-glyph">${glyph.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`)}</span>`
    + (url ? `<img class="item-icon" src="${url}" width="${size}" height="${size}" alt="" draggable="false" decoding="async">` : '') + '</span>';
}
