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
      "system": "Q_FinalSlam_Cas",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_1",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "Q_WeaponIdle",
      "phase": "start",
      "anchor": "source",
      "delay": 0.1,
      "maxDuration": 1.2,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_1",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "Q_WeaponSmoke",
      "phase": "start",
      "anchor": "source",
      "delay": 0.1,
      "maxDuration": 1.2,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_1",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "P_Heal",
      "phase": "start",
      "anchor": "source",
      "delay": 0.2,
      "maxDuration": 1,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Chest_Loc",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "R_Hero_Dash",
      "phase": "start",
      "anchor": "source",
      "delay": 0.2,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "Buffbone_Glb_Ground_Loc",
      "note": "Estimated stage timing; verified skin joint; independent preview fragment."
    },
    {
      "system": "Q_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.4,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated target/area world anchor; independent variant preview."
    },
    {
      "system": "Q_FinalSlam_Impact",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.7,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated target/area world anchor; independent variant preview."
    },
    {
      "system": "Q_FinalSlam_Tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.7,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated target/area world anchor; independent variant preview."
    },
    {
      "system": "R_Hero_Tar",
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
      "No dedicated Base normal attack launch; melee has no independent projectile."
    ],
    [
      "cast projectile",
      "Dash is a source-host fragment; no independent projectile system."
    ]
  ],
  "note": "Approximated offline preview; stages/variants are independent, not a reconstruction of original skill branching, motion or duration."
};
