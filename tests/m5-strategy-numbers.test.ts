import { describe, expect, it } from 'vitest';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createMatch, nextRound, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import type { Unit } from '../src/simulation/units';
import { accepted, emptyBoard, reachRound } from './match-helpers';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { readCombatStats } from '../src/simulation/combat-s13';

// Expected numbers below are hand-transcribed/calculated from M5_RULES R3/R5.
// No content, effect-resolution, progression or RNG helper computes an expected value.
const placed = (definitionId: string, id = definitionId, col = 0, row = 4): Unit => ({
  id, definitionId, starLevel: 1, team: 'player', location: { kind: 'board', cell: { col, row } },
});
function fixture(names: readonly string[] = ['lux']): MatchState {
  const base = createMatch();
  return { ...base, phase: 'preparation', pendingChoice: null, combat: null, augments: [], items: [], anomalyBinding: null,
    preparation: { ...base.preparation, units: names.map((name, index) => placed(name, name, index % 7, 4 + Math.floor(index / 7))) } };
}
function augment(state: MatchState, ...ids: string[]): MatchState {
  return { ...state, augments: ids.map(definitionId => ({ definitionId, choiceId: `test-${definitionId}`, acquiredRound: 1 })) };
}
function equip(state: MatchState, unitId: string, ids: readonly string[]): MatchState {
  return { ...state, items: ids.map((definitionId, slot) => ({ id: `item-${slot + 1}`, definitionId, location: { kind: 'unit' as const, unitId, slot } })) };
}
function bind(state: MatchState, unitId: string, definitionId: string): MatchState {
  return { ...state, anomalyBinding: { unitId, definitionId, choiceId: 'anomaly-test', boundRound: 20 } };
}
const resolved = (state: MatchState, id = 'lux') => buildStrategySnapshot(state).units.find(unit => unit.unitId === id)!;
const mechanisms = (state: MatchState, id = 'lux') => (resolved(state, id).mechanics ?? []).map(value => ({ mechanic: value.mechanic, values: value.values }));

describe('M5 independent static totals for all sixteen items', () => {
  // Lux base: HP500 AD30 armor20 MR20 AP100 initialMana0 AS0.7/s.
  it.each([
    ['sword', 500, 33, 20, 20, 100, 0, 0],
    ['bow', 500, 30, 20, 20, 100, 0, 1000],
    ['rod', 500, 30, 20, 20, 110, 0, 0],
    ['tear', 500, 30, 20, 20, 100, 15, 0],
    ['vest', 500, 30, 40, 20, 100, 0, 0],
    ['cloak', 500, 30, 20, 40, 100, 0, 0],
    ['belt', 650, 30, 20, 20, 100, 0, 0],
    ['rageblade', 500, 30, 20, 20, 110, 0, 1000],
    ['deathblade', 500, 46, 20, 20, 100, 0, 0],
    ['shojin', 500, 34, 20, 20, 115, 15, 0],
    ['archangel', 500, 30, 20, 20, 120, 15, 0],
    ['deathcap', 500, 30, 20, 20, 150, 0, 0],
    ['warmog', 1232, 30, 20, 20, 100, 0, 0],
    ['dragons-claw', 545, 30, 20, 95, 100, 0, 0],
    ['gargoyle', 600, 30, 45, 45, 100, 0, 0],
    ['gunblade', 500, 36, 20, 20, 120, 0, 0],
  ] as const)('%s contributes total item stats exactly once', (id, hp, ad, armor, mr, ap, mana, speedBonus) => {
    const actual = resolved(equip(fixture(), 'lux', [id]));
    expect([actual.stats.health, actual.stats.attack, actual.stats.armor, actual.stats.magicResist,
      actual.abilityPower, actual.stats.initialMana, actual.stats.baseAttackSpeedBps, actual.stats.attackSpeedBonusBps])
      .toEqual([hp, ad, armor, mr, ap, mana, 7000, speedBonus]);
    expect(actual.sources.every(source => source.source.sourceKind === 'item' && source.source.sourceDefinitionId === id)).toBe(true);
  });

  it('adds percent sources before a single floor and never restores consumed components', () => {
    const actual = resolved(equip(fixture(), 'lux', ['deathblade', 'shojin', 'gunblade']));
    // AD = floor(30 × (1 + .55 + .15 + .20)) = 57; AP = 100 + 15 + 20.
    expect([actual.stats.attack, actual.abilityPower, actual.stats.initialMana]).toEqual([57, 135, 15]);
    expect(new Set(actual.sources.map(source => source.source.sourceDefinitionId))).toEqual(new Set(['deathblade', 'shojin', 'gunblade']));
  });
});

