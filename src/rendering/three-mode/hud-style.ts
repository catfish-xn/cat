/**
 * Online HUD styles that only apply with the 3D layer mounted (item column, augment pick); installed by mountRenderer3d so
 * the 2D entry does not carry them. The page-wide 3D layout stays in style.css.
 */
const STYLE = `
/* Item bench as the original HUD has it: ten fixed slots in the far-left column, filled from the top and level with the
   trait list beside it (empty slots stay visible); past what fits it scrolls, with a thin scrollbar beside the slots. */
body[data-online]:has(> .render3d-layer) .item-dock, body[data-online]:has(> .render3d-layer) .item-dock:empty { display: flex; top: 20dvh; bottom: auto; left: 6px; width: 54px;
  height: min(476px, calc(80dvh - 72px - var(--online-dock-h))); flex-direction: column; flex-wrap: nowrap; overflow: hidden auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #527080 transparent; scrollbar-gutter: stable;
  background: repeating-linear-gradient(180deg, #2b3f4c 0 1px, #0b151fd9 1px 43px, #2b3f4c 43px 44px, transparent 44px 48px) 0 0 / 44px 100% no-repeat local; }
body[data-online]:has(> .render3d-layer) #panels-root { left: 64px; }
body[data-online]:has(> .render3d-layer) .item-dock > * { flex: none; }
body[data-online]:has(> .render3d-layer) .item-dock .item-inventory, body[data-online]:has(> .render3d-layer) .item-dock .consumable-row { flex-direction: column; }
/* Augment pick as the original's "Choose One" layer: no dialog box, the board dimmed behind, a title over three tall cards
   (icon, then name and effect) and each card's own reroll button under it. */
body[data-online]:has(> .render3d-layer) .choice-overlay:has(> .choice-dialog[data-choice-source="augment"]) { place-items: start center; padding-top: 7dvh; background: #050b14a6; }
body[data-online]:has(> .render3d-layer) .choice-dialog[data-choice-source="augment"] { --aug-edge: #a9b9c6; width: min(1080px, 88vw); padding: 0; border: 0; background: none; box-shadow: none; text-align: center; }
body[data-online]:has(> .render3d-layer) .choice-dialog[data-augment-tier="gold"] { --aug-edge: #e6bc4a; }
body[data-online]:has(> .render3d-layer) .choice-dialog[data-augment-tier="prismatic"] { --aug-edge: #d58cff; }
body[data-online]:has(> .render3d-layer) .choice-dialog[data-choice-source="augment"] h2 { font-size: 30px; letter-spacing: .06em; color: #f0e6d2; text-shadow: 0 2px 8px #000; }
body[data-online]:has(> .render3d-layer) .choice-dialog[data-choice-source="augment"] > p:not(.choice-timeout) { display: none; }
body[data-online]:has(> .render3d-layer) .choice-dialog[data-choice-source="augment"] .choice-cards { gap: 3vw; margin: 3dvh 0 2dvh; }
body[data-online]:has(> .render3d-layer) .choice-dialog[data-choice-source="augment"] .augment-slot { gap: 14px; justify-items: center; }
body[data-online]:has(> .render3d-layer) .choice-dialog[data-choice-source="augment"] .augment-slot > button:first-child, body[data-online]:has(> .render3d-layer) .choice-dialog[data-choice-source="augment"] .choice-cards > button {
  width: 100%; min-height: min(56dvh, 500px); padding: 6dvh 20px 20px; border: 2px solid var(--aug-edge); border-radius: 6px; color: #c8d6dc; font-size: 15px; line-height: 1.6;
  background: radial-gradient(ellipse at 50% 18%, #2a3d4f, #0d1720 70%); box-shadow: 0 8px 30px #000c, inset 0 0 24px #0008; transition: transform .12s, box-shadow .12s; }
body[data-online]:has(> .render3d-layer) .choice-dialog[data-augment-tier="prismatic"] :is(.augment-slot > button:first-child, .choice-cards > button) { border-image: linear-gradient(160deg, #ff7ad9, #7af0ff, #ffe27a, #d58cff) 1; }
body[data-online]:has(> .render3d-layer) .choice-dialog[data-choice-source="augment"] :is(.augment-slot > button:first-child, .choice-cards > button):is(:hover, :focus-visible) {
  transform: translateY(-4px); box-shadow: 0 10px 34px #000c, 0 0 18px color-mix(in srgb, var(--aug-edge) 55%, transparent), inset 0 0 24px #0008; }
body[data-online]:has(> .render3d-layer) .choice-dialog[data-choice-source="augment"] .augment-name { display: block; margin-bottom: 10px; font-size: 22px; color: #f0e6d2; }
body[data-online]:has(> .render3d-layer) .choice-dialog[data-choice-source="augment"] .augment-desc { display: block; margin-top: -1.6em; }
body[data-online]:has(> .render3d-layer) .choice-dialog[data-choice-source="augment"] .augment-icon { width: 112px; height: 112px; margin: 0 auto 4dvh; border-radius: 16px; box-shadow: 0 0 0 2px var(--aug-edge), 0 0 22px color-mix(in srgb, var(--aug-edge) 45%, transparent); }
body[data-online]:has(> .render3d-layer) .choice-dialog[data-choice-source="augment"] button.augment-slot-reroll { width: 132px; padding: 8px 10px; border: 1px solid #785a28; border-radius: 999px; background: #0b151fe6; color: #f0e6d2; font-size: 14px; }
body[data-online]:has(> .render3d-layer) .choice-dialog[data-choice-source="augment"] button.augment-slot-reroll::before { content: "⟳ "; }
body[data-online]:has(> .render3d-layer) .choice-dialog[data-choice-source="augment"] button.augment-slot-reroll:disabled { opacity: .45; }
body[data-online]:has(> .render3d-layer):has(.choice-overlay:not([hidden]) > .choice-dialog[data-choice-source="augment"]) .shop-dock .hud-pop { visibility: hidden; }
`;
export function installHudStyle(): void {
  // Unit tests mount the renderer with a stub document that has no querySelector or head.
  if (typeof document === 'undefined' || typeof document.querySelector !== 'function' || !document.head || document.querySelector('style[data-owner="render3d-hud"]')) return;
  const style = document.createElement('style'); style.dataset.owner = 'render3d-hud'; style.textContent = STYLE;
  document.head.append(style);
}
