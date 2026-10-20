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
      "system": "R_Mark",
      "phase": "start",
      "anchor": "source",
      "bone": "C_Buffbone_Glb_Center_Loc",
      "delay": 0,
      "maxDuration": 0.5,
      "note": "GLB skin joint verified; preview timing only."
    },
    {
      "system": "R_Mark_Enemy",
      "phase": "start",
      "anchor": "target",
      "delay": 0,
      "maxDuration": 0.5,
      "note": "Target world anchor; target skeleton is unknown."
    },
    {
      "system": "P_Proc",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.6,
      "maxDuration": 1,
      "note": "Target world anchor; target skeleton is unknown."
    },
    {
      "system": "P_Tar_Impact",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.6,
      "maxDuration": 1,
      "note": "Target world anchor; target skeleton is unknown."
    }
  ],
  "unavailable": [
    [
      "BA_Cas/BA_Mis",
      "No dedicated basic attack system; melee has no flight."
    ],
    [
      "R_Dash/R_TimeTrail",
      "No corresponding source system; displacement requires host motion, not invented particles."
    ]
  ]
};
