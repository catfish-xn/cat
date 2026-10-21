// Mel is TFT13_MissMage in the verified 14.24 skin BIN, not TFT13_Mel.
const stage = (system, phase, anchor, delay, maxDuration) => ({
  system: `TFT13_MissMage_Base_${system}`, phase, anchor, delay, maxDuration,
  status: 'approximated', note: 'Independent source fragment; estimated preview timing, no reconstructed host motion or child spawning.'
});
export default {
  attack: [stage('BA_mis', 'travel', 'projectile', .2, 1)],
  cast: [stage('R_cas', 'start', 'source', 0, 2), stage('R_cas_Ground', 'start', 'source', 0, 2),
    stage('R_Beam', 'travel', 'projectile', .5, 2), stage('R_Beam_Tar', 'impact', 'target', .8, 2),
    stage('R_Explosion', 'impact', 'target', 1.2, 2)],
  unavailable: [['attack-start', 'No independently identified BA start system in the own-skin inventory.'],
    ['attack-impact', 'No independently identified BA impact system; Q hit is not relabeled as a basic attack.']],
  note: 'One display cast only; no empowered form transition reconstruction. Every fragment uses the common FX_SCALE 0.44.'
};
