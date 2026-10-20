// TFT13 Base systems; local skin joints; estimated preview timing.
export default {
  "attack": [
    {
      "system": "BA_Buff",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 0.6,
      "status": "approximated",
      "bone": "R_Weapon",
      "note": "Estimated stage timing; verified local skin joint."
    },
    {
      "system": "BA_Buff_Mis",
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
      "system": "Q_mis_heal",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "L_Hand",
      "note": "Estimated stage timing; verified local skin joint."
    },
    {
      "system": "R_hit_tar",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.6,
      "maxDuration": 0.8,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    },
    {
      "system": "R_Heal",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.9,
      "maxDuration": 1.2,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    }
  ],
  "unavailable": [
    [
      "cast start/area",
      "No independent Base cast release or area system; heal and strike are separate preview fragments."
    ]
  ],
  "note": "Approximated offline stage fragments. Variants and children are previewed independently; no trajectory, child spawning, buff duration or repeated shot reconstruction."
};
