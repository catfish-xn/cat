// Hand-selected from TFT13 local system inventory and GLB skin joints.
export default {
  "attack": [
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
      "system": "Q_Ring_Windup",
      "phase": "start",
      "anchor": "source",
      "bone": "Buffbone_Glb_Ground_Loc",
      "delay": 0,
      "maxDuration": 0.6,
      "note": "GLB skin joint verified; preview timing only."
    },
    {
      "system": "Q_Ring",
      "phase": "impact",
      "anchor": "source",
      "bone": "Buffbone_Glb_Ground_Loc",
      "delay": 0.6,
      "maxDuration": 0.8,
      "note": "GLB skin joint verified; preview timing only."
    },
    {
      "system": "Q_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.6,
      "maxDuration": 0.6,
      "note": "Target world anchor; target skeleton is unknown."
    },
    {
      "system": "Q_hemo_debuff",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.7,
      "maxDuration": 3,
      "note": "Target world anchor; target skeleton is unknown."
    },
    {
      "system": "Q_Heal",
      "phase": "impact",
      "anchor": "source",
      "bone": "C_Buffbone_Glb_Center_Loc",
      "delay": 0.7,
      "maxDuration": 1,
      "note": "GLB skin joint verified; preview timing only."
    }
  ],
  "unavailable": [
    [
      "BA_Cas/BA_Mis",
      "No dedicated basic attack system; melee has no flight."
    ]
  ]
};
