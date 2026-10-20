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
      "system": "W_DR",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 1.5,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Center_Loc",
      "note": "Estimated preview timing; verified all-anim skin joint."
    },
    {
      "system": "W_Swipe",
      "phase": "impact",
      "anchor": "source",
      "delay": 0.6,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "Buffbone_Glb_Ground_Loc",
      "note": "Estimated preview timing; verified all-anim skin joint."
    }
  ],
  "unavailable": [
    [
      "BA_Cas/BA_Mis",
      "No dedicated TFT13 Base attack launch system; melee has no projectile."
    ],
    [
      "cast travel",
      "No Base projectile; swipe source anchored."
    ]
  ]
};
