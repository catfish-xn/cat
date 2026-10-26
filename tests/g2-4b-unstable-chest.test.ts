import { prepareInput, copyInput } from './fixtures/prepared-input';
import { freezeContent } from '../src/simulation/content/freeze';
/** G2-4b Unstable Treasure Chest (user 2026-10-17, option A "完整原版"; conventions G24-CHEST-01…04 in
 * docs/evidence/g2-4/SUPPORT_ITEMS.md): pool, targeting, items gained mid-combat (stats, start effects, legacy
 * mechanic rewrites), restore validation of every mid-combat state, and two-sided/mirror determinism. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { readCombatStats } from '../src/simulation/combat-s13';
import { validateMechanisms } from '../src/simulation/m8/restore';
import { abilityPowerCandidates, attackDamageCandidates } from '../src/simulation/m8/item-restore';
import { mechanic, variable } from '../src/simulation/combat-s13-state';
import { compileItemCrit, validateItemProgram } from '../src/simulation/m8/item-program';
import { validateCombatItemGrants } from '../src/simulation/m8/combat-item-grants';
import { grantedItemPrograms } from '../src/simulation/m8/combat-item-programs';
import { restoreMatch, validateM5Runtime } from '../src/simulation/serialization';
import { canonicalContent } from '../src/simulation/content';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
import { G24_CHEST_POOL, G24_CHEST_PAYLOADS } from '../src/simulation/content/g2-4-chest-pool';
import { G24_SUPPORT_DECLARATIONS } from '../src/simulation/content/g2-4-support-items';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import {
  snapshotForBattle, compileBattle, restoreBattleInput, resolveTwoSidedBattle, startTwoSidedCombat, type MatchState,
} from '../src/server-entry';
import type { CombatEvent, CombatItemGrant, CombatState, CombatUnit } from '../src/simulation/combat-types';
import type { Unit } from '../src/simulation/unit-types';
import { itemMatch } from './fixtures/m8-b4-match';

const CHEST = 'TFT_Item_UnstableTreasureChest';
type Place = readonly [id: string, definitionId: string, col: number, row: number];
function combatOf(player: readonly Place[], enemy: readonly Place[], held: readonly (readonly [unitId: string, definitionId: string])[]): CombatState {
  const base = createMatch(42);
  const unit = (team: 'player' | 'enemy') => ([id, definitionId, col, row]: Place) => ({ id, definitionId, team, starLevel: 2 as const, location: { kind: 'board' as const, cell: { col, row } } });
  const preparation = { ...base.preparation, units: [...player.map(unit('player')), ...enemy.map(unit('enemy'))] };
  const items = held.map(([unitId, definitionId], i) => ({ id: `item-${i + 1}`, definitionId, location: { kind: 'unit' as const, unitId, slot: held.slice(0, i).filter(h => h[0] === unitId).length } }));
  const state = { ...base, level: 9, items, preparation };
  return createCombatWithEvents(preparation, buildStrategySnapshot(state), 'g24-chest').state;
}
/** The chest holder stands next to one active enemy with 1 HP; every ally waits, at the health ratio given. */
const ALLIES: Place[] = [['p1', 'lux', 0, 7], ['p2', 'ezreal', 1, 7], ['p3', 'heimerdinger', 2, 7], ['p4', 'garen', 4, 7], ['p5', 'lux', 5, 7], ['p6', 'vi', 6, 7]];
const RATIO_BPS: Record<string, number> = { p1: 7000, p2: 9000, p3: 8000, p4: 3000, p5: 7000, p6: 10000 };
const chestInputs = new Map<string, CombatState>();
afterAll(() => { chestInputs.clear(); });
function chestFight(rngState?: number, held: readonly (readonly [string, string])[] = []): CombatState {
  const key = JSON.stringify(held);
  let input = chestInputs.get(key);
  if (!input) {
    input = prepareInput(combatOf([['holder', 'leona', 3, 4], ...ALLIES], [['foe', 'garen', 3, 3]], [['holder', CHEST], ...held]));
    chestInputs.set(key, input);
  }
  const combat = copyInput(input);
  return { ...combat, ...(rngState === undefined ? {} : { rngState }), units: combat.units.map(u =>
    u.id === 'holder' ? { ...u, hp: 1, cooldownTicks: 100000, moveCooldownTicks: 100000 }
    : u.team === 'player' ? { ...u, hp: Math.floor(u.maxHp * RATIO_BPS[u.id] / 10000), cooldownTicks: 100000, moveCooldownTicks: 100000 } : u) };
}
/** Every check the Match restore runs on the item side of a saved combat unit. */
function validate(state: CombatState): void {
  const parsed = JSON.parse(JSON.stringify(state)) as CombatState;
  for (const unit of parsed.units) {
    validateMechanisms(unit, parsed.units, parsed.tick, parsed.combatId!, parsed.status === 'finished', parsed.nextActionSeq!, new Set(), true);
    if (unit.itemPrograms?.length || unit.combatItemGrants?.length) expect(unit.spellCrit).toEqual(compileItemCrit(unit));
  }
  validateCombatItemGrants(parsed.units, parsed.tick, unit => unit.mechanismDefinitions?.eventTriggers ?? []);
}
interface Granted { readonly before: CombatState; readonly after: CombatState; readonly events: readonly CombatEvent[] }
function untilGranted(combat: CombatState, each = false): Granted {
  let state = combat;
  for (let i = 0; i < 400 && state.status === 'running'; i++) {
    const step = stepCombat(state);
    if (each) validate(step.state);
    if (step.events.some(e => e.type === 'combatItemGranted')) return { before: state, after: step.state, events: step.events };
    state = step.state;
  }
  throw new Error('Chest never opened');
}
// Genuine grant entrances shared by the two full-pool tests. Never cache a
// validation decision: each test checks its own subsequent states and stats.
const seededGrants = new Map<number, Granted>();
function seededChestGrant(seed: number): Granted {
  let input = seededGrants.get(seed);
  if (!input) { input = prepareInput(untilGranted(chestFight(seed * 7919))); seededGrants.set(seed, input); }
  return input;
}
const unitOf = (state: CombatState, id: string) => state.units.find(u => u.id === id)!;
const grantsOf = (state: CombatState) => state.units.flatMap(u => (u.combatItemGrants ?? []).map(g => ({ unitId: u.id, ...g })));

