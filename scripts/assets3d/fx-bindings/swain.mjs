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
      "system": "P_Cas",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "L_Buffbone_Glb_Hand_Loc",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "R_PowerUp",
      "phase": "start",
      "anchor": "source",
      "delay": 0.1,
      "maxDuration": 1.2,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Center_Loc",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "R_Full",
      "phase": "start",
      "anchor": "source",
      "delay": 0.3,
      "maxDuration": 1.2,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Center_Loc",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "R_AOE_Indicator",
      "phase": "start",
      "anchor": "source",
      "delay": 0.3,
      "maxDuration": 1.2,
      "status": "approximated",
      "bone": "Buffbone_Glb_Ground_Loc",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "P_dmg_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world preview; host trajectory and child spawning are not reconstructed."
    },
    {
      "system": "P_Bird_Child_Mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world preview; host trajectory and child spawning are not reconstructed."
    },
    {
      "system": "P_Tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.7,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated target/area world anchor; independent variant preview."
    },
    {
      "system": "R_Explode",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.9,
      "maxDuration": 1.2,
      "status": "approximated",
      "note": "Estimated target/area world anchor; independent variant preview."
    },
    {
      "system": "E_Heal_tar",
      "phase": "start",
      "anchor": "source",
      "delay": 0.8,
      "maxDuration": 1,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Center_Loc",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    }
  ],
  "unavailable": [
    [
      "attack start",
      "No dedicated Base attack launch system."
    ],
    [
      "cast host lifecycle",
      "Transformation/passive fragments are independent previews; persistent aura and homing not reconstructed."
    ]
  ],
  "note": "Approximated offline preview; stages/variants are independent, not a reconstruction of original skill branching, motion or duration."
};
