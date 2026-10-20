// TFT13 Base systems; verified local skin joints; estimated timing only.
export default {
  "attack": [
    {
      "system": "BA_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.2,
      "maxDuration": 0.5,
      "status": "approximated",
      "bone": "R_Buffbone_Glb_Hand_Loc",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "@shared-hit",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.4,
      "maxDuration": 0.5,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    }
  ],
  "cast": [
    {
      "system": "TFT13_Elise_Ranged_Base_Q_cas",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "R_Buffbone_Glb_Hand_Loc",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "cas_spider",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "Buffbone_Glb_Ground_Loc",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "Cocoon_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.2,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "R_Buffbone_Glb_Hand_Loc",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "Cocoon_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "Cocoon_Heal_tar",
      "phase": "impact",
      "anchor": "source",
      "delay": 0.8,
      "maxDuration": 1,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Chest_Loc",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "Ranged_detonate",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.9,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "Ranged_detonate_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.9,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "Ranged_buf",
      "phase": "start",
      "anchor": "source",
      "delay": 0.2,
      "maxDuration": 1.5,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Chest_Loc",
      "note": "Estimated preview timing; verified skin joint."
    }
  ],
  "unavailable": [
    [
      "attack start",
      "No dedicated Base attack cast system."
    ],
    [
      "cast area",
      "Detonation embeds area; spider movement/form switch requires host."
    ]
  ],
  "note": "Approximated offline stage preview. Alternate forms/variants are independent fragments; no host trajectory, branching or child spawning reconstruction."
};
