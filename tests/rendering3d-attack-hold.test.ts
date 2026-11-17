import { describe, expect, it } from 'vitest';
import { ATTACK_HOLD, ATTACK_HOLD_MAX, UnitActionState } from '../src/rendering3d/animation-state';

// A finished swing holds its last pose for the next attack (back-to-back attacks stay in the attack stance), and gives way
// to idle when no next attack comes within ATTACK_HOLD × the observed interval, or to a run, cast, control or death at once.
const swing = 0.9;
function unit(interval: number | undefined) {
  return new UnitActionState('u', { blendSeconds: 0, attackInterval: () => interval,
    resolvePlayback: state => state === 'attack' ? { clips: ['swing'], durationSeconds: swing } : state === 'cast' ? { clips: ['cast'], durationSeconds: 1 } : null });
}
const attack = { type: 'attack', attackerId: 'u' } as const;

describe('attack pose hold between swings', () => {
  it('holds the finished swing until ATTACK_HOLD intervals since it started, then returns to idle', () => {
    const s = unit(1); s.consume(attack);
    const revision = s.output.revision;
    s.update(swing + 0.01);
    expect(s.output.state).toBe('attack'); expect(s.holdingAttack).toBe(true); expect(s.output.revision).toBe(revision);
    s.update(1 * ATTACK_HOLD - swing - 0.02);
    expect(s.output.state).toBe('attack');
    s.update(0.05);
    expect(s.output.state).toBe('idle'); expect(s.holdingAttack).toBe(false);
  });

  it('the next attack during the hold starts a new swing', () => {
    const s = unit(1); s.consume(attack); s.update(swing + 0.05);
    const revision = s.output.revision;
    s.consume(attack);
    expect(s.output.state).toBe('attack'); expect(s.output.revision).toBe(revision + 1); expect(s.holdingAttack).toBe(false);
  });

  it('a run, a cast or a stun during the hold leaves it at once', () => {
    for (const leave of [(s: UnitActionState) => s.consume({ type: 'movement', unitId: 'u' }), (s: UnitActionState) => s.consume({ type: 'cast', sourceId: 'u' }), (s: UnitActionState) => s.stun()]) {
      const s = unit(1); s.consume(attack); s.update(swing + 0.05);
      leave(s);
      expect(s.output.state).not.toBe('attack'); expect(s.holdingAttack).toBe(false);
    }
  });

  it('without an observed interval (the first swing) or a swing as long as the hold, it returns to idle as before', () => {
    const first = unit(undefined); first.consume(attack); first.update(swing + 0.01);
    expect(first.output.state).toBe('idle');
    const slow = unit(swing / ATTACK_HOLD); slow.consume(attack); slow.update(swing + 0.01);
    expect(slow.output.state).toBe('idle');
  });

  it('a slow attacker whose gap would pass ATTACK_HOLD_MAX is not held: it rests in idle between swings', () => {
    const slow = unit((swing + ATTACK_HOLD_MAX + 0.5) / ATTACK_HOLD); slow.consume(attack); slow.update(swing + 0.01);
    expect(slow.output.state).toBe('idle');
  });
});

