// TFT13 Base systems; verified local skin joints; estimated timing only.
export default {
  "attack": [
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
      "system": "R_RelicFlash",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "Relic_Center",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "R_Cas_Dust",
      "phase": "start",
      "anchor": "source",
      "delay": 0.2,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "Buffbone_Glb_Ground_Loc",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "Z_Cast_Avatar",
      "phase": "start",
      "anchor": "source",
      "delay": 0.2,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Chest_Loc",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "E_LinkBeam",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "Relic_Center",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "E_Shrink_Hit",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.7,
      "maxDuration": 0.8,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "R_impact",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "R_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    }
  ],
  "unavailable": [
    [
      "attack start/travel",
      "No dedicated Base attack launch; melee has no projectile."
    ],
    [
      "cast area",
      "Area embedded in R_impact; link trajectory/endpoints require host."
    ]
  ],
  "note": "Approximated offline stage preview. Alternate forms/variants are independent fragments; no host trajectory, branching or child spawning reconstruction."
};
