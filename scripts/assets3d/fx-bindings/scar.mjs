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
      "system": "Q_mis_01",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world preview; host trajectory and child spawning are not reconstructed."
    },
    {
      "system": "Q_hit_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.7,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated target/area world anchor; independent variant preview."
    },
    {
      "system": "Q_Buf_Regen",
      "phase": "start",
      "anchor": "source",
      "delay": 0.8,
      "maxDuration": 1.2,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Chest_Loc",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "W_tar_crystal_travel",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world preview; host trajectory and child spawning are not reconstructed."
    },
    {
      "system": "W_tar_crystal_travel_child_01",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world preview; host trajectory and child spawning are not reconstructed."
    },
    {
      "system": "W_tar_crystal_travel_child_01_sm",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world preview; host trajectory and child spawning are not reconstructed."
    },
    {
      "system": "W_tar_crystal_travel_child_01_burst",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.7,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated target/area world anchor; independent variant preview."
    },
    {
      "system": "W_tar",
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
      "No dedicated Base BA systems; Q/W fragments remain skill previews."
    ],
    [
      "cast start/separate area",
      "No dedicated cast launch or separate area system; crystal children previewed independently."
    ]
  ],
  "note": "Approximated offline preview; stages/variants are independent, not a reconstruction of original skill branching, motion or duration."
};
