import type { TimelineCue } from '../timeline';
import { CHEST } from '../timeline';
// Attacks: 14.24 TFT13_JayceBasicAttack(_Ranged) hit C_BUFFBONE_GLB_CHEST_LOC.
/** Own-skin 14.24 fragments. Script-driven timings are presentation conventions. */
export const jayceSkills: Record<string, readonly TimelineCue[]> = {
  'jayce-front': [
    { system: 'a404455c', action: 'attack', event: 'cast-start', bone: 'C_Buffbone_Glb_Center_Loc', delay: 7 / 30, duration: .5, stopAfter: 8 / 30, fadeOut: true },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: CHEST, delay: .3, duration: .5 },
    { system: '2143d86a', event: 'cast-start', delay: 0, duration: .5 },
    { system: 'f7fa1af5', event: 'hit', primary: true, delay: .1, duration: 1, stopAfter: .3, fadeOut: true },
    { system: '8d9d784b', event: 'cast-start', delay: .2, duration: 1, stopAfter: .3 },
    { system: 'e07c8088', event: 'hit', primary: true, delay: .3, duration: .6 },
    { system: 'b84b5c7b', event: 'hit', delay: .3, duration: .6 },
  ],
  'jayce-back': [
    { system: '53b93f82', action: 'attack', event: 'projectile', bone: 'BUFFBONE_CSTM_WEAPON_1', targetBone: CHEST, delay: 8 / 30, duration: .3, travelSeconds: .3 },
    { system: '0f2af66b', action: 'attack', event: 'hit', bone: CHEST, delay: 8 / 30 + .3, duration: .5 },
    { system: '508e8c05', event: 'cast-start', bone: 'Buffbone_Cstm_Weapon_1', delay: 0, duration: .6, stopAfter: .3, fadeOut: true },
    { system: 'e5c0f9d8', event: 'cast-start', bone: 'Buffbone_Cstm_Weapon_1', delay: .3, duration: .5, stopAfter: .2 },
    { system: 'ee2e840c', event: 'projectile', targetLimit: 3, bone: 'BUFFBONE_CSTM_WEAPON_1', delay: .3, duration: .4, travelSeconds: .4 },
  ],
  // His crystals (rules 11-21, placeholder-renderer.ts jayceCrystal): each lands on its cell and stays there, then explodes
  // there when the rules set it off (each crystal its own landing and explosion, on the event's cell). The stay ends as its
  // crystal explodes (JAYCE_CRYSTAL_STAY); its duration is only a cap past that (self-chosen).
  'jayce-back-crystal-land': [{ system: '28c9be01', action: 'passive', event: 'hit', location: 'board', delay: 0, duration: 3 }],
  'jayce-back-crystal-blast': [{ system: '1ae6ef1d', action: 'passive', event: 'hit', location: 'board', delay: 0, duration: 1 }],
  'jayce-forge-front': [
    // The forge shield's visual plays its own life (including its closing layer) and ends early only when that ally's shield from
    // his ability ends (CUE_RULE_STOPS abilityShieldEndedOnHolder). The duration is a cap past the system's own end (fitted, not
    // original data); the old 0.5 s stop came before some of its layers began.
    { system: 'e8cd793f', event: 'hit', delay: 0, duration: 4.5 },
  ],
  'jayce-forge-back': [
    { system: 'afb2ec69', event: 'cast-start', delay: 0, duration: 1, stopAfter: .5 },
    { system: '92d79254', event: 'projectile', targetLimit: 3, delay: 0, duration: .3, travelSeconds: .3 },
    { system: 'fb47ce66', event: 'hit', targetLimit: 3, delay: .3, duration: 1, stopAfter: .4 },
  ],
};
export const jayceSkill = (form: 'front' | 'back') => `jayce-${form}`;
/** His landed crystal, which stays until its explosion (placeholder-renderer.ts stops it then). */
export const JAYCE_CRYSTAL_STAY = '28c9be01';
/** The display branches his crystals play from (placeholder-renderer.ts), repository-built (cue-overrides.ts CUE_EXTRA_SKILLS):
 * branches of his ranged form's list, so the dropped-system registry counts them with it. */
export const JAYCE_EVENT_SKILLS = ['jayce-back-crystal-land', 'jayce-back-crystal-blast'] as const;
