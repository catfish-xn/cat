import { expect, it } from 'vitest';
import { createCombatWithEvents, stepCombat, type CombatState } from '../src/simulation/combat';
import { readCombatStats } from '../src/simulation/combat-s13';
import { applyStatus, origin, type S13Unit } from '../src/simulation/combat-s13-state';
import { applyStatusContribution } from '../src/simulation/m8/status';
import { effectIdentity } from '../src/simulation/m8/identity';
import { asSource } from '../src/simulation/m8/s13-definitions';
import { anomalyInputs, quiet, startAnomaly } from './helpers/s13-anomalies';
import { accepted } from './fixtures/t13-loot-public';
import { createMatch, equipItem } from '../src/simulation/match';
import { grantMechanicItem } from '../src/simulation/seat-mechanics';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { advanceSpectralCutlass } from '../src/simulation/combat-g2-4b';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
import { packets } from './helpers/replay2-views';
import { hexDistance } from '../src/simulation/board';
import { compileBattle } from '../src/simulation/two-sided-battle';
import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { anomalyId } from './helpers/s13-anomalies';

it.each([0, 40])('M1 Scuttle clears 30 percent Shred/Sunder at death while retaining +%i resolved resists', bonus => {
  let state = quiet(startAnomaly('ScuttleFamiliar'));
  const units = structuredClone(state.units) as S13Unit[], owner = units.find(u => u.id === 'p')!, enemy = units.find(u => u.id === 'e')!;
  owner.armor = 100; owner.magicResist = 100; owner.hp = 1;
  if (bonus) applyStatus(owner, origin(owner), 'resistanceFlat', bonus, 100, 0, [], true);
  applyStatus(owner, origin(enemy), 'armorReduction', 3000, 100, 0, [], true);
  const source = asSource(origin(enemy));
  const applied = applyStatusContribution(owner.mechanismState!.statuses, effectIdentity('p4-anomaly', source, owner.id, 'shred'), {
    kind: 'shred', activation: 'immediate', magnitudeBps: 3000, duration: { kind: 'ticks', ticks: 100 },
    stackPolicy: { kind: 'strongest-category', category: 'shred', retainSuppressed: true },
    polarity: 'harmful', removable: true, damageFilter: null, onEnd: null,
  }, 0);
  owner.mechanismState = { ...owner.mechanismState!, statuses: applied.groups };
  enemy.cooldownTicks = 0;
  state = { ...state, units };
  expect(readCombatStats(owner, state)).toMatchObject({ armor: Math.floor((100 + bonus) * .7), magicResist: Math.floor((100 + bonus) * .7) });
  const step = stepCombat(state), crab = step.state.units.find(u => u.anomalySummon?.kind === 'crab')!;
  expect(step.events.some(e => e.type === 'death' && e.unitId === 'p')).toBe(true);
  expect(crab).toMatchObject({ armor: 100 + bonus, magicResist: 100 + bonus });
});

it('M2 Repulsor stops at the first occupied step instead of jumping to (0,1)', () => {
  let state = quiet(startAnomaly('Repulsor', 'lux', [
    ...[{ col: 2, row: 3 }, { col: 1, row: 2 }, { col: 2, row: 2 }].map((cell, i) => ({
      id: 'block-' + i, definitionId: 'garen', starLevel: 1 as const, team: 'enemy' as const, location: { kind: 'board' as const, cell },
    })),
  ]));
  state = { ...state, units: state.units.map(u => u.id === 'p' ? { ...u, maxMana: 50, mana: 50 } : u) };
  const step = stepCombat(state);
  expect(step.state.units.find(u => u.id === 'e')!.cell).toEqual({ col: 1, row: 3 });
  expect(step.events.filter(e => e.type === 'movement' && e.unitId === 'e')).toEqual([]);
});

