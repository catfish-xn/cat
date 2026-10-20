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
      "system": "Q_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.4,
      "maxDuration": 1.5,
      "status": "approximated",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "Q_heal_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.6,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "Q_heal_tar",
      "phase": "impact",
      "anchor": "source",
      "delay": 1,
      "maxDuration": 1.5,
      "status": "approximated",
      "bone": "R_Buffbone_Glb_Hand_Loc",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    }
  ],
  "unavailable": [
    [
      "attack-start",
      "No independent TFT13 Base system for this stage in the local inventory; not substituted."
    ],
    [
      "cast-start",
      "No independent TFT13 Base system for this stage in the local inventory; not substituted."
    ],
    [
      "cast-area",
      "No independent TFT13 Base system for this stage in the local inventory; not substituted."
    ]
  ],
  "note": "Approximated offline fragments; variants and children preview independently. No original trajectories, chaining, repeated attacks, gameplay duration or area reconstruction. Shared hit is a generic preview fallback."
};
