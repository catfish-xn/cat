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
      "system": "W_Buff",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 2,
      "status": "approximated",
      "bone": "C_BUFFBONE_GLB_CENTER_LOC",
      "note": "Estimated preview timing; verified all-anim skin joint."
    },
    {
      "system": "W_Spark_Mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.2,
      "maxDuration": 0.5,
      "status": "approximated",
      "bone": "C_BUFFBONE_GLB_CENTER_LOC",
      "note": "Estimated preview timing; verified all-anim skin joint."
    },
    {
      "system": "W_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.5,
      "maxDuration": 2,
      "status": "approximated",
      "note": "Estimated preview timing; world anchor, target skeleton unknown."
    }
  ],
  "unavailable": [
    [
      "BA_Cas/BA_Mis",
      "No dedicated TFT13 Base attack launch system; melee has no projectile."
    ]
  ]
};
