// TFT13 Base systems; local skin joints; estimated preview timing.
export default {
  "attack": [
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
      "system": "Q_bite_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.4,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    }
  ],
  "unavailable": [
    [
      "attack start/travel",
      "No Base attack system; melee uses shared hit."
    ],
    [
      "cast start/travel/area",
      "Only bite target system exists; no independent release, projectile or area system."
    ]
  ],
  "note": "Approximated offline stage fragments. Variants and children are previewed independently; no trajectory, child spawning, buff duration or repeated shot reconstruction."
};
