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
      "system": "R_Cas",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_1",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "R_Indicator",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.2,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "R_Sword_Tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.7,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "R_AoE_Impact",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "R_Shield",
      "phase": "start",
      "anchor": "source",
      "delay": 0.3,
      "maxDuration": 1.5,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Chest_Loc",
      "note": "Estimated preview timing; verified skin joint."
    }
  ],
  "unavailable": [
    [
      "attack start/travel",
      "No dedicated Base attack launch; melee has no projectile."
    ],
    [
      "cast travel",
      "Sword arrival embedded in target effect; no independent projectile."
    ],
    [
      "R_Indicator visible area",
      "Only default tiny quad survives; indicator meshes skipped for unsupported-mesh-pivot."
    ]
  ],
  "note": "Approximated offline stage preview. Alternate forms/variants are independent fragments; no host trajectory, branching or child spawning reconstruction."
};
