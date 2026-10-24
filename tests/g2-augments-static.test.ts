import { AUGMENT_BATCH2_ENABLED } from '../src/simulation/content/augment-pool-batch2';
import { AUGMENT_BATCH1 } from '../src/simulation/content/augment-pool-batch1';
import { AUGMENT_BATCH3 } from '../src/simulation/content/augment-pool-batch3';
import { describe, expect, it, vi } from 'vitest';
import { compileAugmentEffect } from '../src/simulation/augment-effects';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_BRONZE_THRESHOLDS } from '../src/simulation/content/augment-policy';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import type { CombatStrategyInputs } from '../src/simulation/combat-input';
import type { RoundResult } from '../src/simulation/match-types';
import type { Unit } from '../src/simulation/unit-types';
import type { Effect, TraitSnapshot } from '../src/simulation/strategy-types';

// This content slice has no purchasable 6-cost. Add one test-only definition to exercise the upper-cost boundary.
vi.mock('../src/simulation/units', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/simulation/units')>();
  return { ...actual, UNIT_DEFINITIONS: { ...actual.UNIT_DEFINITIONS, 'test-six-cost': { ...actual.UNIT_DEFINITIONS.lux, id: 'test-six-cost', cost: 6 } } };
});

// Independent, hand-transcribed expectations from the S13 source and December 17 B patch.
const mech = (mechanic: string, values: Record<string, number>): Effect => ({ kind: 'mechanic', mechanic, values });
const speed = (bps: number): Effect => ({ kind: 'attackSpeedBps', bps });
const flat = (stat: 'maxHp' | 'armor' | 'magicResist' | 'abilityPower', amount: number): Effect => ({ kind: 'statFlat', stat, amount });
const unit = (definitionId = 'lux', id = definitionId, col = 0, row = 4, team: 'player'|'enemy' = 'player'): Unit => ({ id, definitionId, starLevel: 1, team, location: { kind: 'board', cell: { col, row } } });
function fixture(units: Unit[] = [unit()]): CombatStrategyInputs {
  const base = createMatch();
  return { ...base, preparation: { ...base.preparation, units }, augments: [], items: [], temporaryEquipment: [], anomalyBinding: null, persistentGrowth: [], roundResults: [] };
}
const trait = (traitId: string, tier: number, members: string[] = [], team: 'player'|'enemy' = 'player'): TraitSnapshot => ({ traitId, tier, count: tier, team, memberDefinitionIds: members, targetUnitIds: [] });
function compiled(id: string, state = fixture(), target = state.preparation.units[0], traits: TraitSnapshot[] = [], acquiredRound = 1): Effect[] {
  return AUGMENT_DEFINITIONS[id].effects.flatMap(effect => compileAugmentEffect(effect, state, target, { definitionId: id, choiceId: `test:${id}`, acquiredRound }, state.preparation.units.filter(u => u.location.kind === 'board'), traits));
}
function resolved(id: string, state = fixture(), target = 'lux') {
  return buildStrategySnapshot({ ...state, augments: [{ definitionId: id, choiceId: 'test', acquiredRound: 1 }] }).units.find(u => u.unitId === target)!;
}
// Only the two history fields read by this pure compiler matter here; authority/history validation has separate coverage.
const history = (round: number, hpAfter = 100): RoundResult => ({ round, hpAfter } as RoundResult);

