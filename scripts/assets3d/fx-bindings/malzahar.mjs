// Hand-selected from TFT13 local system inventory and GLB skin joints.
export default {
  "attack": [
    {
      "system": "TFT13_Malzahar_AA_mis",
      "phase": "travel",
      "anchor": "projectile",
      "bone": "R_hand",
      "delay": 0,
      "maxDuration": 0.4,
      "note": "Exact source name has no _Base_."
    },
    {
      "system": "@shared-hit",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.35,
      "maxDuration": 0.5,
      "note": "Target world anchor; target skeleton is unknown."
    }
  ],
  "cast": [
    {
      "system": "Q_CAS_HandTrail",
      "phase": "start",
      "anchor": "source",
      "bone": "R_hand",
      "delay": 0,
      "maxDuration": 0.4,
      "note": "GLB skin joint verified; preview timing only."
    },
    {
      "system": "TFT13_Malzahar_Q_mis",
      "phase": "travel",
      "anchor": "projectile",
      "bone": "R_hand",
      "delay": 0.2,
      "maxDuration": 0.5,
      "note": "Exact source name has no _Base_."
    },
    {
      "system": "TFT13_Malzahar_Spell_Tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.7,
      "maxDuration": 0.7,
      "note": "Exact source name has no _Base_; target world anchor, unknown target skeleton."
    },
    {
      "system": "TFT13_Malzahar_E_buf",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.7,
      "maxDuration": 3,
      "note": "Exact source name has no _Base_; bounded DOT preview, not gameplay duration."
    },
    {
      "system": "TFT13_Malzahar_E_Damage",
      "phase": "impact",
      "anchor": "target",
      "delay": 1,
      "maxDuration": 2.7,
      "note": "Exact source name has no _Base_; damage visual only, no simulated ticks."
    }
  ],
  "unavailable": [
    [
      "BA_Cas",
      "No dedicated basic attack cast system."
    ]
  ],
  "note": "E_Spread_Beam not bound: no second target or spread event in action contract."
};
