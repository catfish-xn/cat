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
      "system": "Q_DR",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 1.5,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Center_Loc",
      "note": "Estimated stage timing; verified local skin joint."
    },
    {
      "system": "Q_Tar",
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
      "cast travel/area",
      "No independent Base projectile or area system."
    ]
  ],
  "note": "Approximated offline stage fragments. Variants and children are previewed independently; no trajectory, child spawning, buff duration or repeated shot reconstruction."
};
