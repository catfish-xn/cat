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
      "system": "E_cas",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "Buffbone_Glb_Ground_Loc",
      "note": "Estimated preview timing; verified all-anim skin joint."
    },
    {
      "system": "E_tar_single_front",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.55,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated preview timing; world anchor, target skeleton unknown."
    },
    {
      "system": "E_tar_single_back",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.55,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated preview timing; world anchor, target skeleton unknown."
    },
    {
      "system": "E_tar_child_middle",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.6,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated preview timing; world anchor, target skeleton unknown."
    },
    {
      "system": "E_tar_child_dust",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.6,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated preview timing; world anchor, target skeleton unknown."
    },
    {
      "system": "E_cas_child",
      "phase": "start",
      "anchor": "source",
      "bone": "Buffbone_Glb_Ground_Loc",
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
      "cast travel",
      "No dedicated Base flight system; pull trajectory needs host."
    ]
  ]
};
