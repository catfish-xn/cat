import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD, isDeploymentCell } from '../src/simulation/board';
import { NEUTRAL_DEFINITIONS } from '../src/simulation/content/neutrals';
import { NEUTRAL_ENCOUNTERS } from '../src/simulation/content/neutral-encounters';
import { compileNeutralEncounter } from '../src/simulation/neutral-encounter-compiler';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { SHOP_CATALOG } from '../src/simulation/match-rules';

// Independent transcription of the approved table, not computed from compiler output.
const stats = [
  ['pve-minion-melee-a', 'minion', 110, 8, 5000, 40, 0, 0, 1],
  ['pve-minion-melee-b', 'minion', 160, 10, 6000, 34, 0, 0, 1],
  ['pve-minion-ranged-b', 'minion', 120, 9, 6000, 34, 0, 0, 3],
  ['pve-minion-melee-c', 'minion', 220, 12, 6000, 34, 0, 0, 1],
  ['pve-minion-ranged-c', 'minion', 160, 10, 6000, 34, 0, 0, 3],
  ['pve-krug', 'krug', 400, 30, 8000, 25, 20, 20, 1],
  ['pve-wolf-large', 'wolf', 900, 50, 8000, 25, 15, 15, 1],
  ['pve-wolf-small', 'wolf', 450, 22, 8000, 25, 15, 15, 1],
  ['pve-razorbeak-large', 'razorbeak', 1400, 65, 8000, 25, 25, 25, 1],
  ['pve-razorbeak-small', 'razorbeak', 680, 32, 8000, 25, 25, 25, 1],
  ['pve-elder-dragon', 'elder-dragon', 6000, 85, 10000, 20, 50, 50, 2],
  ['pve-rift-herald', 'rift-herald', 9000, 120, 10000, 20, 60, 60, 2],
] as const;
const formations = [
  ['1-2', 'minions-a-v1', [['m01', 'pve-minion-melee-a', 2, 3], ['m02', 'pve-minion-melee-a', 4, 3]]],
  ['1-3', 'minions-b-v1', [['m01', 'pve-minion-melee-b', 2, 3], ['m02', 'pve-minion-melee-b', 4, 3], ['r01', 'pve-minion-ranged-b', 3, 1]]],
  ['1-4', 'minions-c-v1', [['m01', 'pve-minion-melee-c', 2, 3], ['m02', 'pve-minion-melee-c', 4, 3], ['r01', 'pve-minion-ranged-c', 2, 1], ['r02', 'pve-minion-ranged-c', 4, 1]]],
  ['2-7', 'krugs-v1', [['k01', 'pve-krug', 1, 3], ['k02', 'pve-krug', 3, 3], ['k03', 'pve-krug', 5, 3]]],
  ['3-7', 'wolves-v1', [['w00', 'pve-wolf-large', 3, 2], ['w01', 'pve-wolf-small', 1, 3], ['w02', 'pve-wolf-small', 2, 3], ['w03', 'pve-wolf-small', 4, 3], ['w04', 'pve-wolf-small', 5, 3]]],
  ['4-7', 'razorbeaks-v1', [['r00', 'pve-razorbeak-large', 3, 2], ['r01', 'pve-razorbeak-small', 0, 3], ['r02', 'pve-razorbeak-small', 1, 3], ['r03', 'pve-razorbeak-small', 2, 3], ['r04', 'pve-razorbeak-small', 4, 3], ['r05', 'pve-razorbeak-small', 5, 3]]],
  ['5-7', 'elder-dragon-v1', [['d01', 'pve-elder-dragon', 3, 2]]],
  ['6-7', 'rift-herald-v1', [['h01', 'pve-rift-herald', 3, 1]]],
] as const;