describe('G2-4b chest content', () => {
  it('pools the 35 ordinary completed items except Thief\'s Gloves, in apiName order, each as a valid program', () => {
    const expected = Object.values(ITEM_DEFINITIONS).filter(i => i.kind === 'completed' && i.id !== 'thiefs-gloves').map(i => i.apiName!).sort();
    expect(G24_CHEST_POOL.map(p => ITEM_DEFINITIONS[p.definitionId].apiName)).toEqual(expected);
    expect(G24_CHEST_POOL).toHaveLength(35);
    expect(G24_CHEST_PAYLOADS['thiefs-gloves']).toBeUndefined();
    for (const payload of G24_CHEST_POOL) expect(() => validateItemProgram(payload.program)).not.toThrow();
  });
  it('rewrites legacy mechanic tags and strategy stats into declarative programs (G24-CHEST-04)', () => {
    const p = G24_CHEST_PAYLOADS;
    expect(p.warmog.maxHpFlat + p.warmog.maxHpBps).toBeGreaterThan(0);
    expect(p['blue-buff'].initialMana).toBeGreaterThan(0);
    const growth = (program: (typeof p)[string]['program'], stat: string) => [...(program.triggers ?? []).flatMap(d => d.effects), ...(program.periodic ?? []).flatMap(d => d.program.effects)]
      .some(e => e.kind === 'modify-stat' && e.modifier.stat === stat && e.stackPolicy.kind === 'add-stacks' && e.stackPolicy.cap === 100000);
    const rageblade = Object.values(p).find(x => ITEM_DEFINITIONS[x.definitionId].effects.some(e => e.kind === 'mechanic' && e.mechanic === 'rageblade'))!;
    const archangel = Object.values(p).find(x => ITEM_DEFINITIONS[x.definitionId].effects.some(e => e.kind === 'mechanic' && e.mechanic === 'archangel'))!;
    expect(growth(rageblade.program, 'attackSpeed')).toBe(true);
    expect(growth(archangel.program, 'abilityPower')).toBe(true);
    const tagged = (mechanic: string) => Object.values(p).filter(x => ITEM_DEFINITIONS[x.definitionId].effects.some(e => e.kind === 'mechanic' && e.mechanic === mechanic));
    for (const x of tagged('damageAmp')) expect(x.program.modifiers?.some(m => m.stat === 'damageAmp')).toBe(true);
    for (const x of tagged('extraAttackMana')) expect(x.program.triggers?.some(t => t.effects.some(e => e.kind === 'grant-mana'))).toBe(true);
    for (const x of tagged('dragonClaw')) expect(x.program.periodic?.some(t => t.program.effects.some(e => e.kind === 'heal'))).toBe(true);
    for (const x of tagged('gargoyle')) expect(x.program.modifiers?.filter(m => m.value.kind === 'unit-count').map(m => m.stat).sort()).toEqual(['armor', 'magicResist']);
    for (const x of tagged('gunblade')) expect(x.program.vamp?.length).toBeGreaterThan(0);
    for (const x of G24_CHEST_POOL) expect(x.program.effects?.some(e => e.kind === 'temporary-equipment') ?? false).toBe(false);
  });
  it('declares one holder-death grant to four allies ordered by health ratio then id', () => {
    const [trigger] = G24_SUPPORT_DECLARATIONS[CHEST].holder!.triggers!;
    expect(trigger).toMatchObject({ event: 'holder-death', maxPerCombat: 1, effects: [{ kind: 'grant-combat-item', policyId: 'G24-CHEST-01', lifetime: 'combat' }] });
    expect(trigger.selector).toMatchObject({ relation: 'ally', excludeSelf: true, maxTargets: 4, order: 'hp-ratio-desc-id', excludeSummons: true });
  });
});

// Reconstruct the original first-occurrence selection from immutable inputs.
// Earlier cases need not have passed (or even run) to select a later segment.
function poolInputs(lastSeed: number) {
  const seen = new Set<string>();
  const inputs: { seed: number; granted: Granted; fresh: ReturnType<typeof grantsOf> }[] = [];
  for (let seed = 1; seen.size < G24_CHEST_POOL.length && seed <= lastSeed && seed < 400; seed++) {
    const granted = seededChestGrant(seed);
    const fresh = grantsOf(granted.after).filter(g => !seen.has(g.definitionId));
    fresh.forEach(g => seen.add(g.definitionId));
    if (fresh.length) inputs.push({ seed, granted, fresh });
  }
  return { inputs, seen };
}
const poolSegments = Array.from({ length: 80 }, (_, i) => [i * 5 + 1, Math.min(i * 5 + 5, 399)] as const);