describe('M5 exact attack-speed interval arithmetic', () => {
  it('Lux plus Bow is ceil(20 / .77) = 26 ticks, not ceil(29 / 1.1)', () => {
    expect(resolved(equip(fixture(), 'lux', ['bow'])).stats.attackIntervalTicks).toBe(26);
  });
  it('adds Bow, Placebo and seven owned Pumping rounds before the only interval rounding', () => {
    const state = equip(augment(fixture(), 'placebo', 'pumping-up-i'), 'lux', ['bow']);
    const grown = { ...state, augmentProgress: { pumpingRounds: 7, investmentHp: 0 } };
    // .7 × (1 + .10 + .01 + .06 + .035) = .8435; ceil(20/.8435) = 24.
    expect(resolved(grown).stats.attackIntervalTicks).toBe(24);
  });
  it('Corki preserves fractional speed through a 19.5 percent multi-source interval calculation', () => {
    const state = equip(augment(fixture(['corki']), 'pumping-up-i'), 'corki', ['bow']);
    const grown = { ...state, augmentProgress: { pumpingRounds: 7, investmentHp: 0 } };
    // .75 × (1 + .10 + .06 + .035) = .89625; ceil(20/.89625) = 23.
    expect(resolved(grown, 'corki').stats.attackIntervalTicks).toBe(23);
  });
  it('Combat adds Kog cast attack speed to static Bow speed rather than multiplying the two', () => {
    const state = equip(fixture(['kogmaw']), 'kogmaw', ['bow']);
    const combat = createCombatWithEvents(state.preparation, buildStrategySnapshot(state), 'as-static').state;
    const kog = combat.units.find(unit => unit.id === 'kogmaw')!;
    const casting = { ...kog, runtime: { ...kog.runtime!, attackSpeedBps: 2500 } };
    // .7 × (1 + .10 + .25) = .945; ceil(20/.945) = 22.
    // Baking .77 into base and multiplying by 1.25 incorrectly returns 21.
    expect(readCombatStats(casting, { ...combat, units: [casting] }).attackIntervalTicks).toBe(22);
  });
  it('real Lux attacks add Rageblade stacks to Bow and Rageblade static speed', () => {
    const state = equip(fixture(), 'lux', ['bow', 'rageblade']);
    const enemy = { ...placed('neutral-stage-6', 'enemy', 0, 3), team: 'enemy' as const };
    const prepared = { ...state, preparation: { ...state.preparation, units: [...state.preparation.units, enemy] } };
    let combat = createCombatWithEvents(prepared.preparation, buildStrategySnapshot(prepared), 'as-dynamic').state;
    // Isolated combat fixture: keep the target passive while exercising actual onAttack hooks.
    combat = { ...combat, units: combat.units.map(unit => unit.id === 'enemy' ? { ...unit, attackDamage: 0 } : unit) };
    combat = stepCombat(combat).state;
    let lux = combat.units.find(unit => unit.id === 'lux')!;
    expect([lux.runtime?.attackCount, lux.runtime?.attackSpeedBps]).toEqual([1, 500]);
    // .7 × (1 + .10 Bow + .10 Rageblade + .05 stack) = .875; ceil(20/.875)=23.
    expect(readCombatStats(lux, combat).attackIntervalTicks).toBe(23);
    for (let n = 0; n < 100 && (lux.runtime?.attackCount ?? 0) < 3; n++) {
      combat = stepCombat(combat).state;
      lux = combat.units.find(unit => unit.id === 'lux')!;
    }
    expect([lux.runtime?.attackCount, lux.runtime?.attackSpeedBps]).toEqual([3, 1500]);
    // .7 × (1 + .10 + .10 + .15) = .945; ceil(20/.945)=22, not ceil(20/.966)=21.
    expect(readCombatStats(lux, combat).attackIntervalTicks).toBe(22);
  });
});

