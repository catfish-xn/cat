/**
 * Systems a champion's exported cue list names that its CUE_OVERRIDES row (cue-overrides.ts) no longer plays. A row
 * replaces the whole exported list, so every system it leaves out must be accounted for here with our reason, or
 * tests/vfx-ltk-cue-dropped.test.ts fails (11-21: one system was left out by mistake when a row was first written).
 *
 * `dropped`: left out on purpose. `replaced`: another system in our list draws it. `pending`: not decided yet (left out
 * by mistake, or not yet checked against the original); a later change either plays it or moves it to `dropped`.
 * Reasons are ours: no names or values from the original game data.
 */
export type DropStatus = 'dropped' | 'replaced' | 'pending';
export interface DroppedSystem { readonly status: DropStatus; readonly reason: string }

export const CUE_DROPPED_SYSTEMS: Readonly<Record<string, Readonly<Record<string, DroppedSystem>>>> = {
  vex: {
    '893bead7': { status: 'dropped', reason: 'a target marker the 11-03 cast video review left out (PR #524)' },
  },
  sett: {
    '0856b131': { status: 'replaced', reason: 'drawn inside f7d4d344, which his cast plays whole instead (PR #674)' },
  },
  blitzcrank: {
    fc6cdcf0: { status: 'dropped', reason: 'hook cast: our skill is the shield and the shock, no hook (PR #524)' },
    '00f6794e': { status: 'dropped', reason: 'hook flight: our skill has no hook (PR #524)' },
    d4e2c121: { status: 'dropped', reason: 'hook return: our skill has no hook (PR #524)' },
  },
  smeech: {
    '16749c2e': { status: 'dropped', reason: 'a swing of his attack clips, not of his skill (PR #765)' },
    '73020613': { status: 'dropped', reason: 'a swing of his attack clips, not of his skill (PR #765)' },
  },
  leblanc: {
    '0aaf2502': { status: 'dropped', reason: 'weapon trail the 11-03 cast video review left out (PR #524)' },
  },
  mordekaiser: {
    '7078e23e': { status: 'dropped', reason: 'an entry effect outside the cast we play, left out in the 11-03 review (PR #524)' },
  },
  scar: {
    '95d62c6a': { status: 'dropped', reason: 'not seen in the original cast footage (11-21 review): left out' },
    '4a8b0fd3': { status: 'dropped', reason: 'not seen in the original cast footage (11-21 review): left out' },
    '9f028364': { status: 'pending', reason: 'not checked against the original yet (11-21 scan)' },
  },
};
