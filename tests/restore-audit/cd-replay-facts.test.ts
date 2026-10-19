import { deepStrictEqual } from 'node:assert';
import { expect, it, vi } from 'vitest';
import * as engine from '../../src/simulation/combat';
import { restoreMatch, serializeMatch } from '../../src/simulation/serialization';
import { buyXp, deployMatchUnit, equipItem, startMatchCombat, stepMatch, type MatchState } from '../../src/simulation/match';
import type { CombatUnit } from '../../src/simulation/combat-types';
import { grantMechanicGold, grantMechanicItem, grantMechanicUnit } from '../../src/simulation/seat-mechanics';
import { g23Laboratories } from '../../src/simulation/g2-3-experiment';
import { readG23Progress } from '../../src/simulation/g2-3-state';
import { createRestoreCombatReplay } from '../../src/simulation/restore-combat-replay';
import { EMPTY_EXPANSION } from '../../src/simulation/combat-g2';
import { EMPTY_TRIGGER_LEDGER } from '../../src/simulation/m8/triggers';
import { accepted, battle, emptyBoard, reachRound } from '../match-helpers';
import { itemMatch } from '../fixtures/m8-b4-match';
import { configuredPrefix } from '../fixtures/t13-loot-public';

function positive(legal: MatchState) {
  const text = serializeMatch(legal);
  deepStrictEqual(restoreMatch(legal), legal);
  deepStrictEqual(restoreMatch(JSON.stringify(legal)), legal);
  deepStrictEqual(restoreMatch(text), legal);
  expect(stepMatch(restoreMatch(text))).toEqual(stepMatch(legal));
}
function reject(legal: MatchState, corrupt: (state: MatchState) => void, reason: string) {
  positive(legal);
  const bad = structuredClone(legal);
  corrupt(bad);
  expect(() => restoreMatch(bad)).toThrow(`Invalid Match save: ${reason}`);
  expect(() => restoreMatch(JSON.stringify(bad))).toThrow(`Invalid Match save: ${reason}`);
  expect(() => serializeMatch(bad)).toThrow(`Invalid Match save: ${reason}`);
}
function until(initial: MatchState, found: (s: MatchState) => boolean): MatchState {
  let state = initial;
  while (!found(state) && state.phase === 'combat') state = stepMatch(state).state;
  expect(found(state), `missing real checkpoint at tick ${state.combat!.tick}`).toBe(true);
  expect(state.phase).toBe('combat');
  return state;
}
const player = (s: MatchState) => s.combat!.units.find(u => u.team === 'player')!;
function roster(definitions: readonly string[], cells?: readonly { col: number; row: number }[]): MatchState {
  let state = emptyBoard(reachRound('2-1', true, 5));
  state = accepted(grantMechanicGold(state, { receiptId: 'cd-funding', source: 'test', amount: 200 }));
  while (state.level < definitions.length) state = accepted(buyXp(state));
  for (const [i, definitionId] of definitions.entries()) {
    state = accepted(grantMechanicUnit(state, { receiptId: `cd-${i}`, source: 'test', definitionId }));
    const u = state.preparation.units.find(u => u.definitionId === definitionId && u.team === 'player')!;
    state = accepted(deployMatchUnit(state, u.id, { kind: 'board', cell: cells?.[i] ?? { col: i * 2 + 1, row: 4 } }));
  }
  return accepted(startMatchCombat(state));
}
const emptyG23 = (u: CombatUnit): NonNullable<CombatUnit['g23']> => ({ ascension: null, conquestTakedowns: [], experimentTakedowns: [], cuts: {},
  stationaryTicks: 0, lastCell: { ...u.cell }, absorbed: [], highRoller: [] });

it.each(['processed', 'actionCounts'] as const)('G-C02 rejects invented %s keys on a holder without triggers', field => {
  const legal = battle();
  expect(player(legal).mechanismDefinitions!.eventTriggers ?? []).toHaveLength(0);
  reject(legal, s => Object.assign(player(s), { triggerLedger: { ...EMPTY_TRIGGER_LEDGER, [field]: { 'invented-event': 1 } } }), 'trigger ledger binding facts');
});

