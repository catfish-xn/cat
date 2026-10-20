// Explicit approximated TFT13 Base preview bindings.
export default {
  "attack": [
    {
      "system": "@shared-hit",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.35,
      "maxDuration": 0.5,
      "status": "approximated",
      "note": "Estimated preview timing; world anchor, target skeleton unknown."
    }
  ],
  "cast": [
    {
      "system": "P_buf",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 2,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Center_Loc",
      "note": "Estimated preview timing; verified all-anim skin joint."
    },
    {
      "system": "P_cleave",
      "phase": "impact",
      "anchor": "source",
      "delay": 0.4,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "Buffbone_Glb_Ground_Loc",
      "note": "Estimated preview timing; verified all-anim skin joint."
    },
    {
      "system": "P_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.4,
      "maxDuration": 0.8,
      "status": "approximated",
      "note": "Estimated preview timing; world anchor, target skeleton unknown."
    }
  ],
  "unavailable": [
    [
      "BA_Cas/BA_Mis",
      "No dedicated TFT13 Base attack launch system; melee has no projectile."
    ],
    [
      "cast travel",
      "No Base projectile for melee cleave; Idle systems excluded."
    ],
    [
      "P_buf visible body aura",
      "Attached meshes require skinning; remaining ArcsBIG size probability mean cancels to zero. Binding exists but no nonzero surface in current deterministic preview."
    ]
  ]
};
