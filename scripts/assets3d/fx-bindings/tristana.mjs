// TFT13 Base inventory + real all-anim joints; timing/placement approximated.
export default {
  "attack": [
    {
      "system": "BA_Mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0,
      "maxDuration": 0.35,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_1",
      "note": "Estimated preview timing; verified all-anim skin joint."
    },
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
      "system": "R_cas",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_1",
      "note": "Estimated preview timing; verified all-anim skin joint."
    },
    {
      "system": "R_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.2,
      "maxDuration": 0.5,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_1",
      "note": "Estimated preview timing; verified all-anim skin joint."
    },
    {
      "system": "R_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.55,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated preview timing; world anchor, target skeleton unknown."
    },
    {
      "system": "R_tar_dust",
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
      "BA_Cas",
      "No dedicated TFT13 Base basic-attack launch system."
    ]
  ]
};
