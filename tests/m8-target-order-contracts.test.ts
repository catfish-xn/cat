import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../src/simulation/board';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { planS13Cast, executeTask, type AbilityContext } from '../src/simulation/combat-s13-abilities';
import { byDistance, lowestAlly, path, EMPTY_RUNTIME, type S13Unit } from '../src/simulation/combat-s13-state';
import { unit } from './combat-helpers';
import { abilityPlans, type Champion } from './fixtures/m8-ability-plans';

const oldUnit = (id: string, team: 'player' | 'enemy', col: number, row: number, hp = 100): S13Unit => ({ ...unit(id, team, col, row, { hp, maxHp: 1000 }), runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [] });
function fixture(name: Champion) {
  const caster = oldUnit('U', 'player', 3, 4, 900);
  caster.ability = resolveAbility(`${name}-ability`, 1);
  const enemies = [oldUnit('A', 'enemy', 5, 4), oldUnit('B', 'enemy', 4, 4), oldUnit('C', 'enemy', 3, 3), oldUnit('D', 'enemy', 2, 4), oldUnit('E', 'enemy', 1, 4)];
  // advanceS13Tick sorts units by ID before calling the existing planners.
  const ctx: AbilityContext = { tick: 10, board: DEFAULT_BOARD, units: [...enemies, caster], events: [], packets: [], heals: [], draw: () => 0 };
  return { caster, enemies, ctx, primary: enemies[1] };
}
const casts: Record<Champion, readonly string[]> = {
  irelia: ['U'], maddie: ['A'], darius: ['B', 'C', 'D'], lux: ['U'], zyra: ['B', 'C', 'D'], tristana: ['B'],
  urgot: ['A', 'B', 'C'], rell: ['U', 'B'], leona: [], vander: ['U'], kogmaw: ['U'], scar: ['B', 'C', 'D'],
  ezreal: ['A', 'B', 'C', 'B'], loris: ['U'], nami: ['B', 'A', 'C', 'D'], corki: ['B'], garen: ['U', 'A', 'B', 'C', 'D'], zoe: ['B', 'E', 'B', 'D', 'B'], caitlyn: ['B'],
};

// Expected declarations independently transcribed from the old selection sites.
const expectedOrders: Record<Champion, readonly string[]> = {
  irelia: ['id'], maddie: [], darius: ['id'], lux: ['hp-absolute-distance-id'], zyra: ['distance-id'], tristana: ['distance-id'],
  urgot: ['id'], rell: [], leona: ['id'], vander: [], kogmaw: [], scar: ['distance-id'], ezreal: ['id'],
  loris: ['id', 'distance-id'], nami: ['nearest-previous'], corki: [], garen: ['id'], zoe: ['farthest-from-primary-return-primary'], caitlyn: [],
};
function declaredOrders(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(declaredOrders);
  if (!value || typeof value !== 'object') return [];
  const object = value as Record<string, unknown>;
  const here = typeof object.order === 'string' && object.relation !== 'self' && object.candidates !== 'event-target' ? [object.order] : [];
  return [...here, ...Object.values(object).flatMap(declaredOrders)];
}

