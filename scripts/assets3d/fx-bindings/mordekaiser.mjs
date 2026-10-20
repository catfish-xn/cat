// TFT13 Base systems; verified local skin joints; estimated preview timing.
export default {
  "attack": [
    {
      "system": "BA_R2L_A",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "Buffbone_Glb_Mace_Loc",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "BA_L2R_A",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "Buffbone_Glb_Mace_Loc",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "@shared-hit",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.5,
      "maxDuration": 1.5,
      "status": "approximated",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    }
  ],
  "cast": [
    {
      "system": "Q_Mace_Charge",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "Buffbone_Glb_Mace_Loc",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "Q_Mace",
      "phase": "impact",
      "anchor": "source",
      "delay": 0.8,
      "maxDuration": 1.5,
      "status": "approximated",
      "bone": "Buffbone_Glb_Mace_Loc",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "R_Morde_Enter",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "Buffbone_Glb_Mace_Loc",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "R_Aura",
      "phase": "impact",
      "anchor": "source",
      "delay": 0.8,
      "maxDuration": 1.5,
      "status": "approximated",
      "bone": "Buffbone_Glb_Mace_Loc",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "E_HandGlow",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "Buffbone_Glb_Mace_Loc",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "E_HandTrail",
      "phase": "travel",
      "anchor": "source",
      "delay": 0.3,
      "maxDuration": 1,
      "status": "approximated",
      "bone": "Buffbone_Glb_Mace_Loc",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "E_floor",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1.5,
      "status": "approximated",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "E_floor_child",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1.5,
      "status": "approximated",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "E_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1.5,
      "status": "approximated",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "P_AoE",
      "phase": "impact",
      "anchor": "source",
      "delay": 0.8,
      "maxDuration": 1.5,
      "status": "approximated",
      "bone": "Buffbone_Glb_Mace_Loc",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    }
  ],
  "unavailable": [
    [
      "attack-travel",
      "No independent TFT13 Base system for this stage in the local inventory; not substituted."
    ],
    [
      "cast-travel-independent",
      "No independent TFT13 Base system for this stage in the local inventory; not substituted."
    ]
  ],
  "note": "Approximated offline fragments; variants and children preview independently. No original trajectories, chaining, repeated attacks, gameplay duration or area reconstruction. Shared hit is a generic preview fallback."
};
