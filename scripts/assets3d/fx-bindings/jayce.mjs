// TFT13 Base systems; verified local skin joints; estimated timing only.
export default {
  "attack": [
    {
      "system": "BA_Range",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.2,
      "maxDuration": 0.5,
      "status": "approximated",
      "bone": "BUFFBONE_GLB_WEAPON_1",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "Swipe_Right",
      "phase": "start",
      "anchor": "source",
      "delay": 0.1,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "BUFFBONE_GLB_WEAPON_1",
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
      "system": "R_Cast_Dust",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "BUFFBONE_GLB_GROUND_LOC",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "R_Ranged_Recall_BuildUp",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "BUFFBONE_GLB_WEAPON_1",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "R_Ranged_Recall_Blast_Cast",
      "phase": "start",
      "anchor": "source",
      "delay": 0.3,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "BUFFBONE_GLB_WEAPON_1",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "R_Ranged_CrystalDestroyMissile",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.4,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "BUFFBONE_GLB_WEAPON_1",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "R_Ranged_Jump",
      "phase": "start",
      "anchor": "source",
      "delay": 0.2,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "BUFFBONE_GLB_GROUND_LOC",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "R_Ranged_Explosion",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.9,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "R_Ranged_PassExplosion",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "R_Crystal",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.7,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "R_Crystal_2",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "R_Shards_Child",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.9,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "R_Melee_Portal",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 1,
      "status": "approximated",
      "bone": "BUFFBONE_GLB_GROUND_LOC",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "R_Melee_Portal_Child",
      "phase": "start",
      "anchor": "source",
      "delay": 0.2,
      "maxDuration": 1,
      "status": "approximated",
      "bone": "BUFFBONE_GLB_GROUND_LOC",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "R_Melee_LightningCall",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.7,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "E_ThunderingBlow_Hit",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 0.8,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "E_ThunderingBlow_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 0.8,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "E_Knockback_Wave",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 0.8,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "R_Shield",
      "phase": "start",
      "anchor": "source",
      "delay": 0.2,
      "maxDuration": 1.5,
      "status": "approximated",
      "bone": "C_BUFFBONE_GLB_CHEST_LOC",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "W_Hexgate_ASBuff",
      "phase": "start",
      "anchor": "source",
      "delay": 0.2,
      "maxDuration": 1.5,
      "status": "approximated",
      "bone": "C_BUFFBONE_GLB_CHEST_LOC",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "W_Hexgate_ASBuff_Body",
      "phase": "start",
      "anchor": "source",
      "delay": 0.2,
      "maxDuration": 1.5,
      "status": "approximated",
      "bone": "C_BUFFBONE_GLB_CHEST_LOC",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "W_Ally_AS_Beam",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 1,
      "status": "approximated",
      "bone": "BUFFBONE_GLB_WEAPON_1",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "P_Hexgate_SpitEnemy",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    }
  ],
  "unavailable": [
    [
      "ranged attack start",
      "No dedicated ranged attack cast system."
    ],
    [
      "cast host orchestration",
      "Forms, portal placement and child spawning are independent preview fragments, not reconstructed chains."
    ]
  ],
  "note": "Approximated offline stage preview. Alternate forms/variants are independent fragments; no host trajectory, branching or child spawning reconstruction."
};
