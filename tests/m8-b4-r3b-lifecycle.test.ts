import { describe, expect, it } from 'vitest';
import { itemMatch } from './fixtures/m8-b4-match';
import { stepMatch, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import type { CombatUnit } from '../src/simulation/combat';

const holder = (s: MatchState) => s.combat!.units.find(u => u.id === 'unit-1')!;
const receipts = (s: MatchState) => holder(s).mechanismState!.runtimes.filter(r => r.source.definitionId === 'bloodthirster');
function triggerFirst(s: MatchState): MatchState {
  if (s.phase !== 'combat') throw Error('combat fixture');
  // Controlled valid HP fixture; only real incoming damage can consume the source.
  s = { ...s, combat: { ...s.combat, units: s.combat.units.map(u => u.id === 'unit-1' ? { ...u, hp: 280, cooldownTicks: 1000, mana: 0 } : u) } };
  for (let i = 0; i < 100 && s.phase === 'combat' && !holder(s).shield; i++) s = stepMatch(s).state;
  expect(holder(s).shield).toBe(175 * receipts(s).length);
  expect(receipts(s).every(r => r.consumed && r.triggerCount === 1)).toBe(true);
  expect(receipts(s).length).toBeGreaterThan(0);
  return s;
}
function expireNaturally(s: MatchState): MatchState {
  if (s.phase !== 'combat') throw Error('combat fixture');
  const expiry = Math.max(...holder(s).shieldLayers!.map(l => l.expiresAtTick));
  // Pause further attacks/casts, then let the production shield maintenance end it.
  s = { ...s, combat: { ...s.combat, units: s.combat.units.map(u => ({ ...u, cooldownTicks: 1000, mana: 0 })) } };
  while (s.phase === 'combat' && s.combat.tick < expiry) s = stepMatch(s).state;
  expect(s.phase).toBe('combat'); expect(s.combat!.tick).toBe(expiry);
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
    // Resume real enemy attacks; witness positive damage below the threshold.
    s = { ...s, combat: { ...s.combat, units: s.combat.units.map(u => u.team === 'enemy' ? { ...u, cooldownTicks: 0 } : u) } };
    const resumed = stepMatch(s);
    expect(resumed.events.some(e => e.type === 'packetDamage' && e.unitId === 'unit-1' && e.hpDamage > 0)).toBe(true);
    expect(holder(resumed.state).shield).toBe(0);
    expect(resumed.events.filter(e => e.type === 'shieldLayerChanged' && e.unitId === 'unit-1' && e.reason === 'granted')).toEqual([]);
    expect(stepMatch(restoreMatch(serializeMatch(s)))).toEqual(resumed);
  });

  it('two equipment instances consume independently; one receipt cannot replace the other after both shields end', () => {
    const initial = itemMatch(['bloodthirster', 'bloodthirster']);
    expect(holder(initial).mechanismState!.unconsumedSurvivalKeys).toHaveLength(2);
    const fired = triggerFirst(restoreMatch(serializeMatch(initial)));
    expect(holder(fired).shield).toBe(350); expect(holder(fired).shieldLayers).toHaveLength(2);
    expect(new Set(receipts(fired).map(r => r.source.instanceId)).size).toBe(2);
    expect(new Set(receipts(fired).map(r => r.key)).size).toBe(2);
    expect(holder(fired).mechanismState!.unconsumedSurvivalKeys).toEqual([]);
    const ended = expireNaturally(fired);
    expect(receipts(ended)).toHaveLength(2);
    rejectMutation(ended, u => { (u.mechanismState as any).runtimes.pop(); }, /incomplete survival consumption/);
    rejectMutation(ended, u => { (u.mechanismState as any).runtimes[1] = structuredClone(u.mechanismState!.runtimes[0]); }, /item survival runtime/);
  });
});
