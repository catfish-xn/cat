import { describe, expect, it } from 'vitest';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { stepCombat, type CombatUnit } from '../src/simulation/combat';
import { EMPTY_RUNTIME, applyStatus, origin, type S13Unit } from '../src/simulation/combat-s13-state';
import { effectiveStatuses, validateStatusApplication } from '../src/simulation/m8/status';
import { knockAway } from '../src/simulation/combat-displacement';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
import { DEFAULT_BOARD, hexDistance } from '../src/simulation/board';
import { battle, unit, freeze } from './combat-helpers';
import { AMBESSA_SLAM_STUN_TICKS, VI_ROW_KNOCKUP_TICKS } from '../src/simulation/combat-g2-2';

const hero = (id: string, name: string, team: 'player'|'enemy', col: number, row = 3, patch: Partial<CombatUnit> = {}) => unit(id, team, col, row, {
  definitionId: name, ability: resolveAbility(name + '-ability', 1), hp: 100000, maxHp: 100000, mana: 0, maxMana: 100,
  attackDamage: 100, attackRange: 8, cooldownTicks: 1000, moveCooldownTicks: 1000,
  baseAttackSpeedBps: 10000, abilityPower: 100, runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [], mechanics: [], ...patch,
});
const activeStun = (u: CombatUnit, tick: number) => effectiveStatuses(u.mechanismState?.statuses ?? [], tick).filter(g => g.kind === 'stun');

describe('v23 independent review: control timing and action gates', () => {
  it.each([['vi', 'target', 30, false], ['vi', 'row', VI_ROW_KNOCKUP_TICKS, true], ['violet', 'target', 5, true], ['sett', 'target', 30, false]] as const)(
    '%s → %s lasts exactly %i ticks (knockup=%s)', (name, targetId, duration, knockup) => {
      const r = stepCombat(freeze(battle([hero('p', name, 'player', 1, 3, { mana: 100 }), hero('target', 'garen', 'enemy', 2), hero('row', 'garen', 'enemy', 3)])));
      const t = r.state.units.find(u => u.id === targetId)!;
      const contribution = t.mechanismState!.statuses.find(g => g.kind === 'stun')!.contributions[0];
      expect(contribution.appliedAtTick).toBe(2);
      expect(contribution.expiresAtTick).toBe(2 + duration);
      expect(contribution.application.knockup === true).toBe(knockup);
      expect(activeStun(t, 1)).toHaveLength(0);
      for (let tick = 2; tick < 2 + duration; tick++) expect(activeStun(t, tick)).toHaveLength(1);
      expect(activeStun(t, 2 + duration)).toHaveLength(0);
    },
  );

  it.each([false, true])('stun/knockup=%s cancels channel and cancellable tasks on the next tick, keeps target selectable', knockup => {
    const p = hero('p', 'garen', 'player', 1) as S13Unit, t = hero('t', 'maddie', 'enemy', 2) as S13Unit;
    const events: AbilityContext['events'] = [];
    applyStatus(t, origin(t), 'channel', 0, 100, 0, events);
    applyStatus(t, origin(p), 'stun', 0, 5, 0, events, false, '', undefined, knockup);
    t.tasks.push({ key: 'review-cancellable', source: origin(t), kind: 'maddie', targetId: p.id, amount: 100, executeAtTick: 2, actionSeq: 0, ordinal: 0, total: 1, cancellable: true });
    const r = stepCombat(battle([p, t]));
    expect(r.state.units.find(u => u.id === 'p')!.targetId).toBe('t');
    const after = r.state.units.find(u => u.id === 't')!;
    expect(after.tasks).toEqual([]);
    expect(after.mechanismState!.activities).toContainEqual(expect.objectContaining({ kind: 'channel', lifecycle: 'ended', endReason: 'control-cancelled' }));
    expect(r.events.some(e => (e.type === 'attack' && e.attackerId === t.id) || (e.type === 'cast' && 'receipt' in e && e.receipt.source.ownerId === t.id))).toBe(false);
  });

  it('forced movement preserves a selectable locked target and does not itself cancel a channel', () => {
    const p = hero('p', 'garen', 'player', 1) as S13Unit, t = hero('t', 'maddie', 'enemy', 2) as S13Unit;
    p.targetId = t.id;
    const ctx: AbilityContext = { tick: 0, board: DEFAULT_BOARD, units: [p,t], events: [], packets: [], heals: [], draw: () => { throw Error('unexpected RNG'); } };
    applyStatus(t, origin(t), 'channel', 0, 100, 0, ctx.events);
    knockAway(ctx, p, t, 2, 'sevika-knockback');
    expect(t.cell).toEqual({ col: 4, row: 3 });
    const r = stepCombat(battle([p,t]));
    expect(r.state.units.find(u => u.id === p.id)!.targetId).toBe(t.id);
    expect(r.state.units.find(u => u.id === t.id)!.mechanismState!.activities).toContainEqual(expect.objectContaining({ lifecycle: 'active' }));
  });

  it('knockup accepts only true on a stun declaration', () => {
    const p = hero('p', 'garen', 'player', 1) as S13Unit, t = hero('t', 'garen', 'enemy', 2) as S13Unit;
    applyStatus(t, origin(p), 'stun', 0, 5, 0, [], false, '', undefined, true);
    const app = t.mechanismState!.statuses[0].contributions[0].application;
    expect(() => validateStatusApplication(app)).not.toThrow();
    expect(() => validateStatusApplication({ ...app, knockup: false } as never)).toThrow('Knock-up must be a stun');
    expect(() => validateStatusApplication({ ...app, kind: 'control-immunity' })).toThrow('Knock-up must be a stun');
  });
});