describe('R2 all19 old-code targeting evidence; no new M8 selector implementation', () => {
  it.each(Object.keys(casts) as Champion[])('%s preserves the complete old cast target order', name => {
    const { caster, enemies, ctx, primary } = fixture(name);
    expect(byDistance(caster, [...enemies].reverse())[0].id).toBe('B');
    expect(planS13Cast(ctx, caster, primary, 1)).toEqual(casts[name]);
    expect(declaredOrders(abilityPlans[name])).toEqual(expectedOrders[name]);
  });
  it('Lux equal HP uses distance before ID, then ID, and includes self', () => {
    const holder = oldUnit('U', 'player', 3, 4, 900), farA = oldUnit('A', 'player', 5, 4), nearB = oldUnit('B', 'player', 4, 4), tieC = oldUnit('C', 'player', 3, 3);
    expect(lowestAlly(holder, [holder, farA, nearB, tieC], true)?.id).toBe('B');
    expect(lowestAlly(holder, [tieC, nearB, farA, holder], true)?.id).toBe('B');
    holder.hp = 100;
    expect(lowestAlly(holder, [farA, nearB, holder], true)?.id).toBe('U');
    holder.hp = 99;
    expect(lowestAlly(holder, [farA, nearB, holder], true)?.id).toBe('U');
    expect(abilityPlans.lux.operations[0]).toMatchObject({ targeting: { selector: { order: 'hp-absolute-distance-id', anchor: 'holder', excludeSelf: false } } });
  });
  it('nearest/farthest distance ties both prefer ascending ID, never reverse the ID tie', () => {
    const { caster, enemies } = fixture('maddie');
    expect(byDistance(caster, [...enemies].reverse()).map(u => u.id)).toEqual(['B', 'C', 'D', 'A', 'E']);
    expect(byDistance(caster, [...enemies].reverse(), true).map(u => u.id)).toEqual(['A', 'E', 'B', 'C', 'D']);
  });
  it('Maddie first path intercept differs from Rell ID-ordered all-path hits', () => {
    const { caster, enemies, ctx } = fixture('rell');
    expect(planS13Cast(ctx, caster, enemies[0], 1)).toEqual(['U', 'A', 'B']); // path B→A, emission A→B
    expect(path(DEFAULT_BOARD, caster.cell, enemies[0].cell)).toEqual([{ col: 4, row: 4 }, { col: 5, row: 4 }]);
    // E and NE both shorten the path: clockwise E wins before NE.
    expect(path(DEFAULT_BOARD, { col: 3, row: 4 }, { col: 4, row: 3 })).toEqual([{ col: 4, row: 4 }, { col: 4, row: 3 }]);
    const shot = fixture('maddie'); planS13Cast(shot.ctx, shot.caster, shot.primary, 1);
    executeTask(shot.ctx, shot.caster, shot.caster.tasks[0]);
    expect(shot.ctx.packets.map(p => p.targetId)).toEqual(['B']);
    expect(abilityPlans.rell.operations[1]).toMatchObject({ targeting: { pathOrder: 'E-SE-SW-W-NW-NE', hitOrder: 'id' } });
  });
  it.each(['irelia', 'leona', 'loris'] as const)('%s end task samples then emits ID order', name => {
    const { caster, ctx, primary } = fixture(name); planS13Cast(ctx, caster, primary, 1);
    ctx.tick = caster.tasks[0].executeAtTick; executeTask(ctx, caster, caster.tasks[0]);
    expect(ctx.packets.map(p => p.targetId)).toEqual(name === 'loris' ? ['A', 'B', 'C'] : ['B', 'C', 'D']);
  });
  it('Corki primary first, ID-ordered radius candidates; dead aim fallback uses distance→ID', () => {
    const { caster, ctx, primary } = fixture('corki'); planS13Cast(ctx, caster, primary, 1);
    for (const task of caster.tasks.slice(0, 4)) executeTask(ctx, caster, task);
    expect(ctx.packets.map(p => p.targetId)).toEqual(['B', 'A', 'C', 'D']);
    primary.alive = false; ctx.packets = [];
    executeTask(ctx, caster, caster.tasks[0]);
    expect(ctx.packets.map(p => p.targetId)).toEqual(['C']);
  });
  it('Caitlyn modulo center reads ID order, area emits ID order before extra center', () => {
    const { caster, ctx, primary } = fixture('caitlyn'); planS13Cast(ctx, caster, primary, 1);
    executeTask(ctx, caster, caster.tasks[0]);
    expect(ctx.packets.map(p => p.targetId)).toEqual(['A', 'B', 'A']);
    expect(caster.tasks[0].targetId).toBeNull();
  });
  it('Tristana next-target tie uses distance from killed target then ID', () => {
    const { caster, primary, enemies } = fixture('tristana');
    expect(byDistance(primary, enemies.filter(u => u.id !== primary.id))[0].id).toBe('A');
    expect(caster.id).toBe('U');
    expect(abilityPlans.tristana.operations[1]).toMatchObject({ selector: { anchor: 'primary-target', order: 'distance-id' } });
  });
});
