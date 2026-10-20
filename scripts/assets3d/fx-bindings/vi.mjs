// Explicit preview bindings; default cast and alternatives retain legacy semantics.
export default {
  "attack": [
    {
      "system": "@shared-hit",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.35,
      "maxDuration": 0.5,
      "status": "approximated",
      "note": "Shared basic attack target preview; no crit discriminator."
    }
  ],
  "cast": [
    {
      "system": "Q_activate_hands_R",
      "phase": "start",
      "anchor": "source",
      "bone": "R_GloveHand",
      "delay": 0,
      "maxDuration": 0.5,
      "status": "approximated",
      "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
    },
    {
      "system": "Q_activate_hands_L",
      "phase": "start",
      "anchor": "source",
      "bone": "L_GloveHand",
      "delay": 0,
      "maxDuration": 0.5,
      "status": "approximated",
      "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
    },
    {
      "system": "Q_Jumping_Dust",
      "phase": "start",
      "anchor": "source",
      "bone": "Buffbone_Glb_Ground_Loc",
      "delay": 0.1,
      "maxDuration": 0.4,
      "status": "approximated",
      "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
    },
    {
      "system": "Q_Landing_Mis",
      "phase": "travel",
      "anchor": "source",
      "bone": "C_Buffbone_Glb_Center_Loc",
      "delay": 0.1,
      "maxDuration": 0.35,
      "status": "approximated",
      "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
    },
    {
      "system": "Q_Landing_AoE",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.45,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
    },
    {
      "system": "Q_Landing_AoE_Child",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.45,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
    },
    {
      "system": "Q_Tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.45,
      "maxDuration": 0.8,
      "status": "approximated",
      "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
    }
  ],
  "variants": {
    "Q": {
      "cast": [
        {
          "system": "Q_activate_hands_R",
          "phase": "start",
          "anchor": "source",
          "bone": "R_GloveHand",
          "delay": 0,
          "maxDuration": 0.5,
          "status": "approximated",
          "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
        },
        {
          "system": "Q_activate_hands_L",
          "phase": "start",
          "anchor": "source",
          "bone": "L_GloveHand",
          "delay": 0,
          "maxDuration": 0.5,
          "status": "approximated",
          "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
        },
        {
          "system": "Q_Jumping_Dust",
          "phase": "start",
          "anchor": "source",
          "bone": "Buffbone_Glb_Ground_Loc",
          "delay": 0.1,
          "maxDuration": 0.4,
          "status": "approximated",
          "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
        },
        {
          "system": "Q_Landing_Mis",
          "phase": "travel",
          "anchor": "source",
          "bone": "C_Buffbone_Glb_Center_Loc",
          "delay": 0.1,
          "maxDuration": 0.35,
          "status": "approximated",
          "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
        },
        {
          "system": "Q_Landing_AoE",
          "phase": "impact",
          "anchor": "target",
          "delay": 0.45,
          "maxDuration": 1,
          "status": "approximated",
          "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
        },
        {
          "system": "Q_Landing_AoE_Child",
          "phase": "impact",
          "anchor": "target",
          "delay": 0.45,
          "maxDuration": 1,
          "status": "approximated",
          "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
        },
        {
          "system": "Q_Tar",
          "phase": "impact",
          "anchor": "target",
          "delay": 0.45,
          "maxDuration": 0.8,
          "status": "approximated",
          "note": "Explicit preview staging; no gameplay timing or host trajectory reconstruction."
        }
      ]
    }
  },
  "unavailable": []
};
