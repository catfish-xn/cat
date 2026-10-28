export const PLANNER_STYLE = `
.team-planner { box-sizing:border-box; width:min(1080px,94vw); max-height:82vh; margin:auto; padding:20px; border:1px solid #af9058; border-radius:10px; color:#e5edf0; background:#101e2b; box-shadow:0 12px 50px #000b; }
.team-planner::backdrop { background:#0009; }
.team-planner header,.planner-tabs,.planner-slots,.planner-cost { display:flex; gap:8px; align-items:center; }
.team-planner header { justify-content:space-between; flex-wrap:wrap; }
.team-planner h2 { margin:0; font-size:22px; }
.team-planner button { cursor:pointer; color:inherit; background:#1b3041; border:1px solid #57707d; border-radius:4px; padding:6px 10px; }
.team-planner button:disabled { opacity:.4; cursor:default; }
.team-planner button[aria-pressed=true] { border-color:#f3cc72; background:#3a3c30; }
.team-planner button:focus-visible { outline:2px solid #75e1d0; outline-offset:2px; }
.planner-note { color:#b6c5cb; font-size:13px; }
.planner-slots { margin:14px 0; display:grid; grid-template-columns:repeat(10,minmax(0,1fr)); }
.planner-slots button { padding:5px 2px; min-height:70px; }
.planner-hero img { display:block; margin:auto; }
.planner-hero span { display:block; font-size:12px; margin-top:3px; }
.planner-body { display:grid; grid-template-columns:minmax(0,1fr) 230px; gap:20px; }
.planner-cost { flex-wrap:wrap; margin-bottom:12px; }
.planner-cost h3 { width:100%; margin:0; font-size:14px; }
.planner-cost button { width:74px; padding:5px 2px; }
.planner-traits { list-style:none; margin:0; padding:0; }
.planner-traits li { display:flex; align-items:center; gap:6px; padding:7px 0; opacity:.55; }
.planner-traits li[data-style] { opacity:1; }
.planner-traits [data-style=bronze] { color:#d0a385; } .planner-traits [data-style=silver] { color:#d6e0e7; }
.planner-traits [data-style=gold],.planner-traits [data-style=unique] { color:#f3cc72; } .planner-traits [data-style=prismatic] { color:#a9f5ec; }
.planner-traits small { margin-left:auto; }
.shop-card.planned { outline:2px solid #f3cc72; outline-offset:-3px; }
.planner-mark { position:absolute; left:35%; right:35%; bottom:0; height:3px; z-index:2; background:#ffe19b; border-radius:2px; font-size:0; pointer-events:none; }
`;
