import { afterEach, expect, test, vi } from 'vitest';
import { SHOP_CATALOG } from '../src/simulation/match-rules';
import { UNIT_DEFINITIONS, type Unit } from '../src/simulation/units';
import { createGame } from '../src/simulation/game';
import { nextRandom } from '../src/simulation/rng';
import { deriveEffectiveTrait, projectEffectiveMembership } from '../src/simulation/traits/effective-membership';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
import { isPlanned, normalizePlanner, PLANNER_KEY, previewTraits, readPlanner, replacePlan, selectPlan, snapshotPlan, toggleHero, writePlanner } from '../src/presentation/team-planner/model';

afterEach(() => vi.unstubAllGlobals());
const empty = () => normalizePlanner(null);
const unit = (definitionId: string, team: 'player' | 'enemy' = 'player', board = true): Unit => ({
  id: definitionId, definitionId, team, starLevel: 1,
  location: board ? { kind: 'board', cell: { col: 0, row: 4 } } : { kind: 'bench', slot: 0 },
});

test('three independent plans support add, remove, replacement, clear and active selection without mutating earlier state', () => {
  const original = empty(), first = toggleHero(original, 'irelia');
  const second = toggleHero(selectPlan(first, 1), 'lux');
  expect(original.plans).toEqual([[], [], []]);
  expect(second).toEqual({ active: 1, plans: [['irelia'], ['lux'], []] });
  expect(toggleHero(second, 'lux').plans).toEqual([['irelia'], [], []]);
  expect(replacePlan(selectPlan(second, 2), ['mel', 'viktor']).plans).toEqual([['irelia'], ['lux'], ['mel', 'viktor']]);
  expect(replacePlan(second, []).plans).toEqual([['irelia'], [], []]);
  expect(selectPlan(second, 0).plans[0]).toEqual(['irelia']);
});

test('untrusted storage is capped, deduplicated and filtered by the current shop catalog', () => {
  const state = normalizePlanner({ active: 2, plans: [['irelia', 'irelia', 'removed-hero', 17], SHOP_CATALOG, ['mel'], ['lux']] });
  expect(state.plans).toEqual([['irelia'], SHOP_CATALOG.slice(0, 10), ['mel']]);
  expect(state.active).toBe(2);
  expect(toggleHero(state, 'removed-hero')).toEqual(state);
  expect(toggleHero(selectPlan(state, 1), SHOP_CATALOG[10]).plans[1]).toEqual(SHOP_CATALOG.slice(0, 10));
  for (const value of [null, 42, 'string', [], { active: -1 }, { active: 3 }, { active: 0.5 }, { plans: 'invalid' }]) {
    expect(normalizePlanner(value)).toEqual(empty());
  }
});

test('snapshot uses only my board, removes duplicate heroes and non-shop summons, caps at 10 and preserves other plans', () => {
  const state = toggleHero(selectPlan(toggleHero(empty(), 'mel'), 1), 'lux');
  const board = [unit('irelia'), unit('irelia'), unit('lux', 'enemy'), unit('vex', 'player', false), unit('summon-sion')];
  const snapshot = snapshotPlan(state, board);
  expect(snapshot.plans).toEqual([['mel'], ['irelia'], []]);
  expect(state.plans[1]).toEqual(['lux']);
  expect(snapshotPlan(snapshot, SHOP_CATALOG.map(id => unit(id))).plans[1]).toEqual(SHOP_CATALOG.slice(0, 10));
  expect(snapshotPlan(snapshot, []).plans[1]).toEqual([]);
});

test('highlight membership follows only the active plan, including six-costs, and rejects empty/unknown slots', () => {
  const state = replacePlan(selectPlan(toggleHero(empty(), 'irelia'), 1), ['mel']);
  expect(isPlanned(state, 'mel')).toBe(true);
  expect(isPlanned(state, 'irelia')).toBe(false);
  expect(isPlanned(selectPlan(state, 0), 'irelia')).toBe(true);
  expect(isPlanned(toggleHero(state, 'mel'), 'mel')).toBe(false);
  expect(isPlanned(state, undefined)).toBe(false);
  expect(isPlanned(state, 'removed-hero')).toBe(false);
});

