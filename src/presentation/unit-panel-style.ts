export const PANEL_STYLE = `
.unit-inspect { position:fixed; z-index:80; box-sizing:border-box; width:300px; overflow:auto; padding:14px; border:1px solid #785a28; border-radius:8px; color:var(--c-text,#e2eef1); background:var(--c-surface,#14212c); box-shadow:0 12px 32px #0009; animation:inspect-open 140ms ease-out; }
.unit-inspect[hidden] { display:none; }
.unit-inspect .unit-card { display:grid; gap:10px; }
.unit-inspect .unit-card-head { padding-right:34px; }
.inspect-close { position:absolute; right:2px; top:2px; width:44px; height:44px; font-size:24px; cursor:pointer; background:transparent; color:inherit; border:0; }
.unit-inspect .unit-card-portrait.neutral { border-color:#7e95a4; }
.unit-inspect .unit-card-traits > span { display:inline-flex; gap:4px; align-items:center; }
.inspect-bar { display:flex; position:relative; height:22px; background:#060e15; overflow:hidden; border:1px solid #34505f; }
.inspect-fill { height:100%; background:#68c087; } .inspect-hp[data-team=enemy] .inspect-fill { background:#ce5c62; }
.inspect-mana .inspect-fill { background:#468bdb; } .inspect-shield { height:100%; background:#fff; }
.inspect-bar-text { position:absolute; inset:0; text-align:center; font-size:12px; text-shadow:0 1px 3px #000,1px 0 #000,-1px 0 #000; }
.inspect-items { display:flex; gap:8px; } .inspect-item { box-sizing:border-box; width:44px; height:44px; border:1px solid #785a28; background:#0b151f; display:grid; place-items:center; }
.inspect-item:focus-visible,.inspect-close:focus-visible { outline:2px solid #68ddd0; outline-offset:1px; }
.unit-inspect .unit-card-text { white-space:pre-line; } .unit-inspect b { color:#ffe29b; }
.inspect-stats-label { color:#9aaeb9; font-size:12px; } .unit-inspect .unit-card-stats { margin:0; grid-template-columns:repeat(2,minmax(0,1fr) auto); gap:6px; }
@keyframes inspect-open { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:none; } }
@media(max-width:699px) { .unit-inspect { left:8px; right:8px!important; width:auto; } }
@media(prefers-reduced-motion:reduce) { .unit-inspect { animation:none; } }
`;
