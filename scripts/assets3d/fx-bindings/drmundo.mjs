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
      "system": "R_cas_01",
      "phase": "start",
      "anchor": "source",
      "bone": "C_Buffbone_Glb_Chest_Loc",
      "delay": 0,
      "maxDuration": 0.5,
      "note": "GLB skin joint verified; preview timing only."
    },
    {
      "system": "R_cas_02",
      "phase": "start",
      "anchor": "source",
      "bone": "C_Buffbone_Glb_Chest_Loc",
      "delay": 0.15,
      "maxDuration": 0.5,
      "note": "GLB skin joint verified; preview timing only."
    },
    {
      "system": "R_Buf",
      "phase": "impact",
      "anchor": "source",
      "bone": "C_Buffbone_Glb_Center_Loc",
      "delay": 0.3,
      "maxDuration": 3,
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