describe('M5 five professions at every reachable tier', () => {
  it.each([
    { names: ['irelia', 'rell', 'lux'], tier: 2, member: 76, outsider: 32 },
    { names: ['irelia', 'rell', 'leona', 'loris', 'lux'], tier: 4, member: 115, outsider: 45 },
  ])('Sentinel $tier grants triple member and single team defenses', ({ names, tier, member, outsider }) => {
    const state = fixture(names), snapshot = buildStrategySnapshot(state);
    expect(snapshot.traits.find(row => row.team === 'player' && row.traitId === 'sentinel')?.tier).toBe(tier);
    expect(resolved(state, 'irelia').stats).toMatchObject({ armor: member, magicResist: member });
    expect(resolved(state).stats).toMatchObject({ armor: outsider, magicResist: outsider });
  });
  it.each([
    { names: ['tristana', 'urgot', 'lux'], ad: 46, tier: 2 },
    { names: ['tristana', 'urgot', 'ezreal', 'corki', 'lux'], ad: 60, tier: 4 },
  ])('Artillerist $tier uses the highest tier only', ({ names, ad }) => {
    const state = fixture(names);
    expect(resolved(state, 'tristana').stats.attack).toBe(ad); // floor(42 × 1.10/1.45).
    expect(mechanisms(state, 'tristana')).toContainEqual({ mechanic: 'artillery', values: { everyN: 5, adBps: 12500, radius: 1 } });
    expect(resolved(state).stats.attack).toBe(30);
    expect(mechanisms(state)).toEqual([]);
  });
  it('Sniper two gives only members seven percent per hex', () => {
    const state = fixture(['maddie', 'kogmaw', 'lux']);
    for (const id of ['maddie', 'kogmaw']) expect(mechanisms(state, id)).toEqual([{ mechanic: 'sniper', values: { damageBpsPerHex: 700 } }]);
    expect(mechanisms(state)).toEqual([]);
  });
  it.each([
    { names: ['darius', 'vander', 'lux'], reductionBps: 1500, healthyReductionBps: 3000 },
    { names: ['darius', 'vander', 'scar', 'garen', 'lux'], reductionBps: 2500, healthyReductionBps: 4500 },
  ])('Watcher $reductionBps preserves the strict half-HP threshold contract', ({ names, reductionBps, healthyReductionBps }) => {
    const state = fixture(names);
    expect(mechanisms(state, 'darius')).toEqual([{ mechanic: 'watcher', values: { reductionBps, healthyReductionBps, thresholdBps: 5000 } }]);
    expect(mechanisms(state)).toEqual([]);
  });
  it.each([
    { names: ['lux', 'zyra', 'irelia'], ap: 120 },
    { names: ['lux', 'zyra', 'nami', 'zoe', 'irelia'], ap: 150 },
  ])('Sorcerer member AP $ap includes rather than duplicates the team grant', ({ names, ap }) => {
    const state = fixture(names);
    expect(resolved(state).abilityPower).toBe(ap);
    expect(resolved(state, 'irelia').abilityPower).toBe(110);
  });
  it('duplicate definitions and benched members cannot activate a tier', () => {
    const state = fixture(['irelia', 'lux']);
    const units = [...state.preparation.units, placed('irelia', 'duplicate', 4),
      { ...placed('rell'), location: { kind: 'bench' as const, slot: 0 } }];
    const snapshot = buildStrategySnapshot({ ...state, preparation: { ...state.preparation, units } });
    expect(snapshot.traits.find(row => row.team === 'player' && row.traitId === 'sentinel')).toMatchObject({ count: 1, tier: 0, targetUnitIds: [] });
  });
});

