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
      "note": "Estimated target/area world anchor; independent variant preview."
    }
  ],
  "cast": [
    {
      "system": "Z_Jump_Launch",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "Buffbone_Glb_Ground_Loc",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "Z_Jump",
      "phase": "start",
      "anchor": "source",
      "delay": 0.1,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "Buffbone_Glb_Ground_Loc",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "Z_Jump_Trail",
      "phase": "start",
      "anchor": "source",
      "delay": 0.2,
      "maxDuration": 1,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Chest_Loc",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "Z_Swipe_Diagonal",
      "phase": "start",
      "anchor": "source",
      "delay": 0.3,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_1",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "Z_Swipe_Horizontal",
      "phase": "start",
      "anchor": "source",
      "delay": 0.3,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_1",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "Z_Swipe_Dual",
      "phase": "start",
      "anchor": "source",
      "delay": 0.3,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_1",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "Z_Swipe_vertical",
      "phase": "start",
      "anchor": "source",
      "delay": 0.3,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_1",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "Z_Swipe_Mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.4,
      "maxDuration": 0.8,
      "status": "approximated",
      "note": "Estimated world preview; host trajectory and child spawning are not reconstructed."
    },
    {
      "system": "Q_tar",
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
      "attack start/travel",
      "No dedicated BA systems; Z swipe variants previewed under cast without assuming normal attack triggers."
    ],
    [
      "cast separate area",
      "No separate area system; jump trajectory and repeated strikes not reconstructed."
    ]
  ],
  "note": "Approximated offline preview; stages/variants are independent, not a reconstruction of original skill branching, motion or duration."
};
