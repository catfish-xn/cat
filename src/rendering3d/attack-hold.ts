/**
 * Units that stay in their attack pose between swings (UnitActionState holdAttack): for these our idle clip faces far from
 * the attack clip's stance, so returning to idle after every swing turned them back and forth (C69 triage, Fable 11-18).
 * A display choice, fitted, not original data. Other units keep returning to idle.
 */
export const ATTACK_HOLD_UNITS: ReadonlySet<string> = new Set([
  'akali', 'ambessa', 'caitlyn', 'camille', 'ezreal', 'loris', 'maddie', 'renata', 'scar', 'smeech', 'swain', 'twitch', 'zoe',
]);