describe('B7 isolated approved content, not the enabled Match catalog', () => {
  it('compiles all 12 authored base stats, 25%/1.4 critical inputs and 0/0 mana', () => {
    expect(Object.keys(NEUTRAL_DEFINITIONS).sort()).toEqual(stats.map(row => row[0]).sort());
    const compiled = NEUTRAL_ENCOUNTERS.flatMap(e => compileNeutralEncounter(e.roundId).units);
    for (const [id, family, hp, ad, as, ticks, armor, mr, range] of stats) {
      const definition = NEUTRAL_DEFINITIONS[id];
      expect(definition).toMatchObject({ unitKind: 'neutral', monsterFamily: family, starLevel: 1, health: hp, attack: ad,
        baseAttackSpeedBps: as, armor, magicResist: mr, attackRange: range, abilityPower: 100,
        initialMana: 0, maxMana: 0, baseCritChanceBps: 2500, baseCritMultiplierBps: 14000, traits: [], equipment: [] });
      for (const u of compiled.filter(u => u.definitionId === id)) expect(u).toMatchObject({
        unitKind: 'neutral', monsterFamily: family, starLevel: 1, hp, maxHp: hp, attackDamage: ad, attackDamageBase: ad,
        baseAttackSpeedBps: as, attackIntervalTicks: ticks, armor, magicResist: mr, attackRange: range, abilityPower: 100,
        mana: 0, maxMana: 0, itemPrograms: [], mechanics: [],
        spellCrit: { enabled: false, chanceBps: 2500, multiplierBps: 14000, itemSources: [], nonItemSources: [] },
        ability: { kind: 's13', championId: 'neutral', amount: 0, variables: {} },
      });
    }
  });

  it('matches every round, slot, definition and position, including phase1 2/3/4 units', () => {
    expect(NEUTRAL_ENCOUNTERS.map(e => [e.roundId, e.encounterId, e.slots.map(s => [s.slotId, s.definitionId, s.cell.col, s.cell.row])])).toEqual(formations);
    expect(NEUTRAL_ENCOUNTERS.map(e => e.slots.length)).toEqual([2, 3, 4, 3, 5, 6, 1, 1]);
    const ids: string[] = [];
    for (const [roundId, encounterId, slots] of formations) {
      const result = compileNeutralEncounter(roundId);
      expect(result).toMatchObject({ roundId, encounterId, encounterRngDraws: 0,
        catalogVersion: 'm8b-encounters-project-v1', policyVersion: 'm8b-pve-project-v1' });
      expect(result.deployment).toEqual(slots.map(([slotId, definitionId, col, row]) => ({
        id: JSON.stringify(['pve', roundId, encounterId, slotId]), definitionId, encounterId,
        team: 'enemy', starLevel: 1, location: { kind: 'board', cell: { col, row } },
      })));
      expect(result.units.map(u => u.id)).toEqual(result.deployment.map(u => u.id));
      expect(new Set(result.units.map(u => JSON.stringify(u.cell))).size).toBe(slots.length);
      for (const u of result.units) expect(isDeploymentCell(DEFAULT_BOARD, 'enemy', u.cell)).toBe(true);
      ids.push(...result.units.map(u => u.id));
    }
    expect(ids).toHaveLength(25); expect(new Set(ids).size).toBe(25);
  });

  it('binds exactly the five mechanisms to real ability sources, not ID-based executor branches', () => {
    expect(compileNeutralEncounter('2-7').units.map(u => u.companionDefinitions?.[0].maxReactions)).toEqual([2, 2, 2]);
    expect(compileNeutralEncounter('3-7').openingDefinitions.map(d => d.kind)).toEqual(Array(5).fill('backline-jump'));
    expect(compileNeutralEncounter('4-7').units.map(u => u.companionDefinitions?.[0].maxReactions)).toEqual(Array(6).fill(5));
    expect(compileNeutralEncounter('5-7').units[0].attackCone).toEqual({ secondaryDamageBps: 3500 });
    expect(compileNeutralEncounter('6-7').openingDefinitions[0]).toMatchObject({ kind: 'path-charge', source: { definitionId: 'void-charge-project-v1' } });
    for (const e of NEUTRAL_ENCOUNTERS) {
      const compiled = compileNeutralEncounter(e.roundId);
      for (const source of [...compiled.openingDefinitions.map(d => d.source), ...compiled.units.flatMap(u => u.companionDefinitions?.map(d => d.source) ?? [])]) {
        const u = compiled.units.find(u => u.id === source.ownerId)!;
        expect(source).toEqual({ ownerId: u.id, sourceKind: 'ability', definitionId: u.ability.id, instanceId: u.id, effectIndex: 0, parentItemInstanceId: null });
      }
    }
  });

  it('is immutable, repeatable, detached between compilations, and rejects non-PvE rounds', () => {
    const first = compileNeutralEncounter('2-7'), second = compileNeutralEncounter('2-7');
    expect(second).toEqual(first); expect(second.units[0]).not.toBe(first.units[0]);
    expect(second.units[0].companionDefinitions).not.toBe(first.units[0].companionDefinitions);
    expect(Object.isFrozen(first.units[0].companionDefinitions?.[0].effects)).toBe(true);
    expect(Object.isFrozen(NEUTRAL_DEFINITIONS['pve-krug'].mechanism)).toBe(true);
    expect(Object.isFrozen(NEUTRAL_ENCOUNTERS[0].slots[0].cell)).toBe(true);
    expect(() => Reflect.set(first.units[0].cell, 'row', 7)).not.toThrow();
    expect(first.units[0].cell).toEqual({ col: 1, row: 3 });
    for (const invalid of ['', '1-1', '2-1', '7-7', '__proto__', 'constructor']) expect(() => compileNeutralEncounter(invalid)).toThrow(RangeError);
  });

  it('does not add any definition to the active unit registry or champion shop', () => {
    for (const id of Object.keys(NEUTRAL_DEFINITIONS)) {
      expect(Object.hasOwn(UNIT_DEFINITIONS, id)).toBe(false);
      expect(SHOP_CATALOG).not.toContain(id);
    }
    expect(UNIT_DEFINITIONS['neutral-stage-2'].unitKind).toBeUndefined();
  });
});
