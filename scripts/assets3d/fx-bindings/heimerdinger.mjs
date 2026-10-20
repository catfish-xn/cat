// Hand-selected from TFT13 local system inventory and GLB skin joints.
export default {
  "attack": [
    {
      "system": "BA_mis",
      "phase": "travel",
      "anchor": "projectile",
      "bone": "R_Hand",
      "delay": 0,
      "maxDuration": 0.35,
      "note": "GLB skin joint verified; preview timing only."
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
      "system": "W_Cas",
      "phase": "start",
      "anchor": "source",
      "bone": "C_Buffbone_Cstm_Rocket",
      "delay": 0,
      "maxDuration": 0.3,
      "note": "GLB skin joint verified; preview timing only."
    },
    {
      "system": "W_Mis",
      "phase": "travel",
      "anchor": "projectile",
      "bone": "C_Buffbone_Cstm_Rocket",
      "delay": 0.2,
      "maxDuration": 0.5,
      "note": "GLB skin joint verified; preview timing only."
    },
    {
      "system": "W_Tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.7,
      "maxDuration": 1,
      "note": "Target world anchor; target skeleton is unknown."
    }
  ],
  "unavailable": [
    [
      "Q_Turret",
      "No turret/summon system in TFT13 source inventory; W rockets available."
    ],
    [
      "BA_Cas",
      "No dedicated attack cast system."
    ]
  ]
};
