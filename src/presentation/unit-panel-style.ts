/** Every `--ui-*` image is optional (unit-panel-skin.ts); the second value of each var() is the plain fallback. */
export const PANEL_STYLE = `
.unit-inspect { position:fixed; z-index:80; box-sizing:border-box; width:300px; overflow:visible; padding:4px; color:#f0e6d2; font-size:13px;
  background:#0f1a1e; border:2px solid #785a28; box-shadow:0 12px 32px #0009; animation:inspect-open 140ms ease-out; }
.unit-inspect.skinned { border:5px solid transparent; border-image:var(--ui-frame) var(--ui-frame-slice,5) fill / 5px stretch; background:none; padding:1px; }
.unit-inspect[hidden] { display:none; }
.unit-inspect .unit-card { display:grid; gap:6px; }
.inspect-close { position:absolute; z-index:2; right:0; top:0; width:44px; height:44px; font-size:24px; cursor:pointer; background:transparent; color:#f0e6d2; border:0; text-shadow:0 1px 3px #000; }
.inspect-close:hover { color:#fff; }
.inspect-hero { position:relative; height:150px; overflow:hidden; background:#16262d; }
.inspect-hero.has-splash { background:var(--splash) center 30% / cover no-repeat; }
.inspect-hero .unit-card-portrait { position:absolute; left:50%; top:30px; transform:translateX(-50%); width:72px; height:72px; }
.inspect-hero .unit-card-portrait img, .inspect-hero .unit-card-portrait svg { width:68px; height:68px; }
.inspect-hero.has-splash .unit-card-portrait { display:none; }
.unit-inspect .unit-card-portrait.neutral { border-color:#7e95a4; }
.inspect-stars { position:absolute; left:50%; top:4px; transform:translateX(-50%); color:#ffd75e; font-size:16px; letter-spacing:1px; text-shadow:0 1px 3px #000; }
.inspect-stars[data-star="2"] { color:#cfe3f4; } .inspect-stars[data-star="1"] { color:#c97d4d; } .inspect-stars[data-star="4"] { color:#34e6a1; }
.skinned .inspect-stars { font-size:0; height:20px; background:center / contain no-repeat; }
.skinned .inspect-stars[data-star="1"] { width:30px; background-image:var(--ui-star-1); } .skinned .inspect-stars[data-star="2"] { width:50px; background-image:var(--ui-star-2); }
.skinned .inspect-stars[data-star="3"] { width:68px; background-image:var(--ui-star-3); } .skinned .inspect-stars[data-star="4"] { width:84px; background-image:var(--ui-star-4); }
.inspect-traits { position:absolute; left:6px; top:28px; display:grid; gap:3px; justify-items:start; max-height:84px; overflow:hidden; }
.inspect-trait { display:flex; align-items:center; gap:5px; font-size:12px; text-shadow:0 1px 2px #000,0 0 3px #000; }
.inspect-trait i { display:grid; place-items:center; width:22px; height:25px; flex:none; background:#1b2a30; clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); }
.skinned .inspect-trait i { background:var(--ui-trait) center / 100% 100% no-repeat; clip-path:none; }
.inspect-trait i img { width:16px; height:16px; }
.inspect-trait.trait-closed { color:#9aaeb9; }
.inspect-name { position:absolute; left:0; right:0; bottom:0; height:32px; display:flex; align-items:center; justify-content:space-between; padding:0 10px;
  background:linear-gradient(90deg,#0f1a1e 10%,var(--rarity,#6b7a80)); text-shadow:0 1px 2px #000; }
.inspect-hero[data-cost="2"] { --rarity:#1c9b55; } .inspect-hero[data-cost="3"] { --rarity:#2c7fd4; } .inspect-hero[data-cost="4"] { --rarity:#b53cc7; }
.inspect-hero[data-cost="5"] { --rarity:#d89c26; } .inspect-hero[data-cost="6"] { --rarity:#e05a9a; }
.skinned [data-cost="1"] .inspect-name { background:var(--ui-rarity-1) center / 100% 100%; } .skinned [data-cost="2"] .inspect-name { background:var(--ui-rarity-2) center / 100% 100%; }
.skinned [data-cost="3"] .inspect-name { background:var(--ui-rarity-3) center / 100% 100%; } .skinned [data-cost="4"] .inspect-name { background:var(--ui-rarity-4) center / 100% 100%; }
.skinned [data-cost="5"] .inspect-name { background:var(--ui-rarity-5) center / 100% 100%; } .skinned [data-cost="6"] .inspect-name { background:var(--ui-rarity-6) center / 100% 100%; }
.inspect-name .unit-card-name { font-size:17px; }
.inspect-cost { display:flex; align-items:center; gap:4px; font-size:15px; font-weight:700; }
.inspect-cost::before { content:""; width:13px; height:13px; border-radius:50%; background:radial-gradient(circle at 35% 35%,#fff3b0,#e8b52c 55%,#9a6a10); box-shadow:0 0 2px #000; }
.inspect-notes:empty { display:none; } .inspect-notes { padding:0 8px; } .inspect-notes p { margin:0; font-size:12px; color:#ffd98a; }
.inspect-bars { display:grid; gap:3px; padding:0 8px; }
.inspect-bar { display:flex; position:relative; height:16px; background:#05090c; overflow:hidden; border:1px solid #2a3c42; }
.inspect-fill { height:100%; background:#4fb36a; } .inspect-hp[data-team=enemy] .inspect-fill { background:#c9474e; }
.inspect-mana .inspect-fill { background:#3d8fdc; } .inspect-shield { height:100%; background:#e8e8e8; }
.skinned .inspect-hp .inspect-fill { background:var(--ui-hp) 0 0 / 100% 100%; } .skinned .inspect-hp[data-team=enemy] .inspect-fill { background:var(--ui-hp-enemy) 0 0 / 100% 100%; }
.skinned .inspect-mana .inspect-fill { background:var(--ui-mana) 0 0 / 100% 100%; } .skinned .inspect-shield { background:var(--ui-shield) 0 0 / 100% 100%; }
.inspect-bar-text { position:absolute; inset:0; text-align:center; font-size:11px; line-height:14px; font-variant-numeric:tabular-nums; text-shadow:0 1px 2px #000,1px 0 #000,-1px 0 #000; }
.inspect-row { display:flex; gap:6px; padding:2px 8px; align-items:center; }
.inspect-ability { box-sizing:border-box; width:48px; height:48px; padding:3px; flex:none; display:grid; place-items:center; cursor:help; border:1px solid #c8aa6e; background:#0b151a; }
.skinned .inspect-ability { border:0; background:var(--ui-ability) center / 100% 100%; } .skinned .inspect-ability:is(:hover,:focus-visible,[aria-expanded="true"]) { background-image:var(--ui-ability-hover); }
.inspect-ability img { width:40px; height:40px; display:block; }
.inspect-items { display:flex; gap:6px; }
.inspect-item { box-sizing:border-box; width:48px; height:48px; border:1px solid #2f5158; background:#0b151a; display:grid; place-items:center; }
.inspect-item img, .inspect-item svg { width:38px; height:38px; }
.skinned .inspect-item { border:0; background:var(--ui-item) center / 100% 100%; } .skinned .inspect-item:is(:hover,:focus-visible) { background-image:var(--ui-item-hover); }
.inspect-item:focus-visible,.inspect-close:focus-visible,.inspect-ability:focus-visible { outline:2px solid #68ddd0; outline-offset:1px; }
.inspect-ability-card { display:none; position:absolute; z-index:3; right:calc(100% + 8px); bottom:0; width:280px; max-height:80vh; overflow:auto; box-sizing:border-box;
  padding:10px 12px; color:#d9d3c4; font-size:12px; line-height:1.55; background:#0a1216f2; border:1px solid #785a28; box-shadow:0 8px 24px #000a; }
.inspect-ability-card.open { display:grid; gap:8px; }
.skinned .inspect-ability-card { border:5px solid transparent; border-image:var(--ui-frame) var(--ui-frame-slice,5) fill / 5px stretch; background:none; }
.inspect-ability-card .unit-card-label { color:#f0e6d2; font-size:14px; font-weight:700; display:flow-root; }
.unit-inspect .unit-card-text { white-space:pre-line; margin:4px 0 0; } .unit-inspect b { color:#ffe29b; }
.inspect-stats-label { padding:0 8px; margin-bottom:-4px; color:#7e959c; font-size:11px; text-align:right; }
.unit-inspect .unit-card-stats { margin:0; padding:0 8px; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:4px; }
.inspect-stat { display:flex; flex-direction:column-reverse; align-items:center; justify-content:center; height:40px; background:#111d21; border:1px solid #23383e; }
.skinned .inspect-stat { border:0; background:var(--ui-cell) center / 100% 100%; }
.inspect-stat dd { margin:0; font-size:13px; font-weight:600; font-variant-numeric:tabular-nums; } .inspect-stat dt { color:#8fa5ab; font-size:10px; }
.unit-inspect .unit-card-battle, .unit-inspect [data-debug="unit-card:item-stacks"] { margin:0; padding:0 8px; font-size:11px; color:#9aaeb9; }
.unit-inspect .unit-card-battle .unit-card-label { display:inline; font-size:11px; }
.unit-inspect .unit-card > :last-child { margin-bottom:6px; }
@keyframes inspect-open { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:none; } }
@media(max-width:699px) { .unit-inspect { left:8px; right:8px!important; width:auto; overflow:auto; } .inspect-ability-card { position:static; width:auto; max-height:none; } }
@media(prefers-reduced-motion:reduce) { .unit-inspect { animation:none; } }
`;
