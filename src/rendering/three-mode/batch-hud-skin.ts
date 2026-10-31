/** Semantic bindings only. All source images, coordinates and reviews remain in the optional sidecar. */
import type { ReadyUiSprite } from './ui-original-assets';
const scope = 'body:has(.render3d-layer)';
// Use :is so every branch stays scoped to a mounted 3D layer, including body-owned tooltips.
const targets: Readonly<Record<string, string>> = {
  'button.refresh': '[data-debug="reroll"]',
  'button.xp': '[data-debug="buy-xp"]',
  'button.sell': '[data-debug="sell"]',
  'button.lock.off': '[data-debug="shop-lock"][aria-pressed="false"]',
  'button.lock.on': '[data-debug="shop-lock"][aria-pressed="true"]',
  'shop.empty': '.shop-dock .shop-panel:not(.shop-choice) > .touch-shop > .shop-card:not(.shop-offer):not([data-unit-def])',
  'hud.population': '.shop-dock .hud-pop',
  'economy.interest': '.economy-interest',
  'coin.online': 'body[data-online] .shop-dock .hud-gold .hud-label',
  'player.hp': '.online-seat .seat-hp',
  'player.hp-track': '.online-seat .seat-bar',
  'player.hp-fill': '.online-seat .seat-fill',
  'player.hp-fill.mid': '.online-seat .seat-bar[data-tier="mid"] .seat-fill',
  'player.hp-fill.low': '.online-seat .seat-bar[data-tier="low"] .seat-fill',
  'stats.panel': '.battle-summary',
  'stats.tab': '.online-tab,.summary-tab',
  'item.frame': '.item-dock .item-card,.item-dock .consumable-card,.inspect-item',
  'trait.count': '.trait-count',
  'trait.row': '.trait-row',
  'augment.card.silver': '.choice-dialog[data-augment-tier="silver"] .augment-slot > button:first-child',
  'augment.card.gold': '.choice-dialog[data-augment-tier="gold"] .augment-slot > button:first-child',
  'augment.card.prismatic': '.choice-dialog[data-augment-tier="prismatic"] .augment-slot > button:first-child',
  'augment.reroll': '.choice-dialog[data-choice-source="augment"] button.augment-slot-reroll',
  'choice.panel': '.choice-dialog:not([data-choice-source="augment"])',
  'choice.card': '.choice-dialog:not([data-choice-source="augment"]) .choice-cards > button',
  'tooltip.panel': '.hover-card,.item-popover',
  'unit.panel': '.unit-inspect',
  'unit.item': '.unit-inspect .inspect-item',
  'unit.hp': '.unit-inspect .inspect-hp .inspect-fill',
  'unit.hp.enemy': '.unit-inspect .inspect-hp[data-team="enemy"] .inspect-fill',
  'unit.mana': '.unit-inspect .inspect-mana .inspect-fill',
  'unit.shield': '.unit-inspect .inspect-shield',
  'legend.panel': '.legend-picker-panel',
  'legend.card': '.legend-picker-card',
  'scout.panel': '.scout-minimap',
  'scout.seat': '.minimap-seat',
  'combat.callout': '.render3d-callout,.opening-banner,.opening-card,.opening-toast',
  'combat.win': '.summary-result[data-result="playerWin"]',
  'combat.loss': '.summary-result[data-result="enemyWin"]',
  'ranking.panel': '.ranking-card,.elimination-card',
  'ranking.header': '.ranking-card h2,.elimination-card h2',
  'generic.panel': '.render3d-notice,.online-spectate,.online-connection,.lobby-card,.help-dialog',
  'generic.button': '.render3d-bar button,.legend-picker-head button,.help-button,.help-dialog button,.left-panel-toggle,.fullscreen-toggle,.sound-toggle,.lobby-card button',
  'loading.track': '.render3d-progress',
  'loading.fill': '.render3d-progress i',
  'stage.track': '.stage-track',
};
const icons: Readonly<Record<string, string>> = {
  'stage.pvp': '.stage-round[data-icon="pvp"]',
  'stage.pve': '.stage-round[data-icon="pve"]',
  'stage.augment': '.stage-round[data-icon="augment"]',
  'streak.win': '.economy-streak[data-kind="win"]',
  'streak.loss': '.economy-streak[data-kind="loss"]',
  'streak.none': '.economy-streak[data-kind="none"]',
};
const states: Readonly<Record<string, string>> = {
  hover: ':not(:disabled):is(:hover,:focus-visible)', pressed: ':not(:disabled):active',
  disabled: ':disabled', selected: ':is([aria-selected="true"],[aria-pressed="true"]):not(:disabled)',
};
export const BATCH_UI_SPRITES: readonly string[] = [
  ...Object.keys(targets).flatMap(id => [id, ...Object.keys(states).map(state => `${id}.${state}`)]),
  ...Object.keys(icons), 'player.avatar', 'player.avatar.me', 'player.hp-icon', 'item.column',
  ...['inactive', 'bronze', 'silver', 'gold', 'prismatic', 'unique'].map(tier => `trait.${tier}`),
  'world.countdown', 'world.label', 'star.1', 'star.2', 'star.3', 'star.4',
];
function paint(sprite: ReadyUiSprite): string {
  const url = `url(${JSON.stringify(sprite.url)})`;
  return (sprite.slice
    ? `border-image-source:${url};border-image-slice:${sprite.slice.join(' ')} fill;border-image-width:${sprite.slice.map(n => `${n}px`).join(' ')};border-image-repeat:stretch;background:none;`
    : `border-image:none;background:${url} center / 100% 100% no-repeat;`)
    + 'border-color:transparent;border-radius:0;box-shadow:none;';
}
export function batchHudRules(sprites: ReadonlyMap<string, ReadyUiSprite>): string {
  const rules: string[] = [];
  const column = sprites.get('item.column');
  if (column) rules.push(`${scope} .item-dock{background:url(${JSON.stringify(column.url)}) 0 0 / 44px 48px repeat-y!important;}`);
  const heart = sprites.get('player.hp-icon');
  if (heart) rules.push(`${scope} .seat-hp::before{content:"";display:inline-block;width:12px;height:12px;margin-right:3px;background:url(${JSON.stringify(heart.url)}) center / contain no-repeat;}`);
  for (const [id, target] of Object.entries(targets)) {
    for (const [suffix, state] of [['', ''], ...Object.entries(states)] as const) {
      const sprite = sprites.get(id + (suffix ? `.${suffix}` : '')); if (!sprite) continue;
      // Append pseudo-elements after :is(), so the progress fill selector remains valid.
      const pseudo = target.includes('::') ? target.slice(target.indexOf('::')) : '';
      const selector = pseudo ? target.slice(0, target.indexOf('::')) : target;
      let when = state;
      if (!suffix && /^(button\.|augment\.reroll$|generic\.button$|stats\.tab$|choice\.card$|legend\.card$|scout\.seat$|item\.frame$)/.test(id)) {
        // A reviewed normal image must not mask an unreviewed interaction state.
        if (!sprites.has(`${id}.hover`)) when += ':not(:hover):not(:focus-visible)';
        if (!sprites.has(`${id}.pressed`)) when += ':not(:active)';
        if (!sprites.has(`${id}.disabled`)) when += ':not(:disabled)';
      }
      if ((suffix === 'hover' || suffix === 'selected') && !sprites.has(`${id}.pressed`)) when += ':not(:active)';
      // The shared online stylesheet has more specific layout selectors. Only
      // decoration wins the cascade; no dimensions, content or visibility change.
      const decoration = paint(sprite).replace(/;/g, '!important;');
      rules.push(`${scope} :is(${selector})${when}${pseudo}{${decoration}}`);
      if (id === 'augment.reroll' || id.startsWith('button.lock.')) {
        // These original buttons are icon-only. Their live text/title and disabled
        // semantics remain on the DOM button and continue to supply its accessible name.
        rules.push(`${scope} :is(${selector})${when}{font-size:0!important;}`);
        if (id === 'augment.reroll') rules.push(`${scope} :is(${selector})${when}::before{content:none!important;}`);
      }
      if (id === 'button.refresh' || id === 'button.xp') rules.push(`${scope} :is(${selector}){text-align:left!important;}`);
    }
  }
  for (const [id, selector] of Object.entries(icons)) {
    const sprite = sprites.get(id); if (!sprite) continue;
    if (id.startsWith('stage.')) {
      rules.push(`${scope} ${selector}{background:url(${JSON.stringify(sprite.url)}) center / 16px 16px no-repeat;}`);
      rules.push(`${scope} ${selector} svg{visibility:hidden;}`);
    } else {
      // Leave the complete accessible count/label in place and replace only the old SVG decoration.
      rules.push(`${scope} ${selector}::before{content:"";display:inline-block;width:18px;height:18px;vertical-align:middle;background:url(${JSON.stringify(sprite.url)}) center / contain no-repeat;}`);
      rules.push(`body[data-online]:has(> .render3d-layer) ${selector}::before{content:attr(data-value);width:auto;height:auto;background:url(${JSON.stringify(sprite.url)}) left center / 13px 13px no-repeat;}`);
      rules.push(`${scope} ${selector} svg{display:none;}`);
    }
  }
  for (const kind of ['', '.me']) {
    const sprite = sprites.get(`player.avatar${kind}`); if (!sprite) continue;
    const selector = `${scope} .online-seat${kind} .seat-avatar`;
    rules.push(`${selector}{position:relative;overflow:visible;border-color:transparent;box-shadow:none;}`);
    rules.push(`${selector}::after{content:"";position:absolute;inset:-3px;pointer-events:none;background:url(${JSON.stringify(sprite.url)}) center / 100% 100% no-repeat;}`);
  }
  for (const tier of ['inactive', 'bronze', 'silver', 'gold', 'prismatic', 'unique']) {
    const sprite = sprites.get(`trait.${tier}`); if (!sprite) continue;
    const selector = tier === 'inactive' ? '.trait-row.inactive' : `.trait-row[data-style="${tier}"]`;
    rules.push(`${scope} ${selector} :is(.trait-icon,.trait-letter){background:url(${JSON.stringify(sprite.url)}) center / 100% 100% no-repeat;box-shadow:none;clip-path:none;}`);
  }
  return rules.join('\n');
}
