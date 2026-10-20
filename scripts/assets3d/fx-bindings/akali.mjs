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
      "system": "E_Dash_Dust",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "Buffbone_Glb_Ground_Loc",
      "note": "Estimated preview timing; verified all-anim skin joint."
    },
    {
      "system": "E_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.2,
      "maxDuration": 0.5,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_1",
      "note": "Estimated preview timing; verified all-anim skin joint."
    },
    {
      "system": "E_Tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.55,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated preview timing; world anchor, target skeleton unknown."
    },
    {
      "system": "W_Tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.65,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated preview timing; world anchor, target skeleton unknown."
    },
    {
      "system": "E_Enemy_Indicator",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.2,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated preview timing; world anchor, target skeleton unknown."
    },
    {
      "system": "E_Run_Dust",
      "phase": "start",
      "anchor": "source",
      "delay": 0.15,
      "maxDuration": 0.6,
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
      "cast area",
      "No dedicated Base area system; dash host trajectory not reconstructed."
    ]
  ]
};