const expected: Record<string, Effect[]> = {
  'all-for-one-i': [mech('d11Fill', { enabled: 1 })],
  'trifecta-i': [mech('d11Fill', { enabled: 1 })],
  'spirit-link': [mech('d11Fill', { enabled: 1 })],
  'blinding-speed':[mech('acquisitionBundle',{enabled:1})],
  'portable-forge':[mech('acquisitionBundle',{enabled:1})],
  'radiant-relics':[mech('acquisitionBundle',{enabled:1})],
  'going-long':[mech('acquisitionGold',{amount:15}),mech('incomePolicy',{interestDisabled:1,interestCap:0,roundXp:4})],
  'hedge-fund':[mech('acquisitionGold',{amount:25}),mech('incomePolicy',{interestDisabled:0,interestCap:10,roundXp:0})],
  'investment-strategy-ii':[mech('acquisitionGold',{amount:5}),mech('incomePolicy',{interestDisabled:0,interestCap:7,roundXp:0}),mech('investment',{healthPerInterest:9})],
  ...Object.fromEntries(['crown-guarded','not-today','all-for-one-ii','belt-overflow','calculated-enhancement','crownguard-spirit','flurry-of-blows','guardbreaker-spirit','pair-of-fours','immovable-object','shojin-spirit','sword-overflow','trifecta-ii','wand-overflow'].map(id=>[id,[mech('s13P2Augment',{enabled:1})]])),
  // v22 approved placebo stage gold: 8/11/15 (Placebo+ 15/18/22) by acquisition stage.
  'placebo': [speed(100), mech('acquisitionGold', { amount: 8, stage3Amount: 11, stage4Amount: 15 })],
  'placebo-plus': [speed(100), mech('acquisitionGold', { amount: 15, stage3Amount: 18, stage4Amount: 22 })],
  'manaflow-i': [mech('extraAttackMana', { amount: 2, backRowOnly: 1 })],
  'manaflow-ii': [mech('extraAttackMana', { amount: 4, backRowOnly: 1 })],
  'glass-cannon-i': [mech('glassCannon', { startingHealthBps: 8000, damageAmpBps: 1200, backRowOnly: 1 })],
  'glass-cannon-ii': [mech('glassCannon', { startingHealthBps: 8000, damageAmpBps: 2000, backRowOnly: 1 })],
  'pumping-up-i': [speed(600), mech('pumpingUp', { attackSpeedBpsPerRound: 50 })],
  'pumping-up-ii': [speed(800), mech('pumpingUp', { attackSpeedBpsPerRound: 100 })],
  'pumping-up-iii': [speed(1200), mech('pumpingUp', { attackSpeedBpsPerRound: 200 })],
  'investment-strategy-i': [mech('investment', { healthPerInterest: 8 })],
  'bulky-buddies-i': [mech('bulkyBuddies', { health: 100, shieldMaxHpBps: 1000, durationTicks: 200 })],
  'bulky-buddies-ii': [mech('bulkyBuddies', { health: 175, shieldMaxHpBps: 1500, durationTicks: 200 })],
  'bulky-buddies-iii': [mech('bulkyBuddies', { health: 330, shieldMaxHpBps: 1800, durationTicks: 200 })],
  'mentorship-i': [mech('mentorship', { health: 150, attackSpeedBps: 1200 })],
  'mentorship-ii': [mech('mentorship', { health: 220, attackSpeedBps: 1800 })],
  'item-collector-i': [mech('itemCollector', { baseHealth: 10, healthPerItem: 2, adBpsPerItem: 100, apCentiPerItem: 100 })],
  'item-collector-ii': [mech('itemCollector', { baseHealth: 20, healthPerItem: 5, adBpsPerItem: 150, apCentiPerItem: 150 })],
  'bronze-for-life-i': [mech('bronzeForLife', { damageAmpBps: 300, durabilityBps: 0 })],
  'bronze-for-life-ii': [mech('bronzeForLife', { damageAmpBps: 350, durabilityBps: 150 })],
  'little-buddies': [mech('littleBuddies', { health: 65, attackSpeedBps: 700 })],
  'backup': [mech('backup', { minimum: 4, attackSpeedBps: 1000 })],
  'lineup': [mech('lineup', { resistCentiPerUnit: 250 })],
  'find-your-center': [mech('findCenter', { healthBps: 1500, damageAmpBps: 1500 })],
  'built-different': [mech('builtDifferent', { health2: 300, health3: 400, health4: 500, health5: 600, speed2: 4500, speed3: 5500, speed4: 6500, speed5: 7500 })],
  'blistering-strikes': [mech('blisteringStrikes', { durationTicks: 100, burnBpsPerSecond: 100, woundBps: 3300 })],
  'clockwork-accelerator': [mech('clockworkAccelerator', { attackSpeedBps: 1000, periodTicks: 60 })],
  'lone-hero': [mech('loneHero', { attackSpeedBps: 14000, durabilityBps: 3500 })],
  'climb-the-ladder-i': [mech('climbLadder', { adBps: 300, abilityPower: 3, armor: 3, magicResist: 3 })],
  'climb-the-ladder-ii': [mech('climbLadder', { adBps: 500, abilityPower: 5, armor: 5, magicResist: 5 })],
  'inspiring-epitaph': [mech('inspiringEpitaph', { shieldMaxHpBps: 2000, attackSpeedBps: 1000 })],
};
describe('G2, P1 and S13 P2 augments: independent exact source parameters', () => {
  it('contains exactly the thirty existing, six P1, fourteen P2, seven P3, three D11, one v19 Sisters and five v20 relationship augments', () => expect(Object.keys(AUGMENT_DEFINITIONS).sort()).toEqual([...Object.keys(AUGMENT_BATCH1),...Object.keys(AUGMENT_BATCH2_ENABLED),...Object.keys(AUGMENT_BATCH3),...Object.keys(expected),'mentorship','reunion','geniuses','menaces','unlikely-duo','sisters','defense-call','high-voltage','piercing-lotus-i','piercing-lotus-ii','pyromaniac','thorn-plated-armor','unleash-the-beast'].sort()));
  it.each(Object.keys(expected))('%s keeps exact normalized source values', id => expect(AUGMENT_DEFINITIONS[id].effects).toEqual(expected[id]));
});

