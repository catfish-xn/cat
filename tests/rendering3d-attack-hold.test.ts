import { describe, expect, it } from 'vitest';
import { ATTACK_HOLD_FALLBACK, ATTACK_HOLD_MIN_SECONDS, UnitActionState } from '../src/rendering3d/animation-state';
import { ATTACK_HOLD_UNITS } from '../src/rendering3d/attack-hold';

// A unit that holds its attack stays on its finished swing's pose while it keeps attacking: the next attack swings again,
// a run, cast, control or death leaves at once, and with no next attack it returns to idle only after the long fallback.
const swing = 0.9;
function unit(interval: number | undefined, holdAttack = true) {
  return new UnitActionState('u', { blendSeconds: 0, attackInterval: () => interval, holdAttack,
    resolvePlayback: state => state === 'attack' ? { clips: ['swing'], durationSeconds: swing } : state === 'cast' ? { clips: ['cast'], durationSeconds: 1 } : null });
}
const attack = { type: 'attack', attackerId: 'u' } as const;

describe('attack pose held between swings', () => {
  it('a slow attacker (1.5 s apart) still holds its finished swing until the next attack', () => {
    const s = unit(1.5); s.consume(attack);
    const revision = s.output.revision;
    s.update(1.49);
    expect(s.output.state).toBe('attack'); expect(s.holdingAttack).toBe(true); expect(s.output.revision).toBe(revision);
    s.consume(attack);
    expect(s.output.revision).toBe(revision + 1); expect(s.holdingAttack).toBe(false);
  });

  it('with no next attack it returns to idle only after the long fallback', () => {
    const wait = Math.max(ATTACK_HOLD_MIN_SECONDS, 1.5 * ATTACK_HOLD_FALLBACK);
    const s = unit(1.5); s.consume(attack);
    s.update(wait - 0.05); expect(s.output.state).toBe('attack');
    s.update(0.1); expect(s.output.state).toBe('idle'); expect(s.holdingAttack).toBe(false);
    const first = unit(undefined); first.consume(attack);
    first.update(ATTACK_HOLD_MIN_SECONDS - 0.05); expect(first.output.state).toBe('attack');
  });

  it('a run, a cast or a stun while holding leaves at once', () => {
    for (const leave of [(s: UnitActionState) => s.consume({ type: 'movement', unitId: 'u' }), (s: UnitActionState) => s.consume({ type: 'cast', sourceId: 'u' }), (s: UnitActionState) => s.stun()]) {
      const s = unit(1.5); s.consume(attack); s.update(swing + 0.05);
      leave(s);
      expect(s.output.state).not.toBe('attack'); expect(s.holdingAttack).toBe(false);
    }
  });

  it('a unit that does not hold returns to idle when its swing ends, as before', () => {
    const s = unit(1.5, false); s.consume(attack); s.update(swing + 0.01);
    expect(s.output.state).toBe('idle');
  });

  it('holds the units whose idle and attack stances face far apart, Twitch among them', () => {
    expect(ATTACK_HOLD_UNITS.has('twitch')).toBe(true);
    expect(ATTACK_HOLD_UNITS.has('garen')).toBe(false);
  });
});
