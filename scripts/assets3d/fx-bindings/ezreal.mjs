// TFT13 Base systems; verified local skin joints; estimated timing only.
export default {
  "attack": [
    {
      "system": "BA_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.2,
      "maxDuration": 0.5,
      "status": "approximated",
      "bone": "Cstm_Buffbone_Cast_FX",
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
      "system": "Q_cas",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "Cstm_Buffbone_Cast_FX",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "W_Cas",
      "phase": "start",
      "anchor": "source",
      "delay": 0.1,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "Cstm_Buffbone_Cast_FX",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "Q_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.2,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "Cstm_Buffbone_Cast_FX",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "W_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "Cstm_Buffbone_Cast_FX",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "Q_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.7,
      "maxDuration": 0.8,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "W_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 0.8,
      "status": "approximated",
      "note": "Estimated world anchor; target skeleton or projectile host unspecified."
    },
    {
      "system": "W_AOE",
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
      "attack start",
      "No dedicated Base attack cast system."
    ]
  ],
  "note": "Approximated offline stage preview. Alternate forms/variants are independent fragments; no host trajectory, branching or child spawning reconstruction."
};
