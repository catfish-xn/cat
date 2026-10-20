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
      "bone": "gun",
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
      "system": "R_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.2,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "R_missile",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "R_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "R_mis_big",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "L_missile",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "R_tar_big",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.9,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "R_Armor_Shred",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.9,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    }
  ],
  "unavailable": [
    [
      "attack/cast start",
      "No dedicated Base cast system."
    ],
    [
      "cast area",
      "Area bundled in R_tar/R_tar_big; no separate area system."
    ]
  ],
  "note": "Approximated offline stage preview. Alternate forms/variants are independent fragments; no host trajectory, branching or child spawning reconstruction."
};
