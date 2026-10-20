// Hand-selected from TFT13 local system inventory and GLB skin joints.
export default {
  "attack": [
    {
      "system": "BA_mis",
      "phase": "travel",
      "anchor": "projectile",
      "bone": "Buffbone_Cstm_Rifle_Barrel_Loc",
      "delay": 0,
      "maxDuration": 0.3,
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
      "system": "R_Cas",
      "phase": "start",
      "anchor": "source",
      "bone": "Buffbone_Cstm_Rifle_Barrel_Loc",
      "delay": 0,
      "maxDuration": 0.4,
      "note": "GLB skin joint verified; preview timing only."
    },
    {
      "system": "R_Scope_Hologram",
      "phase": "start",
      "anchor": "source",
      "bone": "Buffbone_Cstm_Rifle_Scope_Loc",
      "delay": 0,
      "maxDuration": 0.5,
      "note": "GLB skin joint verified; preview timing only."
    },
    {
      "system": "R_Target",
      "phase": "start",
      "anchor": "target",
      "delay": 0.1,
      "maxDuration": 0.5,
      "note": "Target world anchor; target skeleton is unknown."
    },
    {
      "system": "R_Bombardment_Mis",
      "phase": "travel",
      "anchor": "source",
      "delay": 0.5,
      "maxDuration": 0.5,
      "note": "No blimp bone in hero skeleton; host supplies world trajectory from source to target."
    },
    {
      "system": "R_Bombardment_Impact",
      "phase": "impact",
      "anchor": "target",
      "delay": 1,
      "maxDuration": 1.5,
      "note": "Target world anchor; target skeleton is unknown."
    }
  ],
  "unavailable": [
    [
      "BA_Cas",
      "Only BA_Crit_Cas exists; do not invent a critical attack."
    ]
  ]
};