describe('M5 six augments and permanent accumulation', () => {
  it('Placebo compiles one percent attack speed and a separate eight-gold acquisition', () => {
    const state = augment(fixture(), 'placebo');
    expect(resolved(state).stats).toMatchObject({ baseAttackSpeedBps: 7000, attackSpeedBonusBps: 100 });
    expect(mechanisms(state)).toEqual([{ mechanic: 'acquisitionGold', values: { amount: 8 } }]);
    expect(state.gold).toBe(0); // Compiling a snapshot must not grant acquisition gold again.
  });
  it.each([
    ['manaflow-i', 'extraAttackMana', { amount: 2, backRowOnly: 1 }],
    ['glass-cannon-i', 'glassCannon', { startingHealthBps: 8000, damageAmpBps: 1200, backRowOnly: 1 }],
  ] as const)('%s freezes its last-row condition on the board', (id, mechanic, values) => {
    const state = augment(fixture(['lux', 'maddie']), id);
    const positioned = { ...state, preparation: { ...state.preparation, units: [placed('lux', 'lux', 0, 7), placed('maddie', 'maddie', 1, 6)] } };
    expect(mechanisms(positioned)).toEqual([{ mechanic, values }]);
    expect(mechanisms(positioned, 'maddie')).toEqual([]);
    expect(resolved(positioned).stats.health).toBe(500); // Glass changes starting HP in Combat, not max HP.
  });
  it('Pumping adds 6% plus 0.5 percentage points per completed owned round', () => {
    const state = augment(fixture(), 'pumping-up-i');
    expect(resolved(state).stats).toMatchObject({ baseAttackSpeedBps: 7000, attackSpeedBonusBps: 600 });
    expect(resolved({ ...state, augmentProgress: { pumpingRounds: 7, investmentHp: 0 } }).stats)
      .toMatchObject({ baseAttackSpeedBps: 7000, attackSpeedBonusBps: 950 });
  });
  it('Investment max-HP flats precede Warmog percent and benefit a later purchased unit', () => {
    const state = equip(augment(fixture(), 'investment-strategy-i'), 'lux', ['warmog']);
    const grown = { ...state, augmentProgress: { pumpingRounds: 0, investmentHp: 72 } };
    expect(resolved(grown).stats.health).toBe(1312); // floor((500 + 72 + 600) × 1.12).
    const newcomer = { ...grown, preparation: { ...grown.preparation, units: [...grown.preparation.units, placed('maddie', 'later-purchase', 4)] } };
    expect(resolved(newcomer, 'later-purchase').stats.health).toBe(572);
  });
  it('two actual loss settlements count 4+5 interest and two rounds exactly once', () => {
    let state = augment({ ...emptyBoard(reachRound('2-1')), gold: 49 }, 'pumping-up-i', 'investment-strategy-i');
    state = accepted(startMatchCombat(state));
    expect(state.augmentProgress).toEqual({ pumpingRounds: 1, investmentHp: 32 });
    expect(state.gold).toBe(58);
    expect(stepMatch(state).state).toBe(state);
    state = accepted(nextRound(state, state.round));
    expect(state.augmentProgress).toEqual({ pumpingRounds: 1, investmentHp: 32 });
    state = accepted(startMatchCombat(state));
    expect(state.augmentProgress).toEqual({ pumpingRounds: 2, investmentHp: 72 });
    expect(state.gold).toBe(69); // 58 + base5 + interest5 + second-loss1.
    expect(stepMatch(state).state).toBe(state);
  });
  it('Bulky requires exactly one allied neighbor and binds that concrete identity', () => {
    const state = augment(fixture(), 'bulky-buddies-i');
    const positions = [placed('lux', 'left', 1), placed('maddie', 'middle', 2), placed('zyra', 'right', 3), placed('nami', 'isolated', 6, 7)];
    const arranged = { ...state, preparation: { ...state.preparation, units: positions } };
    const snapshot = buildStrategySnapshot(arranged);
    expect(snapshot.units.map(u => [u.unitId, u.stats.health])).toEqual([['isolated', 700], ['left', 600], ['middle', 500], ['right', 600]]);
    for (const id of ['left', 'right']) expect(snapshot.units.find(u => u.unitId === id)?.mechanics).toContainEqual(expect.objectContaining({
      mechanic: 'bulkyBuddies', targetId: 'middle', values: { health: 100, shieldMaxHpBps: 1000, durationTicks: 200 },
    }));
    for (const id of ['isolated', 'middle']) expect(snapshot.units.find(u => u.unitId === id)?.mechanics?.some(m => m.mechanic === 'bulkyBuddies')).toBe(false);
  });
});

describe('M5 anomaly snapshot provenance and conversion order', () => {
  it('Mage Armor converts final AP after trait and item contributions without recursion', () => {
    const state = bind(equip(fixture(['lux', 'zyra', 'nami', 'zoe']), 'lux', ['deathcap', 'archangel', 'shojin']), 'lux', 'mage-armor');
    const actual = resolved(state);
    // AP100 + Sorcerer50 + Deathcap50 + Archangel20 + Shojin15 = 235; floor(235/2)=117.
    expect([actual.abilityPower, actual.stats.armor, actual.stats.magicResist]).toEqual([235, 137, 137]);
    expect(actual.sources.filter(s => s.source.sourceKind === 'anomaly').map(s => s.source)).toEqual([
      { ownerId: 'lux', sourceKind: 'anomaly', sourceDefinitionId: 'mage-armor', sourceInstanceId: 'anomaly-test', effectIndex: 0 },
    ]);
    expect(resolved(state, 'zyra').stats.armor).toBe(20);
    const copy = JSON.parse(JSON.stringify(state)) as MatchState;
    expect(buildStrategySnapshot(copy)).toEqual(buildStrategySnapshot(state));
  });
  it.each([
    ['titanic-strikes', 'titanic', { adBps: 4000, radius: 1 }],
    ['kill-streak', 'killStreak', { mana: 20 }],
  ] as const)('%s belongs only to its bound unit and carries its exact finite parameters', (id, mechanic, values) => {
    const state = bind(fixture(['lux', 'maddie']), 'lux', id);
    expect(mechanisms(state)).toEqual([{ mechanic, values }]);
    expect(mechanisms(state, 'maddie')).toEqual([]);
    expect(resolved(state).mechanics?.[0].source).toEqual({ ownerId: 'lux', sourceKind: 'anomaly', definitionId: id, instanceId: 'anomaly-test', effectIndex: 0 });
  });
});
