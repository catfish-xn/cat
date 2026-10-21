// Independent fragments from Viktor's own TFT13 skin BIN; timing is estimated.
const stage = (system, phase, anchor, delay, maxDuration) => ({
  system: `TFT13_Viktor_Base_${system}`, phase, anchor, delay, maxDuration,
  status: 'approximated', note: 'Independent source fragment; estimated preview timing, no reconstructed host motion or child spawning.'
});
export default {
  attack: [stage('BA_Beam_Origin', 'start', 'source', 0, .8),
    stage('BA_Laser_Mis', 'travel', 'projectile', .2, .8), stage('BA_Hit', 'impact', 'target', .6, 1)],
  cast: [stage('R_Boardwide_Warning', 'start', 'source', 0, 2),
    stage('R_Knockup_Upstream', 'start', 'target', .5, 2),
    stage('R_Boardwide_Effect', 'impact', 'source', 1, 3),
    stage('R_Slam_Impact', 'impact', 'target', 1.5, 2)],
  unavailable: [['cast-travel', 'No independently identified cast projectile; boardwide fragments do not establish a trajectory.']],
  note: 'One display cast only; no avatar or form transition reconstruction. Every fragment uses the common FX_SCALE 0.44.'
};
