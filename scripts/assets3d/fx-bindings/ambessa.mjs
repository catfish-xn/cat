// TFT13 Base systems; verified local skin joints; estimated timing only.
export default {
  "attack": [
    {
      "system": "P_SpecialAttack_Swipe",
      "phase": "start",
      "anchor": "source",
      "delay": 0.1,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "L_Weapon",
      "note": "Estimated empowered-attack variant preview; verified skin joint; not a normal attack trigger."
    },
    {
      "system": "P_SpecialAttack_Swipe_R",
      "phase": "start",
      "anchor": "source",
      "delay": 0.1,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "R_Weapon",
      "note": "Estimated empowered-attack variant preview; verified skin joint; not a normal attack trigger."
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
      "system": "R_Energy_Windup",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Chest_Loc",
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
      "system": "R_Hurl_Swipe",
      "phase": "start",
      "anchor": "source",
      "delay": 0.4,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_1",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "R_Energy_Avatar",
      "phase": "start",
      "anchor": "source",
      "delay": 0.4,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Chest_Loc",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "R_Hurl_Impact",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "Q_ChainSwipe",
      "phase": "start",
      "anchor": "source",
      "delay": 0.2,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_1",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "Q_Swipe_Tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.6,
      "maxDuration": 0.7,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    }
  ],
  "unavailable": [
    [
      "normal attack start/travel",
      "No dedicated normal Base attack launch; passive special-attack swipes previewed independently; melee has no projectile."
    ],
    [
      "cast travel/area",
      "Host dash/chain trajectory not reconstructed; area is part of impact."
    ]
  ],
  "note": "Approximated offline stage preview. Alternate forms/variants are independent fragments; no host trajectory, branching or child spawning reconstruction."
};
