// TFT13 Base systems; verified local skin joints; estimated preview timing.
export default {
  "attack": [
    {
      "system": "BA_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 1,
      "status": "approximated",
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
      "system": "Q_InitialAOE",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "R_Buffbone_Glb_Hand_Loc",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "Q_InitialAOE_ChildParticle",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "R_Buffbone_Glb_Hand_Loc",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "Q_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "Q_New_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1.5,
      "status": "approximated",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "Q_explosion",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1.5,
      "status": "approximated",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "R_R1_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1.5,
      "status": "approximated",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    }
  ],
  "unavailable": [
    [
      "attack-start",
      "No independent TFT13 Base system for this stage in the local inventory; not substituted."
    ],
    [
      "cast-area-independent",
      "No independent TFT13 Base system for this stage in the local inventory; not substituted."
    ]
  ],
  "note": "Approximated offline fragments; variants and children preview independently. No original trajectories, chaining, repeated attacks, gameplay duration or area reconstruction. Shared hit is a generic preview fallback."
};