describe('G2 static augment selectors and hand-calculated totals', () => {
  it.each([['bulky-buddies-ii', 675, 1500], ['bulky-buddies-iii', 830, 1800]] as const)('%s selects exactly one adjacent ally', (id, hp, shield) => {
    const state = fixture([unit(), unit('corki', 'buddy', 1, 4)]);
    const result = resolved(id, state);
    expect(result.stats.health).toBe(hp);
    expect(result.mechanics?.find(m => m.mechanic === 'bulkyBuddies')?.values.shieldMaxHpBps).toBe(shield);
    const twoNeighbors = fixture([unit(), unit('corki', 'buddy', 1, 4), unit('caitlyn', 'other', 0, 5)]);
    expect(resolved(id, twoNeighbors).stats.health).toBe(500);
    expect(resolved(id).stats.health).toBe(500);
  });
  it('manaflow II and glass cannon II are restricted to the last row by the real snapshot', () => {
    for (const [id, mechanic] of [['manaflow-ii', 'extraAttackMana'], ['glass-cannon-ii', 'glassCannon']] as const) {
      expect(resolved(id, fixture([unit('lux', 'lux', 0, 7)])).mechanics?.some(m => m.mechanic === mechanic)).toBe(true);
      expect(resolved(id, fixture([unit('lux', 'lux', 0, 6)])).mechanics?.some(m => m.mechanic === mechanic)).toBe(false);
    }
  });
  it.each([['mentorship-i', 150, 1200], ['mentorship-ii', 220, 1800]] as const)('%s only requires one higher-cost neighbor', (id, health, as) => {
    const lux = unit(), state = fixture([lux, unit('corki', 'corki', 1, 4), unit('caitlyn', 'caitlyn', 0, 5)]);
    expect(compiled(id, state)).toEqual([flat('maxHp', health), speed(as)]);
    expect(compiled(id, fixture([lux, unit('lux', 'equal', 1, 4)]))).toEqual([]);
    expect(compiled(id, fixture([lux, unit('corki', 'far', 6, 7)]))).toEqual([]);
    expect(compiled(id, fixture([lux, unit('corki', 'enemy', 1, 4, 'enemy')]))).toEqual([]);
  });
  it.each([['item-collector-i', 14, 200, 200], ['item-collector-ii', 30, 300, 300]] as const)('%s counts distinct worn items rather than copies or inventory', (id, hp, ad, ap) => {
    const state = { ...fixture([unit(), unit('irelia', 'holder', 6, 7)]), items: [
      { id: 'a', definitionId: 'sword', location: { kind: 'unit' as const, unitId: 'holder', slot: 0 } },
      { id: 'b', definitionId: 'bow', location: { kind: 'unit' as const, unitId: 'holder', slot: 1 } },
      { id: 'c', definitionId: 'sword', location: { kind: 'unit' as const, unitId: 'holder', slot: 2 } },
      { id: 'd', definitionId: 'rod', location: { kind: 'inventory' as const } },
    ] };
    expect(compiled(id, state)).toEqual([flat('maxHp', hp), { kind: 'statPercentBps', stat: 'attackDamage', bps: ad }, mech('fractionalFlat', { armorCenti: 0, magicResistCenti: 0, abilityPowerCenti: ap })]);
    const result = resolved(id, state);
    expect(result.abilityPower).toBe(id === 'item-collector-i' ? 102 : 103); // 2 × 1.5 = 3, never floor(1.5) × 2.
    expect(result.stats.health).toBe(id === 'item-collector-i' ? 514 : 530);
  });
  it('lineup sums two 2.5 contributions before integer rounding', () => {
    const state = fixture([unit('lux', 'lux', 0, 4), unit('irelia', 'irelia', 6, 5)]);
    expect(compiled('lineup', state)).toEqual([mech('fractionalFlat', { armorCenti: 500, magicResistCenti: 500, abilityPowerCenti: 0 })]);
    const result = resolved('lineup', state);
    expect([result.stats.armor, result.stats.magicResist]).toEqual([25, 25]);
    expect(compiled('lineup', fixture([unit('lux', 'lux', 0, 6)]))).toEqual([mech('fractionalFlat', { armorCenti: 0, magicResistCenti: 0, abilityPowerCenti: 0 })]);
  });
  it.each([['bronze-for-life-i', 600, 0], ['bronze-for-life-ii', 700, 300]] as const)('%s counts current source-style-1 tiers only', (id, amp, durability) => {
    expect(AUGMENT_BRONZE_THRESHOLDS.family).toEqual([]);
    expect(AUGMENT_BRONZE_THRESHOLDS.emissary).toEqual([1]);
    const traits = [trait('family', 3), trait('sorcerer', 2), trait('emissary', 1), trait('watcher', 4), trait('sentinel', 2, [], 'enemy'), trait('rebel', 0)];
    expect(compiled(id, fixture(), unit(), traits)).toEqual([mech('damageAmp', { bps: amp }), ...(durability ? [mech('watcher', { reductionBps: durability, healthyReductionBps: durability, thresholdBps: 0 })] : [])]);
  });
  it('backup requires four allies in the last two rows', () => {
    const back = [unit('lux', 'a', 0, 6), unit('lux', 'b', 1, 6), unit('lux', 'c', 2, 7), unit('lux', 'd', 3, 7)];
    expect(compiled('backup', fixture(back))).toEqual([speed(1000)]);
    expect(compiled('backup', fixture(back.slice(0, 3)))).toEqual([]);
    expect(compiled('backup', fixture([...back.slice(0, 3), unit('lux', 'front', 3, 5)]))).toEqual([]);
    expect(compiled('backup', fixture([...back.slice(0, 3), unit('lux', 'enemy', 3, 7, 'enemy')]))).toEqual([]);
  });
  it.each(['corki', 'caitlyn'])('little buddies gives %s two low-cost contributions', name => {
    const target = unit(name), state = fixture([target, unit('lux', 'low1', 3, 6), unit('akali', 'low2', 4, 7)]);
    expect(compiled('little-buddies', state)).toEqual([flat('maxHp', 130), speed(1400)]);
  });
  it.each(['lux', 'akali', 'blitzcrank', 'test-six-cost'])('little buddies never buffs cost 1/2/3/6 target %s', name => {
    expect(compiled('little-buddies', fixture([unit(name), unit('lux', 'low', 5, 6)]))).toEqual([]);
  });
  it.each([[1, 300, 4500], [4, 300, 4500], [11, 400, 5500], [18, 500, 6500], [25, 600, 7500], [32, 600, 7500]] as const)('built different round %i uses the B-patch stage ladder', (round, hp, as) => {
    expect(compiled('built-different', { ...fixture(), round })).toEqual([flat('maxHp', hp), speed(as)]);
  });
  it('built different rejects any active member trait but ignores unrelated and inactive traits', () => {
    const state = { ...fixture(), round: 4 };
    expect(compiled('built-different', state, unit(), [trait('sorcerer', 2, ['lux'])])).toEqual([]);
    expect(compiled('built-different', state, unit(), [trait('sorcerer', 0, ['lux']), trait('sentinel', 2, ['irelia'])])).toEqual([flat('maxHp', 300), speed(4500)]);
  });
  it('find center uses the documented player deployment center (3,5)', () => {
    expect(compiled('find-your-center', fixture([unit('lux', 'lux', 3, 5)]))).toEqual([{ kind: 'statPercentBps', stat: 'maxHp', bps: 1500 }, mech('damageAmp', { bps: 1500 })]);
    expect(resolved('find-your-center', fixture([unit('lux', 'lux', 3, 5)])).stats.health).toBe(575);
    expect(compiled('find-your-center', fixture([unit('lux', 'lux', 3, 4)]))).toEqual([]);
    expect(compiled('find-your-center', fixture([unit('lux', 'lux', 2, 5)]))).toEqual([]);
  });
  it('blistering strikes preserves the five-second attack burn and wound program parameters', () => {
    expect(compiled('blistering-strikes')).toEqual([mech('blisteringStrikes', { durationTicks: 100, burnBpsPerSecond: 100, woundBps: 3300 })]);
  });
  it('Pumping I retains its original validated counter even without multiplayer history',()=>{
    const state={...fixture(),round:8,augmentProgress:{pumpingRounds:3,investmentHp:0}};
    expect(compiled('pumping-up-i',state,unit(),[],4)).toEqual([speed(600),speed(150)]);
  });
  it.each([['pumping-up-ii', 800, 100], ['pumping-up-iii', 1200, 200]] as const)('%s uses its own completed combat nodes, not a shared progress counter', (id, base, perRound) => {
    const state = { ...fixture(), round: 8, roundResults: [history(1), history(2), history(3), history(4), history(5), history(6), history(7)], augmentProgress: { pumpingRounds: 99, investmentHp: 0 } };
    expect(compiled(id, state, unit(), [], 4)).toEqual([speed(base), speed(3 * perRound)]);
    expect(compiled(id, state, unit(), [], 7)).toEqual([speed(base), speed(0)]);
    expect(compiled(id, state, unit(), [], 8)).toEqual([speed(base), speed(0)]);
  });
});