test('localStorage round trips only sanitized ids; corrupt data and blocked storage never interrupt play', () => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
  const state = toggleHero(selectPlan(empty(), 2), 'mel');
  writePlanner(state);
  expect(JSON.parse(data.get(PLANNER_KEY)!)).toEqual({ active: 2, plans: [[], [], ['mel']] });
  expect(readPlanner()).toEqual(state);
  data.set(PLANNER_KEY, '{bad json');
  expect(readPlanner()).toEqual(empty());
  data.set(PLANNER_KEY, JSON.stringify({ active: 1, plans: [[], ['lux', 'removed-hero', 'lux']] }));
  expect(readPlanner().plans[1]).toEqual(['lux']);
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } });
  expect(readPlanner()).toEqual(empty());
  expect(() => writePlanner(state)).not.toThrow();
  expect(isPlanned(state, 'mel')).toBe(true);
  vi.stubGlobal('localStorage', undefined);
  expect(readPlanner()).toEqual(empty());
  expect(() => writePlanner(state)).not.toThrow();
});

test('hero-only traits count distinct heroes, show thresholds, active tier and active-first sorting', () => {
  const rows = previewTraits(['irelia', 'irelia', 'vex', 'akali', 'removed-hero']);
  expect(rows.find(row => row.id === 'rebel')).toMatchObject({ count: 3, tier: 3, thresholds: [3, 5, 7, 10] });
  expect(rows.find(row => row.id === 'sentinel')).toMatchObject({ count: 1, tier: 0 });
  expect(rows[0].id).toBe('rebel');
  expect(previewTraits([])).toEqual([]);
});

test('emissary preview handles its exact 1/4 activation instead of falsely activating at 2 or 3', () => {
  const emissaries = ['nami', 'tristana', 'ambessa', 'garen'];
  for (const [count, tier] of [[1, 1], [2, 0], [3, 0], [4, 4]]) {
    expect(previewTraits(emissaries.slice(0, count)).find(row => row.id === 'emissary')).toMatchObject({ count, tier });
  }
});

test('seeded random hero combinations agree with domain trait counts and tiers', () => {
  let rng = 26;
  const pick = (max: number) => { const next = nextRandom(rng); rng = next.state; return Math.floor(next.word / 0x100000000 * max); };
  const seen = new Set<string>();
  for (let sample = 0; sample < 500; sample++) {
    const ids: string[] = [];
    const size = pick(11);
    for (let index = 0; index < size; index++) ids.push(SHOP_CATALOG[pick(SHOP_CATALOG.length)]);
    // Copies exercise distinct-definition counting; every board stays below the 10-hero plan cap.
    const units = [...ids, ...ids.slice(0, 2)].map((id, index) => ({ ...unit(id), id: `hero-${index}` }));
    const projection = projectEffectiveMembership({ ...createGame(), units });
    const preview = previewTraits(ids);
    for (const traitId of Object.keys(TRAIT_DEFINITIONS)) {
      const expected = deriveEffectiveTrait(projection, 'player', traitId);
      const actual = preview.find(row => row.id === traitId);
      if (expected.count === 0) expect(actual, `${sample}: ${traitId}`).toBeUndefined();
      else {
        expect(actual, `${sample}: ${ids.join(',')} / ${traitId}`).toMatchObject({
          count: expected.count, tier: expected.tier,
          thresholds: TRAIT_DEFINITIONS[traitId].tiers.map(tier => tier.threshold),
        });
        seen.add(traitId);
      }
    }
  }
  expect([...seen].sort()).toEqual([...new Set(SHOP_CATALOG.flatMap(id => UNIT_DEFINITIONS[id].traits))].sort());
});
