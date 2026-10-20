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
      "system": "W_Self_Buff",
      "phase": "start",
      "anchor": "source",
      "delay": 0,
      "maxDuration": 1.5,
      "status": "approximated",
      "bone": "C_Buffbone_Glb_Center_Loc",
      "note": "Estimated stage timing; verified local skin joint."
    },
    {
      "system": "W_Mis",
      "phase": "travel",
      "anchor": "projectile",
      "delay": 0.3,
      "maxDuration": 0.8,
      "status": "approximated",
      "bone": "R_Hand",
      "note": "Estimated stage timing; verified local skin joint."
    },
    {
      "system": "W_Ally_Activate",
      "phase": "impact",
      "anchor": "target",
      "delay": 0.9,
      "maxDuration": 1,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    },
    {
      "system": "W_Ally_Buf",
      "phase": "impact",
      "anchor": "target",
      "delay": 1,
      "maxDuration": 1.5,
      "status": "approximated",
      "note": "Estimated stage timing and world anchor; host motion and target bones unspecified."
    },
    {
      "system": "W_Buff_Avatar2",
      "phase": "impact",
      "anchor": "target",
      "delay": 1,
      "maxDuration": 1.5,
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
      "cast area",
      "Ally buff fragments exist; no independent area system."
    ]
  ],
  "note": "Approximated offline stage fragments. Variants and children are previewed independently; no trajectory, child spawning, buff duration or repeated shot reconstruction."
};