it.each(['attackCount', 'castCount'] as const)('G-C03 authenticates every unit %s even within the one-tick bound', field => {
  const legal = stepMatch(battle()).state;
  // Pick a zero-action unit so the forged total remains <= tick and passes all
  // old coefficient/bounds checks. Attack and cast counters have separate cases.
  const id = legal.combat!.units.find(u => u.runtime!.attackCount + u.runtime!.castCount === 0)!.id;
  reject(legal, s => Object.assign(s.combat!.units.find(u => u.id === id)!.runtime!, { [field]: 1 }), 'combat runtime binding facts');
});

it.each(['victim', 'holder', 'sequence'])('G-C04 binds the contribution map and trigger sequence: %s', kind => {
  reject(battle(), s => {
    if (kind === 'sequence') Object.assign(s.combat!, { nextTriggerEventSeq: 9e8 });
    else Object.assign(s.combat!, { damageContributors: kind === 'victim'
      ? { 'invented-victim': [player(s).id] } : { [s.combat!.units.find(u => u.team === 'enemy')!.id]: ['invented-holder'] } });
  }, kind === 'sequence' ? 'trigger event sequence binding facts' : 'damage contributors binding facts');
});

it.each(['rngState', 'rngDraws', 'nextActionSeq', 'nextEventSeq'] as const)('G-C04 binds the combat cursor: %s', field => {
  // Each drift stays a positive safe integer, so only the replayed cursor can tell it apart.
  const legal = until(battle(), s => s.combat!.tick >= 40);
  reject(legal, s => Object.assign(s.combat!, { [field]: s.combat![field]! + 1 }), 'combat cursor binding facts');
});

it('G-C05 binds a genuinely damaged ordinary shield even when both projections conserve the grant', () => {
  const legal = until(itemMatch('bloodthirster'), s => s.combat!.units.some(u => u.shieldLayers?.some(l => l.remaining > 0 && l.absorbed > 0)));
  reject(legal, s => {
    const u = s.combat!.units.find(u => u.shieldLayers?.some(l => l.remaining > 0 && l.absorbed > 0))!;
    const l = u.shieldLayers!.find(l => l.remaining > 0 && l.absorbed > 0)!;
    expect(l.m8Grant!.amount.resistsBps ?? 0).toBe(0);
    Object.assign(l, { remaining: l.remaining + 1, absorbed: l.absorbed - 1 });
    Object.assign(l.m8State!, { remaining: l.remaining, absorbed: l.absorbed });
    Object.assign(u, { shield: u.shield + 1 });
  }, 'shield binding facts');
});

it('G-C06 binds the real absorption value even when its status is forged coherently', async () => {
  let prep = await configuredPrefix('4-7', { build: 'cannon', seed: 42, anomalyDefinitionId: 'power-absorption' });
  const ownerId = prep.anomalyBinding!.unitId;
  expect(prep.anomalyBinding!.definitionId).toBe('power-absorption');
  prep = emptyBoard(prep);
  prep = accepted(deployMatchUnit(prep, ownerId, { kind: 'board', cell: { col: 3, row: 7 } }));
  prep = accepted(grantMechanicUnit(prep, { receiptId: 'cd-absorb-ally', source: 'test', definitionId: 'zyra' }));
  const allyId = prep.preparation.units.find(u => u.definitionId === 'zyra' && u.team === 'player')!.id;
  prep = accepted(deployMatchUnit(prep, allyId, { kind: 'board', cell: { col: 3, row: 4 } }));
  const legal = until(accepted(startMatchCombat(prep)), s => (s.combat!.units.find(u => u.id === ownerId)!.g23?.absorbed.length ?? 0) > 0);
  const owner = legal.combat!.units.find(u => u.id === ownerId)!;
  expect(owner.g23!.absorbed[0].value).toBeGreaterThan(0);
  reject(legal, s => {
    const u = s.combat!.units.find(u => u.id === ownerId)!;
    const receipt = u.g23!.absorbed[0]; receipt.value++;
    const c = u.mechanismState!.statuses.flatMap(g => g.contributions).find(c => c.source.definitionId === 'power-absorption' && c.source.instanceId.includes(receipt.unitId))!;
    const modifier = c.application.modifier!;
    Object.assign(modifier.value, { amount: receipt.value });
    for (const status of u.statuses ?? []) if (status.contributionKeys?.includes(c.key)) Object.assign(status, { amount: receipt.value });
  }, 'G23 absorption binding facts');
}, 60000);