describe('G2-4b chest in combat', () => {
  it('the four healthiest allies by ratio each gain one item when the holder dies; ties break by id; full units still receive', () => {
    const { before, after, events } = untilGranted(chestFight(undefined, [['p6', 'warmog'], ['p6', 'dragons-claw'], ['p6', 'gargoyle']]), true);
    expect(unitOf(after, 'holder').alive).toBe(false);
    const grants = grantsOf(after);
    expect(grants.map(g => g.unitId).sort()).toEqual(['p1', 'p2', 'p3', 'p6']);
    expect(grants.map(g => g.ordinal).sort()).toEqual([0, 1, 2, 3]);
    expect(new Set(grants.map(g => g.grantedAtTick))).toEqual(new Set([after.tick]));
    expect(grants.every(g => Object.hasOwn(G24_CHEST_PAYLOADS, g.definitionId))).toBe(true);
    expect(events.filter(e => e.type === 'combatItemGranted').map(e => e.type === 'combatItemGranted' && [e.unitId, e.definitionId]))
      .toEqual(grants.sort((a, b) => a.ordinal - b.ordinal).map(g => [g.unitId, g.definitionId]));
    expect(after.rngDraws! - before.rngDraws!).toBeGreaterThanOrEqual(4);
    // The static programs never change; the grant is the only new fact, and the item does not take an inventory slot.
    for (const unit of after.units) expect(unit.itemPrograms).toEqual(unitOf(before, unit.id).itemPrograms);
    expect(grantedItemPrograms(unitOf(after, 'p6'))).toHaveLength(1);
    // Same input, same items.
    expect(grantsOf(untilGranted(chestFight(undefined, [['p6', 'warmog'], ['p6', 'dragons-claw'], ['p6', 'gargoyle']])).after)).toEqual(grantsOf(after));
  });

  it('summons and structures never receive an item (user 2026-10-17 06:25); the next healthiest champion does', () => {
    const allies: Place[] = [['pj', 'jayce', 0, 7], ['p1', 'lux', 1, 7], ['p2', 'ezreal', 2, 7], ['p3', 'garen', 4, 7], ['p4', 'vi', 5, 7], ['p5', 'heimerdinger', 6, 7]];
    const combat = combatOf([['holder', 'leona', 3, 4], ...allies], [['foe', 'garen', 3, 3]], [['holder', CHEST]]);
    const forge = combat.units.find(u => u.definitionId === 'g23-forge')!;
    expect(forge?.team).toBe('player');
    // Champions at 50–90%, the forge untouched at 100%: without the rule it would rank first.
    const ratio: Record<string, number> = { pj: 9000, p1: 8000, p2: 7000, p3: 6000, p4: 5000, p5: 4000 };
    const start: CombatState = { ...combat, units: combat.units.map(u => u.id === 'holder' ? { ...u, hp: 1, cooldownTicks: 100000, moveCooldownTicks: 100000 }
      : u.team === 'player' ? { ...u, ...(ratio[u.id] ? { hp: Math.floor(u.maxHp * ratio[u.id] / 10000) } : {}), cooldownTicks: 100000, moveCooldownTicks: 100000 } : u) };
    const { after } = untilGranted(start, true);
    expect(unitOf(after, forge.id).alive).toBe(true);
    expect(grantsOf(after).map(g => g.unitId).sort()).toEqual(['p1', 'p2', 'p3', 'pj']);
    // A save that hands the forge an item is refused.
    const forged = structuredClone(after.units) as CombatUnit[];
    const moved = forged.find(u => u.id === 'p3')! as { combatItemGrants?: CombatUnit['combatItemGrants'] };
    (forged.find(u => u.id === forge.id)! as { combatItemGrants?: CombatUnit['combatItemGrants'] }).combatItemGrants = moved.combatItemGrants; moved.combatItemGrants = undefined;
    expect(() => validateCombatItemGrants(forged, after.tick, u => u.mechanismDefinitions?.eventTriggers ?? [])).toThrow('Invalid Match save: combat item summon receiver');
  });

  it.each(poolSegments)('every pool item gained mid-combat: stats, start effects and restore (seeds %i-%i)', (firstSeed, lastSeed) => {
    const { inputs, seen } = poolInputs(lastSeed);
    for (const { granted, fresh } of inputs.filter(input => input.seed >= firstSeed)) {
      for (const grant of fresh) {
        seen.add(grant.definitionId);
        const item = ITEM_DEFINITIONS[grant.definitionId], payload = G24_CHEST_PAYLOADS[grant.definitionId];
        const was = unitOf(granted.before, grant.unitId), now = unitOf(granted.after, grant.unitId);
        const statsWas = readCombatStats(was, granted.before), statsNow = readCombatStats(now, granted.after);
        const flat = (stat: string) => item.effects.reduce((n, e) => n + (e.kind === 'statFlat' && e.stat === stat ? e.amount : 0), 0);
        const label = `${grant.definitionId} → ${grant.unitId}`;
        if (payload.maxHpFlat || payload.maxHpBps) { expect(now.maxHp - was.maxHp, label).toBeGreaterThanOrEqual(payload.maxHpFlat); expect(now.hp, label).toBeGreaterThan(was.hp); }
        if (flat('abilityPower')) expect(statsNow.abilityPower - statsWas.abilityPower, label).toBeGreaterThanOrEqual(flat('abilityPower'));
        if (flat('armor')) expect(statsNow.armor - statsWas.armor, label).toBeGreaterThanOrEqual(flat('armor'));
        if (flat('magicResist')) expect(statsNow.magicResist - statsWas.magicResist, label).toBeGreaterThanOrEqual(flat('magicResist'));
        if (item.effects.some(e => (e.kind === 'statPercentBps' || e.kind === 'statFlat') && e.stat === 'attackDamage')) expect(statsNow.attackDamage, label).toBeGreaterThan(statsWas.attackDamage);
        if (item.effects.some(e => e.kind === 'attackSpeedBps')) expect(statsNow.attackIntervalTicks, label).toBeLessThan(statsWas.attackIntervalTicks);
        if (payload.initialMana) expect(now.mana - was.mana, label).toBe(Math.min(payload.initialMana, now.maxMana - was.mana));
        if (payload.program.effects?.some(e => e.kind === 'grant-shield')) expect(now.shield, label).toBeGreaterThan(was.shield);
        // Its compiled mechanisms join the receiver like a combat-start item would.
        const own = (s: { instanceId: string }) => grantedItemPrograms(now).some(b => b.source.instanceId === s.instanceId);
        expect(now.mechanismDefinitions!.periodicTasks.filter(t => own(t.source)).length, label).toBe(payload.program.periodic?.length ?? 0);
      }
      let state = granted.after;
      for (let i = 0; i < 120 && state.status === 'running'; i++) { state = stepCombat(state).state; validate(state); }
    }
    if (lastSeed === 399) expect([...seen].sort()).toEqual(G24_CHEST_POOL.map(p => p.definitionId).sort());
  });

  it('granted periodic and stacking items keep working after the grant', () => {
    let found: { state: CombatState; unitId: string; id: string } | undefined;
    const wanted = new Set(['archangels-staff', 'dragons-claw']);
    for (let seed = 1; !found && seed < 400; seed++) {
      const { after } = seededChestGrant(seed);
      const g = grantsOf(after).find(x => wanted.has(x.definitionId) || ITEM_DEFINITIONS[x.definitionId].effects.some(e => e.kind === 'mechanic' && (e.mechanic === 'archangel' || e.mechanic === 'dragonClaw')));
      if (g) found = { state: after, unitId: g.unitId, id: g.definitionId };
    }
    expect(found).toBeDefined();
    const { state: start, unitId } = found!, program = G24_CHEST_PAYLOADS[found!.id].program, period = program.periodic![0].periodTicks;
    let state = start, events: CombatEvent[] = [];
    for (let i = 0; i < period + 2 && state.status === 'running'; i++) { const step = stepCombat(state); state = step.state; events.push(...step.events); }
    const pulses = unitOf(state, unitId).mechanismState!.periodicTasks.filter(t => grantedItemPrograms(unitOf(state, unitId)).some(b => b.source.instanceId === t.source.instanceId));
    expect(pulses.length).toBeGreaterThan(0);
    expect(pulses.every(t => t.pulseOrdinal >= 1), 'first pulse lands one period after the grant').toBe(true);
    validate(state);
  });

  it('a mid-combat JSON save continues to the identical terminal state and ledger', () => {
    const fight = chestFight(77);
    const { after } = untilGranted(fight);
    const finish = (from: CombatState) => { let s = from; const events: CombatEvent[] = []; while (s.status === 'running') { const step = stepCombat(s); s = step.state; events.push(...step.events); } return { s, events }; };
    const live = finish(after), restored = finish(JSON.parse(JSON.stringify(after)) as CombatState);
    expect(restored.s).toEqual(live.s);
    expect(restored.events).toEqual(live.events);
  });
});

