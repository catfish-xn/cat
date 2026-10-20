// TFT13 Base systems; verified local skin joints; estimated preview timing.
export default {
  "attack": [
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
      "system": "Q_Shield_Activate_1",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "Shield_Main",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "Q_Shield",
      "phase": "impact",
      "anchor": "source",
      "delay": 0.8,
      "maxDuration": 1.5,
      "status": "approximated",
      "bone": "Shield_Main",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "Q_AOE",
      "phase": "impact",
      "anchor": "source",
      "delay": 0.8,
      "maxDuration": 1.5,
      "status": "approximated",
      "bone": "Shield_Main",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "W_Shockwave_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1.5,
      "status": "approximated",
      "note": "Estimated preview stage timing and placement; independent fragment, no host motion or child spawning reconstruction."
    },
    {
      "system": "R_tar",
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
      "attack-travel",
      "No independent TFT13 Base system for this stage in the local inventory; not substituted."
    ],
    [
      "cast-travel",
      "No independent TFT13 Base system for this stage in the local inventory; not substituted."
    ]
  ],
  "note": "Approximated offline fragments; variants and children preview independently. No original trajectories, chaining, repeated attacks, gameplay duration or area reconstruction. Shared hit is a generic preview fallback."
};
