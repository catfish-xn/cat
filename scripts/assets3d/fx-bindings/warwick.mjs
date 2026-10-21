// Independent fragments from Warwick's own TFT13 skin BIN; timing is estimated.
const stage = (system, phase, anchor, delay, maxDuration) => ({
  system: `TFT13_Warwick_Base_${system}`, phase, anchor, delay, maxDuration,
  status: 'approximated', note: 'Independent source fragment; estimated preview timing, no reconstructed host motion or child spawning.'
});
export default {
  attack: [stage('BA_Swipe_01', 'start', 'source', 0, .6), stage('Tar_Slash', 'impact', 'target', .3, .8)],
  cast: [stage('W_Bloodfrenzy_Activate', 'start', 'source', 0, 1.5),
    stage('R_Bloodfrenzy_Dash', 'travel', 'projectile', .2, .8),
    stage('R_DevourLeap_Land', 'impact', 'target', .8, 1.5),
    stage('Q_Devour_Bite', 'impact', 'target', .8, 1),
    stage('E_Bloodfrenzy_Activate_AoE', 'impact', 'source', .8, 2)],
  unavailable: [['attack-travel', 'Melee attack has no independently identified projectile system in the own-skin inventory.']],
  note: 'One display cast only; no form transition reconstruction. Every fragment uses the common FX_SCALE 0.44.'
};
