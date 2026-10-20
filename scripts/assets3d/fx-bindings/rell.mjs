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
      "system": "Q_Stab",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.7,
      "status": "approximated",
      "bone": "Lance",
      "note": "Estimated stage timing; verified local skin joint."
    },
    {
      "system": "Q_Stab_Child",
      "phase": "start",
      "anchor": "source",
      "delay": 0.1,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "Lance",
      "note": "Estimated stage timing; verified local skin joint."
    },
    {
      "system": "Q_Stab_Child_Ground",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.3,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    },
    {
      "system": "Q_Tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.4,
      "maxDuration": 0.8,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    },
    {
      "system": "Q_Tar_Child",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.5,
      "maxDuration": 0.8,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    },
    {
      "system": "Q_ArmorShred",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.5,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    },
    {
      "system": "Q_Shield",
      "phase": "start",
      "anchor": "source",
      "delay": 0.6,
      "maxDuration": 1,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Center_Loc",
      "note": "Estimated stage timing; verified local skin joint."
    }
  ],
  "unavailable": [
    [
      "attack start/travel",
      "No Base attack system; melee uses shared hit."
    ],
    [
      "cast travel",
      "Stab fragments are local effects, not an independent projectile."
    ]
  ],
  "note": "Approximated offline stage fragments. Variants and children are previewed independently; no trajectory, child spawning, buff duration or repeated shot reconstruction."
};
