// Independent offer-catalog transcription; no production modules, state recording, or golden updates.
module.exports={
  "prismatic": ["coronation","tacticians-kitchen","blood-brothers"],
  "silver": [
    "branching-out"
  ],
  "gold": [
    "why-not-both",
    "rocket-collection",
    "rocket-collection-plus",
    "fractured-crystals",
    "heavy-hitters",
    "crimson-pact",
    "noxian-guillotine",
    "dominate",
    "enforce",
    "welcome-to-the-playground",
    "pit-fighter-prizefighter",
    "quickstriker-boost",
    "scrap-recycling",
    "sentinel-slam",
    "sorcerer-explosion",
    "watcher-growth",
    "betrayal"
  ],
  "traits": {
    // 14.24 record TFT13_TeamupAugment_BloodBrothers (enabled 10-24, P-AG5).
    "blood-brothers": ["dominator","family","watcher"],
    "why-not-both": ["form-swapper"],
    "rocket-collection": [
      "artillerist"
    ],
    "rocket-collection-plus": [
      "artillerist"
    ],
    "fractured-crystals": [
      "automata"
    ],
    "heavy-hitters": [
      "bruiser"
    ],
    "crimson-pact": [
      "chem-baron"
    ],
    "noxian-guillotine": [
      "conqueror"
    ],
    "dominate": [
      "dominator"
    ],
    "enforce": [
      "enforcer"
    ],
    "welcome-to-the-playground": [
      "family"
    ],
    "pit-fighter-prizefighter": [
      "pit-fighter"
    ],
    "quickstriker-boost": [
      "quickstriker"
    ],
    "scrap-recycling": [
      "scrap"
    ],
    "sentinel-slam": [
      "sentinel"
    ],
    "sorcerer-explosion": [
      "sorcerer"
    ],
    "watcher-growth": [
      "watcher"
    ],
    "betrayal": [
      "enforcer",
      "sniper",
      "quickstriker",
      "conqueror",
      "emissary"
    ]
  },
  "exclusive": [["coronation","tacticians-kitchen"],
    [
      "rocket-collection",
      "rocket-collection-plus"
    ],
    [
      "quickstriker-boost",
      "built-different"
    ],
    [
      "sentinel-slam",
      "built-different"
    ],
    [
      "sorcerer-explosion",
      "built-different"
    ]
  ]
};
// Independent reward transcription from 14.24 descriptions/effects; tuples documented in augment-rewards-oracle.cjs.
module.exports.gifts={
 'rocket-collection':[['U','tristana'],['U','urgot']], 'rocket-collection-plus':[['U','tristana'],['U','urgot']],
 'fractured-crystals':[['U','amumu'],['U','nocturne']], 'heavy-hitters':[['U','steb'],['U','trundle']],
 'crimson-pact':[['U','renni']], 'noxian-guillotine':[['U','darius'],['U','draven']],
 dominate:[['U','cassiopeia']], enforce:[['U','steb'],['U','maddie']],
 'welcome-to-the-playground':[['U','powder'],['U','violet']], 'why-not-both':[['U','swain'],['U','gangplank']],
 'pit-fighter-prizefighter':[['U','urgot']], 'quickstriker-boost':[['U','nocturne'],['U','akali']],
 'scrap-recycling':[['U','powder'],['U','trundle']], 'sentinel-slam':[['U','loris']],
 'sorcerer-explosion':[['U','vladimir'],['U','lux']], 'watcher-growth':[['U','vander']],
 betrayal:[['U','maddie'],['U','ambessa']], 'blood-brothers':[['U','vander',1,2],['U','silco'],['I','shojin']],
};
module.exports.rewards={
 'rocket-collection':{every:75,max:2,gifts:[['I','TFT4_Item_OrnnTheCollector']]},
 'rocket-collection-plus':{every:65,max:2,gifts:[['I','TFT4_Item_OrnnTheCollector']]},
 'scrap-recycling':{every:6,max:5,gifts:[['Q','component',1,false]]},
 enforce:{every:6,gold:6}, betrayal:{every:1,gifts:[['U','maddie']]},
 'welcome-to-the-playground':{every:1,gifts:[['F',['vander','powder','violet']]]},
};
// Blood Brothers raw mutually_exclusive_item_nodes_raw, resolved independently through
// augments-14.24.json map22_node. SingedCarry is outside the enabled catalog.
for(const id of ['shocking-troll','blade-dance','savage-revenge','field-medic',
 'geniuses','menaces','mentorship','reunion','sisters','unlikely-duo'])module.exports.exclusive.push(['blood-brothers',id]);
