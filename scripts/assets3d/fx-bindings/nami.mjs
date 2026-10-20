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
      "system": "W_Water_spell",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "Weapon",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "W_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "W_tar_enemy",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1.5,
      "status": "approximated",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "W_buf",
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
      "cast-area",
      "No independent TFT13 Base system for this stage in the local inventory; not substituted."
    ]
  ],
  "note": "Approximated offline fragments; variants and children preview independently. No original trajectories, chaining, repeated attacks, gameplay duration or area reconstruction. Shared hit is a generic preview fallback."
};
