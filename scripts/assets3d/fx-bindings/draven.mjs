// TFT13 Base systems; local skin joints; estimated preview timing.
export default {
  "attack": [
    {
      "system": "BA_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.2,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "R_Weapon",
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
      "system": "Q_activation",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "R_Weapon",
      "note": "Estimated stage timing; verified local skin joint."
    },
    {
      "system": "Q_buf",
      "phase": "start",
      "anchor": "source",
      "delay": 0.1,
      "maxDuration": 1,
      "status": "approximated",
      "bone": "L_Weapon",
      "note": "Estimated stage timing; verified local skin joint."
    },
    {
      "system": "Q_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 0.7,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    },
    {
      "system": "Q_Alt_mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.4,
      "maxDuration": 0.7,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    },
    {
      "system": "Q_spinning_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.8,
      "maxDuration": 0.8,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    },
    {
      "system": "Q_reticle",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.9,
      "maxDuration": 1,
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
      "cast area",
      "Q_reticle previews landing marker; no independent damage area system."
    ]
  ],
  "note": "Approximated offline stage fragments. Variants and children are previewed independently; no trajectory, child spawning, buff duration or repeated shot reconstruction."
};