// User 2026-10-24: Ambessa's slam stuns 1 s, Vi's row shockwave knocks up 0.5 s (dac13dc3).
it('Ambessa slam stun lasts AMBESSA_SLAM_STUN_TICKS and Vander adds no taunt or control', () => {
  const ambessa = hero('p', 'ambessa', 'player', 1, 3, { mana: 100, runtime: { ...EMPTY_RUNTIME, castCount: 1 } });
  const r = stepCombat(battle([ambessa,hero('t','garen','enemy',2)]));
  const stun = r.state.units.find(u => u.id === 't')!.mechanismState!.statuses.find(g => g.kind === 'stun')!.contributions[0];
  expect([stun.appliedAtTick,stun.expiresAtTick,stun.application.knockup]).toEqual([2,2+AMBESSA_SLAM_STUN_TICKS,undefined]);
  const v = stepCombat(battle([hero('p','vander','player',1,3,{mana:100}),hero('t','garen','enemy',2)]));
  expect(v.events.some(e => e.type === 'cast')).toBe(true);
  expect(v.events.filter(e => e.type === 'statusChanged' && e.group.targetId === 't')).toEqual([]);
});


it('Sett grab changes the cell immediately, preserves targeting, then its stun interrupts a channel next tick', () => {
  const sett = hero('p','sett','player',1,3,{mana:100}) as S13Unit;
  const target = hero('t','maddie','enemy',4,3) as S13Unit;
  applyStatus(target,origin(target),'channel',0,100,0,[]);
  sett.targetId = target.id;
  const first = stepCombat(battle([sett,target]));
  const moved = first.state.units.find(u => u.id === target.id)!;
  expect(hexDistance(moved.cell, first.state.units.find(u => u.id === sett.id)!.cell)).toBe(1);
  expect(first.events).toContainEqual(expect.objectContaining({type:'movement',unitId:target.id,reason:'sett-grab'}));
  expect(first.state.units.find(u => u.id === sett.id)!.targetId).toBe(target.id);
  expect(activeStun(moved,1)).toHaveLength(0);
  expect(moved.mechanismState!.activities).toContainEqual(expect.objectContaining({lifecycle:'active'}));
  const second = stepCombat(first.state);
  const interrupted = second.state.units.find(u => u.id === target.id)!;
  expect(activeStun(interrupted,2)).toHaveLength(1);
  expect(interrupted.mechanismState!.activities).toContainEqual(expect.objectContaining({lifecycle:'ended',endReason:'control-cancelled',endedAtTick:2}));
});
