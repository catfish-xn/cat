// Hand-selected from TFT13 local system inventory and GLB skin joints.
export default {
  "attack": [
    {
      "system": "BA_Mis",
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
      "system": "W_Cas",
      "phase": "start",
      "anchor": "source",
      "bone": "R_Hand",
      "delay": 0,
      "maxDuration": 0.3,
      "note": "GLB skin joint verified; preview timing only."
    },
    {
      "system": "W_Red_Mis",
      "phase": "travel",
      "anchor": "projectile",
      "bone": "R_Hand",
      "delay": 0.2,
      "maxDuration": 0.4,
      "note": "GLB skin joint verified; preview timing only."
    },
    {
      "system": "W_Red_Tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.6,
      "maxDuration": 1,
      "note": "Target world anchor; target skeleton is unknown."
    }
  ],
  "note": "Default red-card preview only; blue/yellow variants are alternatives, never simultaneous casts.",
  "unavailable": []
};