function itemAnomaly(suffix: string, itemId: string): CombatState {
  const { inputs } = anomalyInputs(suffix);
  const base = { ...inputs, preparation: { ...inputs.preparation, units: inputs.preparation.units.map(u => ({ ...u,
    location: { kind: 'board' as const, cell: u.id === 'p' ? { col: 3, row: 7 } : { col: 3, row: 0 } },
  })) } };
  let state = accepted(grantMechanicItem(base, { receiptId: 'review-item', source: 'test', definitionId: itemId }));
  state = accepted(equipItem(state, state.items.at(-1)!.id, 'p', 0));
  return createCombatWithEvents(state.preparation, buildStrategySnapshot(state), 'p4-review').state;
}
it.each(['WolfFamiliars', 'DeftHands'])('M3 %s plus enemy Zephyr returns the owner to (3,7)', suffix => {
  const base = createMatch(42), round = getCatalogRoundById('2-1');
  const seat = (binding: boolean) => ({ ...base, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round },
    preparation: { ...base.preparation, units: [{ id: 'unit-1', definitionId: binding ? 'lux' : 'garen', starLevel: 1 as const,
      team: 'player' as const, location: { kind: 'board' as const, cell: { col: 3, row: 7 } } }] },
    items: binding ? [] : [{ id: 'item-1', definitionId: 'TFT_Item_Zephyr', location: { kind: 'unit' as const, unitId: 'unit-1', slot: 0 as const } }],
    anomalyBinding: binding ? { unitId: 'unit-1', definitionId: anomalyId(suffix), choiceId: 'review-anomaly', boundRound: 1 } : null,
  });
  const input = compileBattle(snapshotForBattle(seat(true), 'A'), snapshotForBattle(seat(false), 'B'), 42, { battleId: 'review-zephyr' });
  let state = quiet(createCombatWithEvents(input.preparation, input.strategy, input.battleId, input.battleSeed).state);
  const owner = state.units.find(u => u.team === 'player' && !u.anomalySummon)!;
  expect(owner.itemBanish?.untilTick).toBe(100);
  for (let i = 0; i < 100; i++) state = stepCombat(state).state;
  expect(state.tick).toBe(100);
  expect(state.units.find(u => u.id === owner.id)!.cell).toEqual({ col: 3, row: 7 });
  expect(state.units.filter(u => u.anomalySummon)).toHaveLength(suffix === 'WolfFamiliars' ? 2 : 3);
});
it.each(['WolfFamiliars', 'DeftHands'])('M3 %s cannot reserve the Cutlass return cell', suffix => {
  const state = itemAnomaly(suffix, 'TFT_Item_Artifact_SpectralCutlass');
  const units = structuredClone(state.units) as S13Unit[], owner = units.find(u => u.id === 'p')!;
  owner.cell = { col: 6, row: 0 };
  for (const proxy of units.filter(u => u.anomalySummon)) proxy.cell = { col: 3, row: 7 };
  const ctx: AbilityContext = { tick: 160, units, board: state.board, events: [], packets: [], heals: [], draw: () => { throw Error('No item RNG'); } };
  advanceSpectralCutlass(ctx);
  expect(owner.cell).toEqual({ col: 3, row: 7 });
});
it.each(['WolfFamiliars', 'DeftHands'])('M3 %s cannot reserve a Trench replacement landing', suffix => {
  let state = quiet(itemAnomaly(suffix, 'TFT_Item_Artifact_SuspiciousTrenchCoat'));
  state = { ...state, units: state.units.map(u => u.id === 'p' ? { ...u, hp: Math.floor(u.maxHp / 2) } : u) };
  const step = stepCombat(state), copies = step.state.units.filter(u => u.itemSummon?.kind === 'trench');
  expect(copies).toHaveLength(3);
  expect(copies.some(u => u.cell.col === 3 && u.cell.row === 7)).toBe(true);
});

it('M4 Mini Mees preserves redirected damage without reducing redirect-only Loris armor', () => {
  let state = quiet(startAnomaly('DeftHands', 'lux', [
    { id: 'guard', definitionId: 'loris', starLevel: 3, team: 'enemy', location: { kind: 'board', cell: { col: 2, row: 3 } } },
  ]));
  state = { ...state, units: state.units.map(u => u.id === 'e' ? { ...u, armor: 60 } : u.id === 'guard'
    ? { ...u, armor: 50, maxMana: 50, mana: 50 } : u) };
  for (let i = 0; i < 3; i++) state = stepCombat({ ...state, units: state.units.map(u => u.id === 'p' ? { ...u, cooldownTicks: 0 } : u) }).state;
  state = quiet(state);
  const redirected = [];
  for (let i = 0; i < 10; i++) {
    const step = stepCombat(state); state = step.state;
    redirected.push(...packets(step.events).filter(p => p.source.definitionId.endsWith('DeftHands') && p.redirected));
  }
  expect(redirected).toHaveLength(3);
  expect(redirected.every(p => p.unitId === 'guard' && p.hpDamage + p.absorbed > 0)).toBe(true);
  expect(readCombatStats(state.units.find(u => u.id === 'guard')!, state).armor).toBe(50);
  expect(readCombatStats(state.units.find(u => u.id === 'e')!, state).armor).toBe(45);
});

it('M5 orbit follows a real three-hex Fishbones attack target and falls back only when invalid', () => {
  let state = quiet(itemAnomaly('CenteroftheUniverse', 'TFT_Item_Artifact_Fishbones'));
  const far = startAnomaly('CenteroftheUniverse', 'lux', [
    { id: 'far', definitionId: 'garen', starLevel: 3, team: 'enemy', location: { kind: 'board', cell: { col: 6, row: 7 } } },
  ]).units.find(u => u.id === 'far')!;
  state = quiet({ ...state, units: [...state.units.map(u => u.id === 'e' ? { ...u, cell: { col: 3, row: 6 } } : u), far] });
  let selected = false;
  for (let i = 0; i < 20 && !selected; i++) {
    const step = stepCombat({ ...state, units: state.units.map(u => u.id === 'p' ? { ...u, cooldownTicks: 0 } : u) });
    state = step.state;
    selected = step.events.some(e => e.type === 'attack' && e.attackerId === 'p' && e.targetId === 'far');
  }
  expect(selected).toBe(true);
  const owner = state.units.find(u => u.id === 'p')!;
  expect(owner.targetId).toBe('far');
  expect(hexDistance(owner.cell, state.units.find(u => u.id === 'e')!.cell)).toBe(1);
  expect(hexDistance(owner.cell, far.cell)).toBe(3);
  const before = owner.anomalyState!.orbit!.radiusMilli;
  state = stepCombat(quiet(state)).state;
  const expanded = Math.min(3000, before + 250);
  expect(state.units.find(u => u.id === 'p')!.anomalyState!.orbit!.radiusMilli).toBe(expanded);
  const invalid = stepCombat({ ...state, units: state.units.map(u => u.id === 'p' ? { ...u, targetId: 'far' }
    : u.id === 'far' ? { ...u, anomalyState: { invisibleUntilTick: 100 } } : u) }).state;
  expect(invalid.units.find(u => u.id === 'p')!.anomalyState!.orbit!.radiusMilli).toBe(Math.max(1000, expanded - 250));
});