it('G-C07 authenticates a live periodic fractional account', () => {
  const legal = until(itemMatch('sunfire-cape'), s => s.combat!.units.some(u => u.mechanismState?.periodicTasks.some(t => t.remainders.length > 0)));
  reject(legal, s => {
    const r = s.combat!.units.flatMap(u => u.mechanismState?.periodicTasks ?? []).flatMap(t => t.remainders)[0];
    Object.assign(r, { numerator: r.numerator === 1 ? 2 : 1 });
  }, 'periodic/burn binding facts');
});
it('G-C07 authenticates burn phase even when the group and task agree', () => {
  const legal = until(itemMatch('sunfire-cape'), s => s.combat!.units.some(u => u.mechanismState?.statuses.some(g => g.kind === 'burn')));
  reject(legal, s => {
    const u = s.combat!.units.find(u => u.mechanismState?.statuses.some(g => g.kind === 'burn'))!;
    const g = u.mechanismState!.statuses.find(g => g.kind === 'burn')!;
    Object.assign(g, { nextPulseAtTick: g.nextPulseAtTick! + 1 });
    for (const t of u.mechanismState!.periodicTasks.filter(t => g.contributions.some(c => c.key === t.key)))
      Object.assign(t, { nextPulseAtTick: g.nextPulseAtTick });
  }, 'periodic/burn binding facts');
});

