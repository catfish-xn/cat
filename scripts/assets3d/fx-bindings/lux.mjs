// Hand-selected from TFT13 local system inventory and GLB skin joints.
export default {
  "attack": [
    {
      "system": "BA_mis",
      "phase": "travel",
      "anchor": "projectile",
      "bone": "BUFFBONE_GLB_WEAPON_1",
      "delay": 0,
      "maxDuration": 0.4,
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
      "system": "W_mis",
      "phase": "travel",
      "anchor": "projectile",
      "bone": "BUFFBONE_GLB_WEAPON_1",
      "delay": 0.15,
      "maxDuration": 0.5,
      "note": "GLB skin joint verified; preview timing only."
    },
    {
      "system": "W_Shield",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.65,
      "maxDuration": 2,
      "note": "Target world anchor; target skeleton is unknown."
    },
    {
      "system": "P_Empowered_Weapon",
      "phase": "start",
      "anchor": "source",
      "bone": "BUFFBONE_GLB_WEAPON_1",
      "delay": 0,
      "maxDuration": 1,
      "note": "GLB skin joint verified; preview timing only."
    }
  ],
  "unavailable": [
    [
      "R_Beam",
      "No TFT13 straight laser system; W shield + empowered attack only."
    ],
    [
      "W_Cas",
      "No dedicated cast system."
    ]
  ]
};
