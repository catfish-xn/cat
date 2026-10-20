// TFT13 Base systems; local skin joints; estimated preview timing.
export default {
  "attack": [
    {
      "system": "BA_P_Cas",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.5,
      "status": "approximated",
      "bone": "Muzzle",
      "note": "Estimated stage timing; verified local skin joint."
    },
    {
      "system": "BA_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.2,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "Muzzle",
      "note": "Estimated stage timing; verified local skin joint."
    },
    {
      "system": "BA_P_Mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 0.6,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    },
    {
      "system": "@shared-hit",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.4,
      "maxDuration": 0.5,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    }
  ],
  "cast": [
    {
      "system": "E_Cas_R_Canister",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "R_Canister",
      "note": "Estimated stage timing; verified local skin joint."
    },
    {
      "system": "E_Cas_L_Canister",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "L_Canister",
      "note": "Estimated stage timing; verified local skin joint."
    },
    {
      "system": "E_Cas_Center",
      "phase": "start",
      "anchor": "source",
      "delay": 0.1,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "C_Canister",
      "note": "Estimated stage timing; verified local skin joint."
    },
    {
      "system": "E_Mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 0.8,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    },
    {
      "system": "E_Mis_Child_01",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.4,
      "maxDuration": 0.8,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    },
    {
      "system": "E_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.9,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    },
    {
      "system": "E_AoE",
      "phase": "impact",
      "anchor": "target",
      "delay": 1,
      "maxDuration": 1.5,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    },
    {
      "system": "E_Shield",
      "phase": "impact",
      "anchor": "target",
      "delay": 1,
      "maxDuration": 1.5,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    }
  ],
  "unavailable": [],
  "note": "Approximated offline stage fragments. Variants and children are previewed independently; no trajectory, child spawning, buff duration or repeated shot reconstruction."
};
