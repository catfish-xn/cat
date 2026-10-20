// TFT13 Base inventory + real all-anim joints; timing/placement approximated.
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
      "system": "W_buf",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 2,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Center_Loc",
      "note": "Estimated preview timing; verified all-anim skin joint."
    },
    {
      "system": "W_cas_hit",
      "phase": "start",
      "anchor": "source",
      "delay": 0.1,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Center_Loc",
      "note": "Estimated preview timing; verified all-anim skin joint."
    },
    {
      "system": "W_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.6,
      "maxDuration": 1,
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
      "No Base projectile for self buff/nearby impact."
    ]
  ]
};
