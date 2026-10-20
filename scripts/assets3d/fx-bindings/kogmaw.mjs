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
      "bone": "BUFFBONE_GLB_WEAPON_LOC",
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
      "system": "W_buff_mouth",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 1.5,
      "status": "approximated",
      "bone": "BUFFBONE_GLB_WEAPON_LOC",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "W_EyeGlow",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 1.5,
      "status": "approximated",
      "bone": "C_BUFFBONE_GLB_HEAD_LOC",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "W_buf",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 1.5,
      "status": "approximated",
      "bone": "C_BUFFBONE_GLB_CHEST_LOC",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "Q_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.2,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "BUFFBONE_GLB_WEAPON_LOC",
      "note": "Estimated preview timing; verified skin joint."
    },
    {
      "system": "Q_tar",
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
      "W_buf visible body aura",
      "Only zero-area sampled ray survives; other emitters blocked by uvMode, hasPostRotateOrientation or attached-mesh skinning."
    ],
    [
      "attack start",
      "No dedicated Base attack cast system."
    ],
    [
      "cast area",
      "No dedicated Base area system; Q hit is target-local."
    ]
  ],
  "note": "Approximated offline stage preview. Alternate forms/variants are independent fragments; no host trajectory, branching or child spawning reconstruction."
};
