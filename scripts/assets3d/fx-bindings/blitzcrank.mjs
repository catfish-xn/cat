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
      "system": "Q_cas",
      "phase": "start",
      "anchor": "source",
      "bone": "R_Hand",
      "delay": 0,
      "maxDuration": 0.3,
      "note": "GLB skin joint verified; preview timing only."
    },
    {
      "system": "Q_mis",
      "phase": "travel",
      "anchor": "projectile",
      "bone": "R_Hand",
      "delay": 0.15,
      "maxDuration": 0.4,
      "note": "GLB skin joint verified; preview timing only."
    },
    {
      "system": "Q_Tar2",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.55,
      "maxDuration": 0.6,
      "note": "Target world anchor; target skeleton is unknown."
    },
    {
      "system": "Q_mis_return",
      "phase": "travel",
      "anchor": "projectile",
      "bone": "R_Hand",
      "delay": 0.65,
      "maxDuration": 0.4,
      "note": "GLB skin joint verified; preview timing only."
    },
    {
      "system": "Q_Shield",
      "phase": "impact",
      "anchor": "source",
      "bone": "C_BUFFBONE_GLB_CENTER_LOC",
      "delay": 1.05,
      "maxDuration": 2,
      "note": "GLB skin joint verified; preview timing only."
    }
  ],
  "unavailable": [
    [
      "BA_Cas/BA_Mis",
      "No dedicated basic attack system; melee has no flight."
    ]
  ],
  "note": "Q system staging is a hook-like preview, not a claim TFT13 gameplay performs a pull; return needs reverse host trajectory."
};
