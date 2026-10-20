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
      "system": "Q_Mis",
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
    },
    {
      "system": "R_Buf",
      "phase": "start",
      "anchor": "source",
      "delay": 0.1,
      "maxDuration": 1.2,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Chest_Loc",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    }
  ],
  "unavailable": [
    [
      "attack start",
      "No dedicated Base attack launch system."
    ],
    [
      "cast start/separate area",
      "No dedicated cast launch or separate area; summon/host lifecycle not reconstructed."
    ]
  ],
  "note": "Approximated offline preview; stages/variants are independent, not a reconstruction of original skill branching, motion or duration."
};