describe('G2-4b chest restore candidates (sampled stats)', () => {
  const idle = (u: CombatUnit): CombatUnit => ({ ...u, cooldownTicks: 100000, moveCooldownTicks: 100000 });
  function sampledFight(champion: string, chests = 1, titans = 0, ally = false): CombatState {
    const state = combatOf([['holder', 'leona', 3, 4], ['caster', champion, 0, 7], ...(ally ? [['z-ally', 'irelia', 6, 7] as Place] : [])], [['foe', 'garen', 3, 3]],
      [...Array.from({ length: chests }, () => ['holder', CHEST] as const), ...Array.from({ length: titans }, () => ['caster', 'titans-resolve'] as const)]);
    return { ...state, units: state.units.map(u => u.id === 'holder' ? { ...idle(u), hp: 1 } : u.id === 'caster' ? idle(u) : u) };
  }
  function waitForPulses(state: CombatState, ticks: number): CombatState {
    state = { ...state, units: state.units.map(idle) };
    for (let i = 0; i < ticks; i++) state = stepCombat(state).state;
    return state;
  }
  function castNow(state: CombatState): CombatState {
    return stepCombat({ ...state, units: state.units.map(u => u.id === 'caster' ? { ...u, mana: u.maxMana, cooldownTicks: 0 } : u) }).state;
  }
  function expectSampledRestore(state: CombatState, field: 'nextAttackMagic' | 'nextAttackPhysical', damage: number): void {
    validate(state);
    const parsed = JSON.parse(JSON.stringify(state)) as CombatState, caster = unitOf(parsed, 'caster');
    expect(caster.runtime![field]).toBe(damage);
    // Call the production Match unit validator, including its cast-time stat check.
    const check = (unit: CombatUnit) => validateM5Runtime(unit, parsed.tick, new Set(parsed.units.map(u => u.id)), parsed.units,
      parsed.combatId!, new Set(), (a, b) => canonicalContent(a) === canonicalContent(b), parsed.nextActionSeq!);
    expect(() => check(caster)).not.toThrow();
    expect(() => check({ ...caster, runtime: { ...caster.runtime!, [field]: damage + 1 } }))
      .toThrow(`Invalid Match save: derived empowered ${field === 'nextAttackMagic' ? 'magic' : 'physical'}`);
  }
  // v22 AD star scaling: 2-star Garen AD is floor(65*1.5)=97 (v21 floor(65*1.8)=117). Three 97-AD hits (102 each after
  // armor) no longer break Lux's 324 self-shield before it expires, so the caster would outlive the 100-tick window. The
  // foe keeps its v21 117 AD (about 123 per hit, 3 hits > 324 + 1 HP) so Lux still dies inside the same window.
  function killCaster(state: CombatState): CombatState {
    state = { ...state, units: state.units.map(u => u.id === 'foe' ? { ...u, cell: { col: 0, row: 6 }, cooldownTicks: 0, moveCooldownTicks: 0, attackDamage: 117, attackDamageBase: 117 }
      : u.id === 'caster' ? { ...idle(u), hp: 1 } : idle(u)) };
    for (let i = 0; i < 100 && unitOf(state, 'caster').alive; i++) state = stepCombat(state).state;
    expect(unitOf(state, 'caster').alive).toBe(false);
    expect(state.status).toBe('running');
    expect(unitOf(state, 'caster').mechanismState!.periodicTasks).toEqual([]);
    return state;
  }
  function expectRestoredContinuation(state: CombatState): void {
    const restored = JSON.parse(JSON.stringify(state)) as CombatState;
    validate(restored);
    for (const unit of restored.units) validateM5Runtime(unit, restored.tick, new Set(restored.units.map(u => u.id)), restored.units,
      restored.combatId!, new Set(), (a, b) => canonicalContent(a) === canonicalContent(b), restored.nextActionSeq!);
    const finish = (from: CombatState) => {
      const events: CombatEvent[] = [];
      while (from.status === 'running') { const step = stepCombat(from); from = step.state; events.push(...step.events); }
      return { state: from, events };
    };
    expect(finish(restored)).toEqual(finish(state));
  }

  it('M1: Lux casts after receiving Nashor, accepts 594 magic damage and rejects 595', () => {
    const { after } = untilGranted({ ...sampledFight('lux'), rngState: 328 });
    expect(unitOf(after, 'caster').combatItemGrants!.map(g => g.definitionId)).toEqual(['nashors-tooth']);
    const state = castNow(waitForPulses(after, 0));
    expect(abilityPowerCandidates(unitOf(state, 'caster'), 0, state.combatId!)).toEqual(new Set([100, 110]));
    expectSampledRestore(state, 'nextAttackMagic', 594);
  });

  it('M1: Lux casts at two Archangel pulses, accepts 972 magic damage and rejects 973', () => {
    const { after } = untilGranted({ ...sampledFight('lux'), rngState: 64 });
    expect(unitOf(after, 'caster').combatItemGrants!.map(g => g.definitionId)).toEqual(['archangel']);
    const state = castNow(waitForPulses(after, 200)), caster = unitOf(state, 'caster');
    expect(caster.mechanismState!.periodicTasks.map(t => t.pulseOrdinal)).toEqual([2]);
    expect(abilityPowerCandidates(caster, 0, state.combatId!)).toEqual(new Set([100, 120, 130, 150, 160, 180]));
    expectSampledRestore(state, 'nextAttackMagic', 972);
  });

  it('M1: Vander casts before Shojin arrives, accepts the old 450 physical damage and rejects 451', () => {
    // v22 AD star scaling 1/1.5/2.25: 2-star Vander AD floor(50*1.5)=75 (was floor(50*1.8)=90). The empowered strike is
    // AD x (PercentAttackDamage 4.0 + BonusDamageADRatio 1.0 per 1/2-cost ally: Leona, Vander = 2) = 75*6 = 450 (was 540).
    const fight = sampledFight('vander');
    const cast = castNow({ ...fight, units: fight.units.map(idle) });
    expect(unitOf(cast, 'caster').runtime!.nextAttackPhysical).toBe(450);
    expect(unitOf(cast, 'caster').combatItemGrants).toBeUndefined();
    const { after } = untilGranted({ ...cast, rngState: 317, units: cast.units.map(u => u.id === 'foe' ? { ...u, cooldownTicks: 0 } : idle(u)) });
    const caster = unitOf(after, 'caster');
    expect(caster.combatItemGrants!.map(g => g.definitionId)).toEqual(['shojin']);
    // Candidates: naked 2-star AD 75, or with the granted Shojin's +15% AD floor(75*1.15)=86 (v21: 90 / floor(90*1.15)=103).
    expect(attackDamageCandidates(caster, after.tick, after.combatId!)).toEqual(new Set([75, 86]));
    expectSampledRestore(after, 'nextAttackPhysical', 450);
  });

  it('M2: Lux dies after casting at two granted Archangel pulses; 972 magic restores and continues identically', () => {
    const { after } = untilGranted({ ...sampledFight('lux', 1, 0, true), rngState: 64 });
    expect(unitOf(after, 'caster').combatItemGrants!.map(g => g.definitionId)).toEqual(['archangel']);
    const cast = castNow(waitForPulses(after, 200));
    expect(unitOf(cast, 'caster').mechanismState!.periodicTasks.map(t => t.pulseOrdinal)).toEqual([2]);
    const state = killCaster(cast);
    expectSampledRestore(state, 'nextAttackMagic', 972);
    expectRestoredContinuation(state);
  });

  it('M2: Lux shields Irelia after two granted Archangel pulses, then dies; the ally shield restores and continues identically', () => {
    const { after } = untilGranted({ ...sampledFight('lux', 1, 0, true), rngState: 64 });
    const ready = waitForPulses(after, 200);
    const cast = castNow({ ...ready, units: ready.units.map(u => u.id === 'z-ally' ? { ...u, hp: 300 } : u) });
    const shield = unitOf(cast, 'z-ally').shieldLayers!.find(s => s.source.ownerId === 'caster')!;
    expect(shield).toBeDefined();
    const state = killCaster(cast);
    expect(unitOf(state, 'z-ally').shieldLayers).toContainEqual(shield);
    expectSampledRestore(state, 'nextAttackMagic', 972);
    expectRestoredContinuation(state);
  });

  it('granted periodic candidates stay bounded by the save clock even without live tasks or a known sample tick', () => {
    const { after } = untilGranted({ ...sampledFight('lux'), rngState: 64 });
    const state = castNow(waitForPulses(after, 200)), caster = unitOf(state, 'caster');
    const withoutTasks = { ...caster, mechanismState: { ...caster.mechanismState!, periodicTasks: [] } };
    const firstPulse = caster.mechanismDefinitions!.periodicTasks[0].nextPulseAtTick;
    expect(abilityPowerCandidates(withoutTasks, firstPulse - 1, state.combatId!)).toEqual(new Set([100, 120]));
    expect(abilityPowerCandidates(withoutTasks, firstPulse, state.combatId!)).toEqual(new Set([100, 120, 130, 150]));
    const expected = new Set([100, 120, 130, 150, 160, 180]);
    expect(abilityPowerCandidates(withoutTasks, 0, state.combatId!)).toEqual(expected);
    expect(abilityPowerCandidates(withoutTasks, Number.MAX_SAFE_INTEGER, state.combatId!)).toEqual(expected);
    for (const sampledAtTick of [-1, 0.5, 1201, 5_000_000, Number.MAX_SAFE_INTEGER]) {
      expect(() => abilityPowerCandidates({ ...withoutTasks, mechanismState: { ...withoutTasks.mechanismState, sampledAtTick } }, 0, state.combatId!))
        .toThrow('Invalid sampled periodic clock');
    }
  });

  it('three Titans plus three granted Archangels restore after eight pulses without expanding 102 million histories', () => {
    const { after } = untilGranted({ ...sampledFight('lux', 3, 3), rngState: 52931 });
    expect(unitOf(after, 'caster').combatItemGrants!.map(g => g.definitionId)).toEqual(['archangel', 'archangel', 'archangel']);
    const state = castNow(waitForPulses(after, 800)), caster = unitOf(state, 'caster');
    expect(state.tick).toBe(802);
    expect(caster.mechanismState!.periodicTasks.map(t => t.pulseOrdinal)).toEqual([8, 8, 8]);
    // 100 base + 0…150 Titan AP (step 2) + 0…60 granted base AP (step 20)
    // + 0…720 pulse AP (step 30): exactly every even value from 100 to 1030.
    expect(abilityPowerCandidates(caster, 0, state.combatId!)).toEqual(new Set(Array.from({ length: 466 }, (_, i) => 100 + 2 * i)));
    expectSampledRestore(state, 'nextAttackMagic', 4752);
  });

  it.each(poolSegments)('every AP and AD a receiver had since the grant is among restore candidates (seeds %i-%i)', (firstSeed, lastSeed) => {
    const { inputs, seen } = poolInputs(lastSeed);
    for (const { granted: { before, after }, fresh: receivers } of inputs.filter(input => input.seed >= firstSeed)) {
      const history = new Map<string, { tick: number; ap: number; ad: number }[]>(receivers.map(g => [g.unitId, []]));
      const sample = (state: CombatState) => { for (const g of receivers) { const u = unitOf(state, g.unitId), s = readCombatStats(u, state); history.get(g.unitId)!.push({ tick: state.tick, ap: s.abilityPower, ad: s.attackDamage }); } };
      sample(before); sample(after);
      let state = after;
      for (let i = 0; i < 250 && state.status === 'running'; i++) { state = stepCombat(state).state; if (state.tick % 10 === 0) sample(state); }
      const parsed = JSON.parse(JSON.stringify(state)) as CombatState;
      for (const g of receivers) {
        const u = unitOf(parsed, g.unitId), label = `${g.definitionId} → ${g.unitId}`;
        const unknownTime = abilityPowerCandidates(u, 0, parsed.combatId!), adNow = attackDamageCandidates(u, parsed.tick, parsed.combatId!);
        for (const h of history.get(g.unitId)!) {
          expect(unknownTime.has(h.ap), `${label} AP ${h.ap} @${h.tick} (sample tick unknown)`).toBe(true);
          if (h.tick > 0) expect(abilityPowerCandidates(u, h.tick, parsed.combatId!).has(h.ap), `${label} AP ${h.ap} @${h.tick}`).toBe(true);
          expect(adNow.has(h.ad), `${label} AD ${h.ad} @${h.tick}`).toBe(true);
        }
      }
    }
    if (lastSeed === 399) expect(seen.size).toBe(G24_CHEST_POOL.length);
  });

  let receiverInput: CombatState | undefined;
  beforeAll(() => {
    const casters: Place[] = [['c1', 'lux', 0, 7], ['c2', 'irelia', 2, 6], ['c3', 'vander', 4, 6], ['c4', 'lux', 6, 7]];
    receiverInput = prepareInput(combatOf([['holder', 'leona', 3, 4], ...casters], [['foe', 'garen', 3, 3], ['foe2', 'vi', 1, 1]], [['holder', CHEST]]));
  });
  afterAll(() => { receiverInput = undefined; });

  // Cache complete read-only live trajectories, not their validation results.
  const receiverTrajectories = new Map<number, readonly CombatState[]>();
  function receiverStates(seed: number): readonly CombatState[] {
    const cached = receiverTrajectories.get(seed); if (cached) return cached;
      const combat = copyInput(receiverInput!);
      const start: CombatState = { ...combat, rngState: seed * 104729, units: combat.units.map(u => u.id === 'holder' ? { ...u, hp: 1, cooldownTicks: 100000, moveCooldownTicks: 100000 }
        : u.team === 'player' ? { ...u, cooldownTicks: 100000, moveCooldownTicks: 100000 } : u) };
      const { after } = untilGranted(start);
      // Wake the receivers, nearly full of mana, so they cast with the item they just gained.
      let state: CombatState = { ...after, units: after.units.map(u => u.team === 'player' && u.alive ? { ...u, cooldownTicks: 0, moveCooldownTicks: 0, mana: Math.max(u.mana, u.maxMana - 1) } : u) };
      const states: CombatState[] = [];
      for (let i = 0; i < 300 && state.status === 'running'; i++) {
        state = stepCombat(state).state; states.push(state);
      }
      const input = freezeContent(states); receiverTrajectories.set(seed, input); return input;
  }
  it.each(Array.from({ length: 12 }, (_, i) => i + 1))('receivers that attack and cast keep every mid-combat save valid (seed %i)', seed => {
      for (const state of receiverStates(seed)) {
        validate(state);
        const parsed = JSON.parse(JSON.stringify(state)) as CombatState;
        for (const u of parsed.units.filter(x => x.combatItemGrants?.length)) {
          // The Match restore's checks of cast-time stats (serialization.ts: derived empowered magic / physical).
          if (u.runtime!.nextAttackMagic > 0) { expect([...abilityPowerCandidates(u, 0, parsed.combatId!)].some(ap => Math.floor(ap * variable(u, 'Damage') / 100) === u.runtime!.nextAttackMagic), `${u.id} magic @${parsed.tick}`).toBe(true); }
          if (u.runtime!.nextAttackPhysical > 0) {
            const coefficient = variable(u, 'PercentAttackDamage') + variable(u, 'BonusDamageADRatio') * mechanic(u, 'lowCostAllies', 'count');
            expect([...attackDamageCandidates(u, parsed.tick, parsed.combatId!)].some(ad => u.runtime!.nextAttackPhysical === Math.floor(ad * Math.round(coefficient * 10000) / 10000)), `${u.id} physical @${parsed.tick}`).toBe(true);
          }
        }
      }
  });
  it('receivers exercise both empowered magic and physical attacks after the grant', () => {
    let magic = 0, physical = 0;
    for (let seed = 1; seed <= 12; seed++) for (const state of receiverStates(seed))
      for (const u of state.units.filter(x => x.combatItemGrants?.length)) {
        if (u.runtime!.nextAttackMagic > 0) magic++;
        if (u.runtime!.nextAttackPhysical > 0) physical++;
      }
    expect(magic).toBeGreaterThan(0);
    expect(physical).toBeGreaterThan(0);
  });
});