describe('Bronze For Life includes the later S13 bronze traits',()=>{
 const added = [['ambusher',2],['visionary',2],['chem-baron',3],['dominator',2],['pit-fighter',2],['experiment',3],['bruiser',2],['black-rose',3],['quickstriker',2]] as const;
 it.each(added)('%s source bronze tier %i counts for both augments', (id,tier)=>{
   expect(compiled('bronze-for-life-i',fixture(),unit(),[trait(id,tier)])).toEqual([mech('damageAmp',{bps:300})]);
   expect(compiled('bronze-for-life-ii',fixture(),unit(),[trait(id,tier)])).toEqual([mech('damageAmp',{bps:350}),mech('watcher',{reductionBps:150,healthyReductionBps:150,thresholdBps:0})]);
   expect(compiled('bronze-for-life-i',fixture(),unit(),[trait(id,0),trait(id,tier,[],'enemy')])).toEqual([mech('damageAmp',{bps:0})]);
 });
 it('does not count higher or unique tiers and counts all nine bronze tiers together',()=>{
   const nonBronze=[trait('ambusher',3),trait('visionary',4),trait('chem-baron',4),trait('dominator',4),trait('pit-fighter',4),trait('experiment',5),trait('bruiser',4),trait('black-rose',4),trait('quickstriker',3),trait('high-roller',1),trait('junker-king',1),trait('family',3),trait('conqueror',4)];
   expect(compiled('bronze-for-life-i',fixture(),unit(),nonBronze)).toEqual([mech('damageAmp',{bps:0})]);
   expect(compiled('bronze-for-life-ii',fixture(),unit(),added.map(([id,tier])=>trait(id,tier)))).toEqual([mech('damageAmp',{bps:3150}),mech('watcher',{reductionBps:1350,healthyReductionBps:1350,thresholdBps:0})]);
 });
});
