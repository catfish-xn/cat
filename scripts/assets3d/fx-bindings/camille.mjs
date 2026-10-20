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
      "system": "Q_2_cas",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "R_Buffbone_Glb_Foot_Loc",
      "note": "Estimated preview timing; verified all-anim skin joint."
    },
    {
      "system": "Q_2_cas_shin",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "R_Buffbone_Glb_Knee_Loc",
      "note": "Estimated preview timing; verified all-anim skin joint."
    },
    {
      "system": "Q_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.55,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated preview timing; world anchor, target skeleton unknown."
    },
    {
      "system": "W_heal",
      "phase": "impact",
      "anchor": "source",
      "delay": 0.7,
      "maxDuration": 1,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Center_Loc",
      "note": "Estimated preview timing; verified all-anim skin joint."
    },
    {
      "system": "Q_2_cas_child",
      "phase": "start",
      "anchor": "source",
      "bone": "R_Buffbone_Glb_Foot_Loc",
      "delay": 0.1,
      "maxDuration": 0.6,
      "status": "approximated",
      "note": "Standalone child preview; parent-child spawning not reconstructed. Verified all-anim joint."
    }
  ],
  "unavailable": [
    [
      "BA_Cas/BA_Mis",
      "No dedicated TFT13 Base attack launch system; melee has no projectile."
    ],
    [
      "cast travel/area",
      "Empowered melee; no dedicated flight/area Base system."
    ]
  ]
};