describe('G2-4b chest restore rejects forged grants', () => {
  beforeAll(() => { itemMatch('warmog'); });
  const opened = untilGranted(chestFight(5)).after;
  type Writable<T> = { -readonly [K in keyof T]: T[K] };
  type ForgedGrant = Writable<CombatItemGrant> & { extra?: number };
  type ForgedUnit = Omit<Writable<CombatUnit>, 'combatItemGrants'> & { combatItemGrants?: ForgedGrant[] };
  const forge = (edit: (units: ForgedUnit[]) => ForgedUnit[]) => () => {
    const units = edit(structuredClone(opened.units) as ForgedUnit[]) as CombatUnit[];
    validateCombatItemGrants(units, opened.tick, unit => unit.mechanismDefinitions?.eventTriggers ?? []);
  };
  const receiver = (units: ForgedUnit[]) => units.find(u => u.combatItemGrants?.length)!;
  const grant = (units: ForgedUnit[]) => receiver(units).combatItemGrants![0];
  it('accepts the genuine grants', () => { expect(forge(u => u)).not.toThrow(); });
  it.each([
    ['an item outside the pool', (u: ForgedUnit[]) => { grant(u).definitionId = 'thiefs-gloves'; return u; }],
    ['a future tick', (u: ForgedUnit[]) => { grant(u).grantedAtTick = opened.tick + 1; return u; }],
    ['a different tick from its siblings', (u: ForgedUnit[]) => { grant(u).grantedAtTick = opened.tick - 1; return u; }],
    ['a duplicated ordinal', (u: ForgedUnit[]) => { grant(u).ordinal = grant(u).ordinal === 0 ? 1 : 0; return u; }],
    ['a fifth grant', (u: ForgedUnit[]) => { const spare = u.find(x => x.team === 'player' && x.alive && !x.combatItemGrants?.length)!; spare.combatItemGrants = [{ ...receiver(u).combatItemGrants![0], ordinal: 4 }]; return u; }],
    ['a second grant to one receiver', (u: ForgedUnit[]) => { const r = receiver(u); r.combatItemGrants = [...r.combatItemGrants!, { ...r.combatItemGrants![0], ordinal: 4 }]; return u; }],
    ['an enemy receiver', (u: ForgedUnit[]) => { const r = receiver(u), foe = u.find(x => x.team === 'enemy')!; foe.combatItemGrants = r.combatItemGrants; r.combatItemGrants = undefined; return u; }],
    ['a living holder', (u: ForgedUnit[]) => { const h = u.find(x => x.id === 'holder')!; h.alive = true; h.hp = 1; return u; }],
    ['an unfired chest', (u: ForgedUnit[]) => { const h = u.find(x => x.id === 'holder')!; h.triggerLedger = { ...h.triggerLedger!, runtimes: [] }; return u; }],
    ['an extra field', (u: ForgedUnit[]) => { grant(u).extra = 1; return u; }],
  ])('rejects %s', (_name, edit) => { expect(forge(edit)).toThrow('Invalid Match save'); });
  it('a Match save whose unit claims an item it never received is rejected', () => {
    const match = itemMatch('warmog');
    expect(() => restoreMatch(JSON.stringify(match))).not.toThrow();
    const forged = structuredClone(match) as MatchState & { combat: CombatState };
    const unit = forged.combat.units.find(u => u.team === 'player')! as CombatUnit & { combatItemGrants?: unknown };
    unit.combatItemGrants = [{ chest: { ownerId: unit.id, sourceKind: 'item', definitionId: CHEST, instanceId: 'item-9', effectIndex: 0, parentItemInstanceId: null }, ordinal: 0, definitionId: 'warmog', grantedAtTick: 0 }];
    expect(() => restoreMatch(JSON.stringify(forged))).toThrow('Invalid Match save');
  });
  const chest = { ownerId: 'unit-1', sourceKind: 'item', definitionId: CHEST, instanceId: 'item-9', effectIndex: 0, parentItemInstanceId: null };
  it.each([
    ['not an array', { ordinal: 0 }],
    ['a null record', [null]],
    ['an item outside the pool', [{ chest, ordinal: 0, definitionId: 'thiefs-gloves', grantedAtTick: 1 }]],
    ['an unknown item', [{ chest, ordinal: 0, definitionId: 'no-such-item', grantedAtTick: 1 }]],
    ['a missing chest', [{ chest: null, ordinal: 0, definitionId: 'warmog', grantedAtTick: 1 }]],
    ['a text ordinal', [{ chest, ordinal: '0', definitionId: 'warmog', grantedAtTick: 1 }]],
    ['a fractional tick', [{ chest, ordinal: 0, definitionId: 'warmog', grantedAtTick: 0.5 }]],
  ])('a Match save with %s as combat item grants is an invalid save', (_name, grants) => {
    const forged = structuredClone(itemMatch('warmog')) as MatchState & { combat: CombatState };
    (forged.combat.units.find(u => u.team === 'player')! as unknown as { combatItemGrants?: unknown }).combatItemGrants = grants;
    expect(() => restoreMatch(JSON.stringify(forged))).toThrow('Invalid Match save');
  });
});

