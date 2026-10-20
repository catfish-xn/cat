// TFT13 Base systems; local skin joints; estimated preview timing.
export default {
  "attack": [
    {
      "system": "BA_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.2,
      "maxDuration": 0.5,
      "status": "approximated",
      "bone": "R_Hand",
      "note": "Estimated stage timing; verified local skin joint."
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
      "system": "Q_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    },
    {
      "system": "Q_Explosion",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.9,
      "maxDuration": 1.5,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    }
  ],
  "unavailable": [
    [
      "attack start",
      "No dedicated Base attack release system."
    ],
    [
      "cast start/travel",
      "No Base cast or missile system; monkey prop motion is not reconstructed."
    ]
  ],
  "note": "Approximated offline stage fragments. Variants and children are previewed independently; no trajectory, child spawning, buff duration or repeated shot reconstruction."
};