it('G-C08 rejects invented Experiment takedowns plus matching maximum health', () => {
  const seed = readG23Progress(reachRound('2-1', true, 5))!.seed;
  const labs = g23Laboratories(seed, 'player', 3);
  const initial = roster(['drmundo', 'urgot', 'nunu'], [labs[0], labs[1], { col: 3, row: 4 }]);
  const eligible = (s: MatchState) => s.combat!.units.find(u => u.team === 'player' && u.mechanics?.some(m => m.mechanic === 'g23Experiment' && m.values.mundo > 0)
    && s.combat!.units.some(v => v.team === 'enemy' && !v.alive && !u.g23?.experimentTakedowns.includes(v.id)));
  const legal = until(initial, s => !!eligible(s));
  reject(legal, s => {
    const u = eligible(s)!, victim = s.combat!.units.find(v => v.team === 'enemy' && !v.alive && !u.g23?.experimentTakedowns.includes(v.id))!;
    const g23 = u.g23 ?? emptyG23(u); g23.experimentTakedowns.push(victim.id);
    const basis = { ...u.maxHpBasis!, flat: u.maxHpBasis!.flat + u.mechanics!.find(m => m.mechanic === 'g23Experiment')!.values.mundo };
    Object.assign(u, { g23, maxHpBasis: basis, maxHp: Math.floor((basis.base + basis.flat) * (10000 + basis.bps + basis.bonusBps) / 10000) });
  }, 'G23 state/maximum health binding facts');
});
it('G-C08 binds Sevika high-roller mod rather than only its enum', () => {
  const legal = until(roster(['sevika']), s => s.combat!.units.some(u => (u.g23?.highRoller.length ?? 0) > 0));
  reject(legal, s => {
    const roll = s.combat!.units.find(u => u.definitionId === 'sevika')!.g23!.highRoller[0];
    roll.mod = roll.enhanced ? (roll.mod === 'knockout-punch' ? 'quadruple-chomp' : 'knockout-punch') : (roll.mod === 'rocket' ? 'shield' : 'rocket');
    roll.gold = 0;
  }, 'G23 state/maximum health binding facts');
  // The schema correction is exact: even a sixth inert key remains forbidden.
  const extra = structuredClone(legal);
  Object.assign(extra.combat!.units.find(u => u.definitionId === 'sevika')!.g23!.highRoller[0], { invented: 0 });
  for (const input of [extra, JSON.stringify(extra)]) expect(() => restoreMatch(input)).toThrow('Invalid G23 combat state');
  expect(() => serializeMatch(extra)).toThrow('Invalid G23 combat state');
});
it.each(['duration', 'share'])('G-C09 binds the activity %s even with a matching legacy status', field => {
  const legal = until(roster(['loris']), s => s.combat!.units.some(u => u.mechanismState?.activities.some(a => a.kind === 'redirect' && a.lifecycle === 'active')));
  reject(legal, s => {
    const u = s.combat!.units.find(u => u.mechanismState?.activities.some(a => a.kind === 'redirect' && a.lifecycle === 'active'))!;
    const a = u.mechanismState!.activities.find(a => a.kind === 'redirect' && a.lifecycle === 'active')!;
    Object.assign(a, field === 'duration' ? { expiresAtTick: a.expiresAtTick + 1 } : { shareBps: a.kind === 'redirect' ? a.shareBps + 1 : 1 });
    for (const status of u.statuses!.filter(x => x.activity?.key === a.key))
      Object.assign(status, { activity: structuredClone(a), expiresAtTick: a.expiresAtTick, ...(a.kind === 'redirect' ? { amount: a.shareBps } : {}) });
  }, 'activity binding facts');
});
it.each(['exposureBps', 'exposureFromTick', 'exposureUntilTick'] as const)('P1-BOUNDS-01 binds %s at tick zero', field => {
  reject(battle(), s => Object.assign(player(s), { g22: { initialized: false, rebelTriggered: false, wanted: [], wantedDeaths: 0, mordeUntilTick: 0, reaveUntilTick: 0, reaveBps: 0, exposureFromTick: 0, exposureUntilTick: 0, exposureBps: 0, [field]: field === 'exposureBps' ? 10000 : 1 } }), 'exposure binding facts');
});
it.each(['damageDealt', 'damageTaken', 'crystalDamage'] as const)('P2-BOUNDS-02 binds %s at tick zero', field => {
  reject(battle(), s => Object.assign(player(s), { expansion: { ...EMPTY_EXPANSION, [field]: 99999999 } }), 'expansion damage binding facts');
});

it('shares one replay between all consumers and detaches the expanded facts on cache hits', () => {
  const legal = stepMatch(battle()).state, basis = legal.combatInputBasis!, strategy = legal.combat!.strategy!;
  const stepping = vi.spyOn(engine, 'stepCombat');
  try {
    const replay = createRestoreCombatReplay(basis, strategy, legal.combat!.tick);
    const first = replay.atSaveTick();
    expect(replay.atSaveTick()).toBe(first);
    const before = structuredClone(first);
    Object.assign(first.units[0].runtime!, { attackCount: 999 });
    Object.assign(first.units[0].activities, { 0: { invented: true } });
    const detached = createRestoreCombatReplay(basis, strategy, legal.combat!.tick).atSaveTick();
    expect(detached).toEqual(before);
    const calls = stepping.mock.calls.length;
    positive(legal);
    expect(stepping.mock.calls.length - calls).toBe(2); // positive()'s two next steps; restore itself never steps a second trajectory.
  } finally { stepping.mockRestore(); }
});