describe('G2-4b chest in two-sided battles', () => {
  const hero = (definitionId: string, id: string, starLevel: 1 | 2 | 3, col: number, row: number): Unit =>
    ({ id, definitionId, starLevel, team: 'player', location: { kind: 'board', cell: { col, row } } });
  function seat(units: readonly Unit[], items: MatchState['items'] = []): MatchState {
    const base = createMatch(42), round = getCatalogRoundById('2-1');
    return { ...base, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round }, level: 9, items, preparation: { ...base.preparation, units } } as MatchState;
  }
  const weak = seat([hero('maddie', 'unit-1', 1, 3, 4), ...['lux', 'leona', 'garen', 'vi', 'ezreal'].map((d, i) => hero(d, `unit-${i + 2}`, 1, i, 6))],
    [{ id: 'item-1', definitionId: CHEST, location: { kind: 'unit', unitId: 'unit-1', slot: 0 } }]);
  const strong = seat(['maddie', 'garen', 'vi'].map((d, i) => hero(d, `unit-${i + 1}`, 3, i + 2, 4)));
  const grantsBySeat = (state: CombatState, mapping: ReturnType<typeof compileBattle>['mapping']) => grantsOf(state)
    .map(g => ({ ...mapping.find(m => m.combatId === g.unitId && m.kind === 'unit')!, definitionId: g.definitionId, ordinal: g.ordinal })).map(m => [m.seatId, m.originalId, m.definitionId, m.ordinal]);

  it.each([['A holds the chest', 'A'], ['B holds the chest', 'B']] as const)('%s: grants go to the holder\'s own seat and every tick restores', (_n, holderSeat) => {
    const a = snapshotForBattle(holderSeat === 'A' ? weak : strong, 'A'), b = snapshotForBattle(holderSeat === 'A' ? strong : weak, 'B');
    const input = compileBattle(a, b, 42, { battleId: `chest-${holderSeat}` });
    let state = startTwoSidedCombat(input);
    while (state.status === 'running') { state = stepCombat(state).state; validate(state); }
    const grants = grantsBySeat(state, input.mapping);
    expect(grants.length).toBeGreaterThan(0);
    expect(grants.every(([seatId, originalId]) => seatId === holderSeat && originalId !== 'unit-1')).toBe(true);
    const result = resolveTwoSidedBattle(input, 1200);
    expect(result.terminal).toEqual(state);
    expect(resolveTwoSidedBattle(restoreBattleInput(JSON.stringify(input)), 1200)).toEqual(result);
  });

  it('a mirror copy of the chest seat fights the identical battle', () => {
    const a = snapshotForBattle(strong, 'A'), b = snapshotForBattle(weak, 'B');
    const real = resolveTwoSidedBattle(compileBattle(a, b, 42, { battleId: 'chest-mirror' }), 1200);
    const mirrorInput = compileBattle(a, b, 42, { battleId: 'chest-mirror', mirrorOfSeatId: 'B' });
    const mirrored = resolveTwoSidedBattle(mirrorInput, 1200);
    expect(grantsBySeat(real.terminal, real.mapping).length).toBeGreaterThan(0);
    expect(mirrored.terminal).toEqual(real.terminal);
    expect(mirrored.events).toEqual(real.events);
    expect(resolveTwoSidedBattle(restoreBattleInput(JSON.stringify(mirrorInput)), 1200)).toEqual(mirrored);
  });
});
