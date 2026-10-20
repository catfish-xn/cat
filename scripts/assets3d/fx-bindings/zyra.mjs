// TFT13 Base inventory + real all-anim joints; timing/placement approximated.
export default {
  "attack": [
    {
      "system": "BA_mis",
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
      "system": "E_Sequence_Root",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "BUFFBONE_GLB_GROUND_LOC",
      "note": "Estimated preview timing; verified all-anim skin joint."
    },
    {
      "system": "E_Outer",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.2,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "BUFFBONE_GLB_GROUND_LOC",
      "note": "Estimated preview timing; verified all-anim skin joint."
    },
    {
      "system": "E_Sequence_Impact",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.7,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated preview timing; world anchor, target skeleton unknown."
    },
    {
      "system": "E_plant_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.7,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated preview timing; world anchor, target skeleton unknown."
    },
    {
      "system": "E_Sequence_Unroot",
      "phase": "impact",
      "anchor": "target",
      "delay": 1.3,
      "maxDuration": 0.8,
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
