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
      "system": "R_cas",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 1.2,
      "status": "approximated",
      "bone": "BUFFBONE_CSTM_IGNITE",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "R_cas_Child",
      "phase": "start",
      "anchor": "source",
      "delay": 0.1,
      "maxDuration": 1.2,
      "status": "approximated",
      "bone": "BUFFBONE_CSTM_IGNITE",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "R_cas_light",
      "phase": "start",
      "anchor": "source",
      "delay": 0.1,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "Buffbone_Cstm_Gun",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "R_cas_rocket",
      "phase": "start",
      "anchor": "source",
      "delay": 0.2,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "BUFFBONE_CSTM_ROCKET",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "R_cas_rocket_Child",
      "phase": "start",
      "anchor": "source",
      "delay": 0.2,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "BUFFBONE_CSTM_ROCKET",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "R_mis_01",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world preview; host trajectory and child spawning are not reconstructed."
    },
    {
      "system": "R_mis_01_Child",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world preview; host trajectory and child spawning are not reconstructed."
    },
    {
      "system": "R_Impact",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.7,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated target/area world anchor; independent variant preview."
    },
    {
      "system": "R_shield_01",
      "phase": "start",
      "anchor": "source",
      "delay": 0.2,
      "maxDuration": 1.2,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Chest_Loc",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    }
  ],
  "unavailable": [
    [
      "attack start/travel",
      "No dedicated Base normal attack systems; shared impact only."
    ],
    [
      "cast separate area",
      "Area is represented by R_Impact; upgrade UI/idle omitted."
    ]
  ],
  "note": "Approximated offline preview; stages/variants are independent, not a reconstruction of original skill branching, motion or duration."
};
