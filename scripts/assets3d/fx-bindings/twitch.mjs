// TFT13 Base systems; verified local skin joints; estimated timing only.
export default {
  "attack": [
    {
      "system": "BA_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.1,
      "maxDuration": 0.8,
      "status": "approximated",
      "note": "Estimated world preview; host trajectory and child spawning are not reconstructed."
    },
    {
      "system": "@shared-hit",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.4,
      "maxDuration": 0.5,
      "status": "approximated",
      "note": "Estimated target/area world anchor; independent variant preview."
    }
  ],
  "cast": [
    {
      "system": "R_cas",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_1",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "R_Buff",
      "phase": "start",
      "anchor": "source",
      "delay": 0.1,
      "maxDuration": 1.2,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Chest_Loc",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "R_Weapon_Glow",
      "phase": "start",
      "anchor": "source",
      "delay": 0.1,
      "maxDuration": 1.2,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_1",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "R_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world preview; host trajectory and child spawning are not reconstructed."
    },
    {
      "system": "R_Tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.7,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated target/area world anchor; independent variant preview."
    }
  ],
  "unavailable": [
    [
      "attack start",
      "No dedicated Base normal attack launch system."
    ],
    [
      "cast separate area",
      "No independent area system; empowered projectile/impact preview only."
    ]
  ],
  "note": "Approximated offline preview; stages/variants are independent, not a reconstruction of original skill branching, motion or duration."
};
