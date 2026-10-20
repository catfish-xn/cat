// Hand-selected from TFT13 local system inventory and GLB skin joints.
export default {
  "attack": [
    {
      "system": "BA_mis",
      "phase": "travel",
      "anchor": "projectile",
      "bone": "R_Hand",
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
      "system": "TFT13_Ziggs_Q_mis_01",
      "phase": "travel",
      "anchor": "projectile",
      "bone": "R_Hand",
      "delay": 0.15,
      "maxDuration": 0.65,
      "note": "Exact source name has no _Base_; no renamed substitute."
    },
    {
      "system": "Q_explosion",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1.2,
      "note": "Target world anchor; target skeleton is unknown."
    }
  ],
  "unavailable": [
    [
      "BA_Cas/Q_Cas",
      "No dedicated cast system in source inventory."
    ]
  ]
};
