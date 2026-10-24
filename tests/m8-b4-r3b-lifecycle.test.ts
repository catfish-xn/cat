import { beforeAll, describe, expect, it } from 'vitest';
import { itemMatch } from './fixtures/m8-b4-match';
import { stepMatch, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import type { CombatUnit } from '../src/simulation/combat';
import { packets, shieldEvents } from './helpers/replay2-views';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

const holder = (s: MatchState) => s.combat!.units.find(u => u.id === 'unit-1')!;
const receipts = (s: MatchState) => holder(s).mechanismState!.runtimes.filter(r => r.source.definitionId === 'bloodthirster');
function triggerFirst(s: MatchState): MatchState {
  if (s.phase !== 'combat') throw Error('combat fixture');
  // Restore replays the authenticated opening, so only real incoming damage of
  // the unchanged combat may consume the source.
  // v22 damage mana (1% + 3%) lets Irelia cast first; her own ability shield is not the trigger, so wait for the
  // Bloodthirster consumption itself (her shield is fully absorbed by then).
  for (let i = 0; i < 200 && s.phase === 'combat' && !receipts(s).length; i++) s = stepMatch(s).state;
  // Bloodthirster gives 25% max HP per independent instance; later public
  // acquisition may include Bulky Buddies, so use the actual frozen max HP.
  expect(holder(s).shield).toBe(Math.floor(holder(s).maxHp / 4) * receipts(s).length);
  expect(receipts(s).every(r => r.consumed && r.triggerCount === 1)).toBe(true);
  expect(receipts(s).length).toBeGreaterThan(0);
  return s;
}
function expireNaturally(s: MatchState): MatchState {
  if (s.phase !== 'combat') throw Error('combat fixture');
  const expiry = Math.max(...holder(s).shieldLayers!.map(l => l.expiresAtTick));
  // Let the unchanged combat and production shield maintenance end every layer
  // (absorbed or expired); restore replays this exact combat.
  while (s.phase === 'combat' && s.combat.tick < expiry && holder(s).shieldLayers!.length) s = stepMatch(s).state;
  expect(s.phase).toBe('combat'); expect(s.combat!.tick).toBeLessThanOrEqual(expiry); expect(holder(s).alive).toBe(true);
  expect(holder(s).shieldLayers).toEqual([]); expect(holder(s).shield).toBe(0);
  expect(receipts(s).every(r => r.consumed)).toBe(true);
  expect(restoreMatch(serializeMatch(s))).toEqual(s);
  return s;
}
function rejectMutation(s: MatchState, mutate: (u: CombatUnit) => void, message: RegExp): void {
  const original = serializeMatch(s), raw = JSON.parse(original);
  mutate(raw.combat.units.find((u: CombatUnit) => u.id === 'unit-1'));
  expect(() => restoreMatch(raw)).toThrow(message);
  expect(() => restoreMatch(JSON.stringify(raw))).toThrow(message);
  expect(serializeMatch(s)).toBe(original);
  expect(stepMatch(restoreMatch(original))).toEqual(stepMatch(s));
}

describe('B4 R3b: compiled consumption partition survives the complete shield lifecycle', () => {
  // Prepare the shared single-instance snapshot before its first lifecycle case.
  beforeAll(() => { itemMatch('bloodthirster'); });

  it('untriggered legal object/JSON saves retain first use; missing/duplicate unconsumed identities are rejected', () => {
    const s = itemMatch('bloodthirster'), json = serializeMatch(s);
    expect(receipts(s)).toEqual([]);
    expect(holder(s).mechanismState!.unconsumedSurvivalKeys).toHaveLength(1);
    for (const input of [JSON.parse(json), json]) {
      const restored = restoreMatch(input); expect(restored).toEqual(s);
      const fired = triggerFirst(restored);
      expect(receipts(fired)).toHaveLength(1); expect(holder(fired).shield).toBe(175);
      expect(holder(fired).mechanismState!.unconsumedSurvivalKeys).toEqual([]);
      expect(restoreMatch(serializeMatch(fired))).toEqual(fired);
    }
    rejectMutation(s, u => { (u.mechanismState as any).unconsumedSurvivalKeys = []; }, /incomplete survival consumption/);
    rejectMutation(s, u => { (u.mechanismState as any).unconsumedSurvivalKeys.push(u.mechanismState!.unconsumedSurvivalKeys[0]); }, /survival consumption identity/);
  });

  it('consumed source with an active shield rejects deletion of its receipt in both restore entries', () => {
    const s = triggerFirst(itemMatch('bloodthirster'));
    expect(holder(s).shieldLayers).toHaveLength(1);
    rejectMutation(s, u => { (u.mechanismState as any).runtimes = []; }, /incomplete survival consumption/);
  });

  it('consumed source after natural shield expiry/cleanup still rejects receipt deletion and never grants again', () => {
    let s = expireNaturally(triggerFirst(itemMatch('bloodthirster')));
    rejectMutation(s, u => { (u.mechanismState as any).runtimes = []; }, /incomplete survival consumption/);
    if (s.phase !== 'combat') throw Error('combat fixture');
    // Keep fighting until real enemy damage lands below the threshold; every
    // step after restore is identical and never grants another shield.
    let hit = false;
    for (let i = 0; i < 200 && !hit && s.phase === 'combat'; i++) {
      const resumed = stepMatch(s);
      expect(stepMatch(restoreMatch(serializeMatch(s)))).toEqual(resumed);
      expect(shieldEvents(resumed.events).filter(e => e.unitId === 'unit-1' && e.reason === 'granted')).toEqual([]);
      hit = packets(resumed.events).some(e => e.unitId === 'unit-1' && e.hpDamage > 0);
      if (hit) expect(holder(resumed.state).shield).toBe(0);
      s = resumed.state;
    }
    expect(hit).toBe(true);
  });

  describe('two-instance fixture', () => {
    // Public acquisition traverses full battles unrelated to the lifecycle.
    // Warm only this case's compiled fixture; itemMatch returns a detached copy.
    // Keep this setup after the single-instance cases to preserve their order.
    beforeAll(() => { itemMatch(['bloodthirster', 'bloodthirster']); });

    it('two equipment instances consume independently; one receipt cannot replace the other after both shields end', () => {
      const initial = itemMatch(['bloodthirster', 'bloodthirster']);
      expect(holder(initial).mechanismState!.unconsumedSurvivalKeys).toHaveLength(2);
      const fired = triggerFirst(restoreMatch(serializeMatch(initial)));
      expect(holder(fired).shield).toBe(2 * Math.floor(holder(initial).maxHp / 4)); expect(holder(fired).shieldLayers).toHaveLength(2);
      expect(new Set(receipts(fired).map(r => r.source.instanceId)).size).toBe(2);
      expect(new Set(receipts(fired).map(r => r.key)).size).toBe(2);
      expect(holder(fired).mechanismState!.unconsumedSurvivalKeys).toEqual([]);
      const ended = expireNaturally(fired);
      expect(receipts(ended)).toHaveLength(2);
      rejectMutation(ended, u => { (u.mechanismState as any).runtimes.pop(); }, /incomplete survival consumption/);
      rejectMutation(ended, u => { (u.mechanismState as any).runtimes[1] = structuredClone(u.mechanismState!.runtimes[0]); }, /item survival runtime/);
    });
  });
});
