import { beforeAll, describe, expect, it } from 'vitest';
import { startMatchCombat, stepMatch, sellUnit, deployMatchUnit, type MatchState } from '../src/simulation/match';
import { grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { isAbsent } from '../src/simulation/anomalies/availability';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { AUGMENT_HISTORY_OWNERS } from '../src/simulation/augment-history-owners';
import { accepted, reachRound } from './match-helpers';

// D5 registration makes seed 42's 2-1 forfeit Sniper's Nest. The solo proof then
// replays deployMatchUnit for units this test grants, which the proof never acquired.
// Seed 43, skipping history-owned offers, still opens g23 Sion and — within 250
// steps — both a knockup stun and a plain stun (probed 42–50, 3, 7 and 11).
const QUIET_2_1 = Object.keys(AUGMENT_HISTORY_OWNERS);

let opening: MatchState;
beforeAll(() => {
  let s = reachRound('2-1', true, 43, [], QUIET_2_1);
  for (const u of s.preparation.units.filter(u => u.team === 'player')) s = accepted(sellUnit(s, u.id));
  for (const [i, definitionId] of ['morgana','vladimir','cassiopeia'].entries()) {
    s = accepted(grantMechanicUnit(s, { receiptId: `v23-review-${definitionId}`, source: 'test', definitionId }));
    const u = s.preparation.units.find(u => u.team === 'player' && u.definitionId === definitionId)!;
    s = accepted(deployMatchUnit(s, u.id, { kind: 'board', cell: { col: i * 2, row: 4 } }));
  }
  opening = accepted(startMatchCombat(s));
  expect(opening.combat!.units.some(u => u.definitionId === 'g23-sion')).toBe(true);
  expect(restoreMatch(serializeMatch(opening))).toEqual(opening);
});
const entrances = {
  serialize: (s: MatchState) => serializeMatch(s),
  object: (s: MatchState) => restoreMatch(s),
  json: (s: MatchState) => restoreMatch(JSON.stringify(s)),
};

describe('v23 independent review: Match restore authority for new runtime fields', () => {
  it('legal Sion opening round-trips and resumes deterministically', () => {
    let live = opening, restored = restoreMatch(serializeMatch(opening));
    for (let i = 0; i < 25; i++) {
      const a = stepMatch(live), b = stepMatch(restored);
      expect(b).toEqual(a); live = a.state; restored = b.state;
    }
  });

  // Regression V23-R1: bind g23Sion structure, holder and replay history.
  // Forging a future reviveAtTick suspends any living unit, including a non-Sion.
  for (const [entrance, validate] of Object.entries(entrances)) {
    it.each(['g23-sion', 'morgana'])(`${entrance} must reject forged revive state on %s (V23-R1)`, definitionId => {
      const bad = structuredClone(opening), u = bad.combat!.units.find(u => u.definitionId === definitionId)!;
      Object.assign(u, { g23Sion: { reviveAtTick: 500, revived: false } });
      expect(() => validate(bad)).toThrow();
    });
    it(`${entrance} must reject malformed revive state (V23-R1)`, () => {
      const bad = structuredClone(opening), u = bad.combat!.units.find(u => u.definitionId === 'g23-sion')!;
      Object.assign(u, { g23Sion: { reviveAtTick: -1, revived: 'forged' } });
      expect(() => validate(bad)).toThrow();
    });
  }

  it('forged revive clock changes availability but is rejected at restore (V23-R1 impact)', () => {
    const bad = structuredClone(opening), u = bad.combat!.units.find(u => u.definitionId === 'morgana')!;
    Object.assign(u, { g23Sion: { reviveAtTick: 500, revived: false } });
    expect(() => restoreMatch(JSON.stringify(bad))).toThrow();
    expect(isAbsent(opening.combat!.units.find(v => v.id === u.id)!, 1)).toBe(false);
    expect(isAbsent(bad.combat!.units.find(v => v.id === u.id)!, 1)).toBe(true);
    const next = stepMatch(bad);
    expect(next.state.combat!.units.find(v => v.id === u.id)!.g23Sion).toEqual({ reviveAtTick: 500, revived: false });
    expect(next.events.some(e => e.type === 'cast' && e.receipt.source.ownerId === u.id)).toBe(false);
  });
});

let knockupSave: MatchState;
beforeAll(() => {
  let s = reachRound('2-1', true, 43, [], QUIET_2_1);
  for (const u of s.preparation.units.filter(u => u.team === 'player')) s = accepted(sellUnit(s, u.id));
  s = accepted(grantMechanicUnit(s, { receiptId: 'v23-review-vi', source: 'test', definitionId: 'vi' }));
  const vi = s.preparation.units.find(u => u.definitionId === 'vi')!;
  s = accepted(deployMatchUnit(s, vi.id, { kind: 'board', cell: { col: 3, row: 4 } }));
  s = accepted(startMatchCombat(s));
  for (let n = 0; n < 250 && s.phase === 'combat'; n++) {
    s = stepMatch(s).state;
    if (s.combat!.units.some(u => u.mechanismState?.statuses.some(g => g.contributions.some(c => c.application.knockup)))) {
      knockupSave = s; break;
    }
  }
  expect(knockupSave).toBeDefined();
  const stuns = knockupSave.combat!.units.flatMap(u => u.mechanismState?.statuses ?? []).filter(g => g.kind === 'stun').flatMap(g => g.contributions);
  expect(stuns.some(c => c.application.knockup === true)).toBe(true);
  expect(stuns.some(c => c.application.knockup === undefined)).toBe(true);
});

it('a legally acquired Vi knockup save round-trips and resumes', () => {
  const restored = restoreMatch(serializeMatch(knockupSave));
  expect(restored).toEqual(knockupSave);
  expect(stepMatch(restored)).toEqual(stepMatch(knockupSave));
});

// Regression V23-R2: legacy status projection checks kind/timing but never binds the
// knockup bit to the authenticated ability or its independently replayed status.
for (const [entrance, validate] of Object.entries(entrances)) {
  it(`${entrance} rejects removal of a genuine knockup bit (V23-R2)`, () => {
    const bad = structuredClone(knockupSave);
    const contribution = bad.combat!.units.flatMap(u => u.mechanismState?.statuses ?? []).flatMap(g => g.contributions).find(c => c.application.knockup)!;
    const app = contribution.application as { knockup?: true };
    delete app.knockup;
    expect(() => validate(bad)).toThrow();
  });
  it(`${entrance} rejects adding knockup to a genuine plain stun (V23-R2)`, () => {
    const bad = structuredClone(knockupSave);
    const contribution = bad.combat!.units.flatMap(u => u.mechanismState?.statuses ?? []).filter(g => g.kind === 'stun').flatMap(g => g.contributions).find(c => !c.application.knockup)!;
    expect(contribution).toBeDefined();
    Object.assign(contribution.application, { knockup: true });
    expect(() => validate(bad)).toThrow();
  });
}

let releaseSave: MatchState;
beforeAll(() => {
  let state = opening;
  for (let n = 0; n < 300 && state.phase === 'combat'; n++) {
    const r = stepMatch(state); state = r.state;
    if (!r.events.some(e => e.type === 'bindingChanged' && !e.bound)) continue;
    expect(state.combat!.units.some(u => u.mechanismState?.statuses.some(g => g.contributions.some(c => c.application.knockup)))).toBe(true);
    releaseSave = state; break;
  }
  expect(releaseSave).toBeDefined();
});

// Regression V23-R3: charge statuses use ability origin(effectIndex=1); the existing
// runtime source validator permits only effectIndex=0 for non-neutral abilities.
for (const [entrance, validate] of Object.entries(entrances)) {
  it(`${entrance} accepts a legal Sion charge with pending knockup (V23-R3)`, () => {
    expect(() => validate(releaseSave)).not.toThrow();
  });
}

it('legal Sion charge round-trips and continues through knockup expiry', () => {
  let live = releaseSave, restored = restoreMatch(serializeMatch(releaseSave));
  expect(restored).toEqual(live);
  for (let n = 0; n < 12; n++) {
    const a = stepMatch(live), b = stepMatch(restored);
    expect(b).toEqual(a);
    live = a.state; restored = b.state;
  }
});

for (const [entrance, validate] of Object.entries(entrances)) {
  it.each([
    null,
    {},
    { reviveAtTick: 20, revived: false },
    { reviveAtTick: 21.5, revived: false },
    { reviveAtTick: 21, revived: true },
    { reviveAtTick: 21, revived: false, forged: true },
  ])(`${entrance} rejects invalid or unearned Sion revival %j`, revival => {
    const bad = structuredClone(opening);
    Object.assign(bad.combat!.units.find(u => u.definitionId === 'g23-sion')!, { g23Sion: revival });
    expect(() => validate(bad)).toThrow();
  });
}
