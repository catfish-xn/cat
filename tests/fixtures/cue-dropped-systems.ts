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
  cassiopeia: {
    c83f1f21: { status: 'pending', reason: 'left out by mistake when the row was first written (11-03); to be played or dropped' },
  },
  scar: {
    '95d62c6a': { status: 'dropped', reason: 'not seen in the original cast footage (11-21 review): left out' },
    '4a8b0fd3': { status: 'dropped', reason: 'not seen in the original cast footage (11-21 review): left out' },
    '9f028364': { status: 'pending', reason: 'not checked against the original yet (11-21 scan)' },
  },
};

/**
 * Systems a champion's spell data names as a hit or missile effect (tests/fixtures/spell-referenced-systems.json) that the
 * repository lists do not play and CUE_DROPPED_SYSTEMS does not hold: they were never in an exported cue list, so a
 * replacement row could not drop them (11-21: one such hit effect was found by chance). Each is decided one by one: a later
 * change plays it, or moves it to `dropped` with our reason. Same statuses and wording rule as CUE_DROPPED_SYSTEMS.
 */
const TRIAGE = 'named by its spell data but never cued; to be triaged (11-21 spell-data scan)';
const triage = (...ids: string[]): Readonly<Record<string, DroppedSystem>> =>
  Object.fromEntries(ids.map(id => [id, { status: 'pending' as const, reason: TRIAGE }]));
export const SPELL_UNPLAYED_SYSTEMS: Readonly<Record<string, Readonly<Record<string, DroppedSystem>>>> = {
  caitlyn: triage('247720fe', '480f2392', '92c52047', 'b5a9a996'),
  cassiopeia: triage('259c4cbc'),
  gangplank: triage('bb62fca2'),
  jayce: triage('9eba4332'),
  kogmaw: triage('b9318ef6'),
  leblanc: triage('0ea87983'),
  renata: triage('d7729373'),
  swain: triage('3d2697ac'),
};
