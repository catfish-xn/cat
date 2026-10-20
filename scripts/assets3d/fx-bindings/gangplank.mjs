// TFT13 Base systems; verified local skin joints; estimated timing only.
export default {
  "attack": [
    {
      "system": "BA_Mis_Ranged",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.2,
      "maxDuration": 0.5,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_2",
      "note": "Estimated preview timing; verified skin joint."
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
      "system": "E_Ranged_Fuze",
      "phase": "start",
      "anchor": "target",
      "delay": 0,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "E_Ranged_Mis_Crit",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.2,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_2",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "W_GroundFire_Mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.2,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "Buffbone_Glb_Weapon_2",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "E_Ranged_Tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 0.8,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "E_Ranged_Explosion",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.9,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "R_Ranged_Bomb",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.9,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "W_ground_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.9,
      "maxDuration": 1.5,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "P_Tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 0.8,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "W_Melee_Heal",
      "phase": "impact",
      "anchor": "source",
      "delay": 0.6,
      "maxDuration": 1,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Chest_Loc",
      "note": "Estimated preview timing; verified skin joint."
    }
  ],
  "unavailable": [
    [
      "attack start",
      "No dedicated Base attack cast system."
    ],
    [
      "cast source start",
      "Fuse is target barrel anchor; no dedicated caster launch system."
    ]
  ],
  "note": "Approximated offline stage preview. Alternate forms/variants are independent fragments; no host trajectory, branching or child spawning reconstruction."
};