it('G-C03 rejects changing a real first-tick attack from one to zero', () => {
  const legal = stepMatch(roster(['tristana'], [{ col: 3, row: 4 }])).state;
  const id = legal.combat!.units.find(u => u.runtime!.attackCount === 1)!.id;
  reject(legal, s => Object.assign(s.combat!.units.find(u => u.id === id)!.runtime!, { attackCount: 0 }), 'combat runtime binding facts');
});
it('G-C03 rejects coherent Kogmaw cast/speed/range changes', () => {
  const legal = until(roster(['kogmaw']), s => s.combat!.units.some(u => u.definitionId === 'kogmaw' && u.runtime!.castCount > 0));
  reject(legal, s => {
    const u = s.combat!.units.find(u => u.definitionId === 'kogmaw')!, castCount = u.runtime!.castCount + 3;
    if (u.ability.kind !== 's13') throw Error('expected S13');
    Object.assign(u.runtime!, { castCount, attackSpeedBps: castCount * u.ability.variables.AttackSpeed,
      rangeBonus: Math.floor(castCount / (u.ability.variables.RangeIncreaseNumAttacks / 10000)) });
  }, 'combat runtime binding facts');
});
it('G-C03 rejects Tristana growth that remains within the cast-count upper bound', () => {
  const legal = until(roster(['tristana']), s => s.combat!.units.some(u => u.definitionId === 'tristana' && u.runtime!.castCount > 0));
  reject(legal, s => {
    const r = s.combat!.units.find(u => u.definitionId === 'tristana')!.runtime!;
    Object.assign(r, { permanentAdBps: r.permanentAdBps ? 0 : 125 });
  }, 'combat runtime binding facts');
});
it.each(['one-thousand-cuts', 'eagle-eye'])('G-C08 binds real %s history', async anomalyDefinitionId => {
  const prep = await configuredPrefix('4-7', { build: 'cannon', seed: 42, anomalyDefinitionId });
  const id = prep.anomalyBinding!.unitId;
  const legal = until(accepted(startMatchCombat(prep)), s => {
    const g = s.combat!.units.find(u => u.id === id)!.g23;
    return anomalyDefinitionId === 'eagle-eye' ? (g?.stationaryTicks ?? 0) > 1 : Object.values(g?.cuts ?? {}).some(n => n > 0);
  });
  reject(legal, s => {
    const g = s.combat!.units.find(u => u.id === id)!.g23!;
    if (anomalyDefinitionId === 'eagle-eye') g.stationaryTicks--;
    else g.cuts[Object.keys(g.cuts)[0]]--;
  }, 'G23 state/maximum health binding facts');
}, 60000);
it('G-C08 binds Swain ascension timing', () => {
  const legal = until(roster(['swain']), s => s.combat!.units.some(u => !!u.g23?.ascension));
  reject(legal, s => { s.combat!.units.find(u => u.g23?.ascension)!.g23!.ascension!.untilTick++; }, 'G23 state/maximum health binding facts');
});
it('G-C08 binds Conqueror receipts after an actual takedown', () => {
  const legal = until(roster(['darius', 'swain']), s => s.combat!.units.some(u => (u.g23?.conquestTakedowns.length ?? 0) > 0));
  reject(legal, s => { s.combat!.units.find(u => u.g23?.conquestTakedowns.length)!.g23!.conquestTakedowns.pop(); }, 'G23 state/maximum health binding facts');
});
it('resists shields, sampled holders and ordinary facts share the same cached trajectory', () => {
  let prep = reachRound('2-1', true, 5);
  prep = accepted(grantMechanicItem(prep, { receiptId: 'cd-shared-resists', source: 'test', definitionId: 'TFT_Item_Artifact_LightshieldCrest' }));
  prep = accepted(equipItem(prep, prep.items.at(-1)!.id, 'unit-1', 0));
  prep = accepted(deployMatchUnit(prep, 'unit-1', { kind: 'board', cell: { col: 1, row: 4 } }));
  let legal = accepted(startMatchCombat(prep));
  while (legal.combat!.tick < 60) legal = stepMatch(legal).state;
  const stepping = vi.spyOn(engine, 'stepCombat');
  try {
    // Cold authentication must step only the saved tick count, including the
    // resists validator; all subsequent entrances reuse the private trajectory.
    serializeMatch(legal);
    expect(stepping).toHaveBeenCalledTimes(60);
    positive(legal);
    expect(stepping).toHaveBeenCalledTimes(62);
  } finally { stepping.mockRestore(); }
});
