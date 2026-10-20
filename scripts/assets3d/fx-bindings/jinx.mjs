// Explicit preview bindings; default cast and alternatives retain legacy semantics.
export default {
  "attack": [
    {
      "system": "BA_Minigun_Cas_Medium",
      "phase": "start",
      "anchor": "source",
      "bone": "Minigun_Barrel1",
      "delay": 0,
      "maxDuration": 0.3,
      "status": "approximated",
      "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
    },
    {
      "system": "BA_Minigun_Mis",
      "phase": "travel",
      "anchor": "projectile",
      "bone": "Minigun_Barrel1",
      "delay": 0,
      "maxDuration": 0.35,
      "status": "approximated",
      "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
    }
  ],
  "cast": [
    {
      "system": "R_MuzzleFlash",
      "phase": "start",
      "anchor": "source",
      "bone": "Rocket_Launcher_End",
      "delay": 0,
      "maxDuration": 0.3,
      "status": "approximated",
      "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
    },
    {
      "system": "R_Cast_Mouth",
      "phase": "start",
      "anchor": "source",
      "bone": "Rocket_Launcher_Mouth_Top",
      "delay": 0,
      "maxDuration": 0.4,
      "status": "approximated",
      "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
    },
    {
      "system": "R_Rocket_Child",
      "phase": "travel",
      "anchor": "projectile",
      "bone": "Rocket_Launcher_End",
      "delay": 0.1,
      "maxDuration": 0.7,
      "status": "approximated",
      "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
    },
    {
      "system": "R_Tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1.5,
      "status": "approximated",
      "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
    }
  ],
  "variants": {
    "W": {
      "cast": [
        {
          "system": "W_Cas",
          "phase": "start",
          "anchor": "source",
          "bone": "Cstm_Buffbone_Pistol",
          "delay": 0,
          "maxDuration": 0.3,
          "status": "approximated",
          "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
        },
        {
          "system": "W_Mis",
          "phase": "travel",
          "anchor": "projectile",
          "bone": "Cstm_Buffbone_Pistol",
          "delay": 0.1,
          "maxDuration": 0.4,
          "status": "approximated",
          "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
        },
        {
          "system": "W_Beam",
          "phase": "travel",
          "anchor": "projectile",
          "bone": "Cstm_Buffbone_Pistol",
          "delay": 0.1,
          "maxDuration": 0.4,
          "status": "approximated",
          "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
        },
        {
          "system": "W_Tar",
          "phase": "impact",
          "anchor": "target",
          "delay": 0.5,
          "maxDuration": 0.5,
          "status": "approximated",
          "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
        }
      ]
    },
    "E": {
      "cast": [
        {
          "system": "E_Mis",
          "phase": "travel",
          "anchor": "projectile",
          "bone": "L_Hand",
          "delay": 0,
          "maxDuration": 0.5,
          "status": "approximated",
          "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
        },
        {
          "system": "E_Mine_Explosion",
          "phase": "impact",
          "anchor": "target",
          "delay": 0.5,
          "maxDuration": 1,
          "status": "approximated",
          "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
        }
      ]
    },
    "R": {
      "cast": [
        {
          "system": "R_MuzzleFlash",
          "phase": "start",
          "anchor": "source",
          "bone": "Rocket_Launcher_End",
          "delay": 0,
          "maxDuration": 0.3,
          "status": "approximated",
          "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
        },
        {
          "system": "R_Cast_Mouth",
          "phase": "start",
          "anchor": "source",
          "bone": "Rocket_Launcher_Mouth_Top",
          "delay": 0,
          "maxDuration": 0.4,
          "status": "approximated",
          "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
        },
        {
          "system": "R_Rocket_Child",
          "phase": "travel",
          "anchor": "projectile",
          "bone": "Rocket_Launcher_End",
          "delay": 0.1,
          "maxDuration": 0.7,
          "status": "approximated",
          "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
        },
        {
          "system": "R_Tar",
          "phase": "impact",
          "anchor": "target",
          "delay": 0.8,
          "maxDuration": 1.5,
          "status": "approximated",
          "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
        }
      ]
    }
  },
  "unavailable": []
};
