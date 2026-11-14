import type { TimelineCue } from '../timeline';
import { S13_TIMELINES } from '../s13-timelines';
import { CHEST } from '../timeline';
// Attack: 14.24 TFT13_JinxBasicAttack starts at Buffbone_Glb_Weapon_1 and hits C_BUFFBONE_GLB_CHEST_LOC.
/** Exactly twelve cues including attacks; R has one authoritative board-centre landing. */
export const jinxSkills: Record<string, readonly TimelineCue[]> = { jinx: [
  ...S13_TIMELINES.jinx.map(c => c.branch === 'rocket' && (c.event === 'projectile' || c.event === 'hit') ? { ...c, location: 'board' as const }
    : c.branch === 'chompers' ? { ...c, targetLimit: 3 } : c),
  { branch: 'zap', system: '40140250', event: 'projectile', stationary: true, bone: 'Cstm_Buffbone_Pistol', delay: 7.53 / 30, duration: .3, travelSeconds: .3, stopAfter: .15 },
  { system: '6d9e0430', action: 'attack', event: 'projectile', bone: 'Buffbone_Glb_Weapon_1', targetBone: CHEST, delay: 8.5 / 30, duration: .3, travelSeconds: .3 },
  { system: '0f2af66b', action: 'attack', event: 'hit', bone: CHEST, delay: 8.5 / 30 + .3, duration: .5 },
] };
