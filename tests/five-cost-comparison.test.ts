import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createCombat, stepCombat } from '../src/simulation/combat';
import { DEFAULT_BOARD } from '../src/simulation/board';
import type { GameState } from '../src/simulation/game';
const FIVE = ['caitlyn','malzahar','leblanc','jayce','rumble','sevika','jinx','mordekaiser'];
const ENEMY = ['drmundo','sett','vi','darius','ambessa','ekko','illaoi'];
test.skipIf(!process.env.OUT)('five-cost original reproduction', () => {
  const lines: string[] = [];
  for (const id of FIVE) for (const star of [1,2,3] as const) {
    const units: GameState['units'] = [
      { id: 'p-1', definitionId: id, team: 'player', starLevel: star, location: { kind: 'board', cell: { col: 3, row: 6 } } },
      { id: 'p-2', definitionId: 'drmundo', team: 'player', starLevel: 3, location: { kind: 'board', cell: { col: 2, row: 4 } } },
      { id: 'p-3', definitionId: 'drmundo', team: 'player', starLevel: 3, location: { kind: 'board', cell: { col: 4, row: 4 } } },
      ...ENEMY.map((d, i) => ({ id: `e-${i}`, definitionId: d, team: 'enemy' as const, starLevel: 3 as const, location: { kind: 'board' as const, cell: { col: i, row: i % 2 === 0 ? 2 : 1 } } })),
    ];
    let state = createCombat({ board: DEFAULT_BOARD, benchSize: 7, units });
    const casts: { tick: number; seq: number; targets: number }[] = []; const perCast = new Map<number, number>(); const raw = new Map<number, number>(); const hitIds = new Map<number, Set<string>>(); const outcomes: string[] = []; let attackDmg = 0, kills = 0;
    let err = '';
    try {
      while (state.status !== 'finished' && state.tick < 1800) {
        const step = stepCombat(state); state = step.state;
        for (const e of step.events as any[]) {
          if (e.type === 'cast' && e.receipt?.source?.ownerId === 'p-1') casts.push({ tick: e.tick, seq: e.receipt.actionSeq, targets: e.receipt.targetIds.length });
          if (e.type === 'packetDamage' && e.outcome.context.source.ownerId === 'p-1' && e.outcome.context.targetId.startsWith('e-')) {
            const c = e.outcome.context, dmg = e.outcome.hpDamage + e.outcome.absorbed;
            if (c.delivery === 'basic-attack') attackDmg += dmg; else if (process.env.DBG===id) outcomes.push(`${e.tick}:${c.delivery}:${c.source.sourceKind}:${c.source.definitionId}:seq${c.actionSeq}/trig${c.triggeringCastActionSeq}:${c.targetId}:${e.outcome.raw}/hp${e.outcome.hpDamage}/abs${e.outcome.absorbed}/mit${e.outcome.mitigated}/hit${e.outcome.hit}`);
            else { const k = c.triggeringCastActionSeq ?? c.rootActionSeq ?? -1; perCast.set(k, (perCast.get(k) ?? 0) + dmg); raw.set(k,(raw.get(k)??0)+e.outcome.raw); if(!hitIds.has(k))hitIds.set(k,new Set()); hitIds.get(k)!.add(c.targetId); }
          }
          if (e.type === 'castOutcome' && e.unitId==='p-1') outcomes.push(e.outcome+'/'+e.castVariant?.move);
          if (e.type === 'death' && String(e.unitId).startsWith('e-')) kills++;
        }
      }
    } catch (x) { err = String((x as Error).message) + ' ENEMIES:' + JSON.stringify(state.units.filter(u=>u.team==='enemy'&&u.alive).map(u=>({id:u.id,hp:u.hp,cell:u.cell,untargetable:(u as any).untargetable,st:((u as any).statuses??[]).map((s:any)=>s.kind),absent:(u as any).absentUntilTick}))) + ' tick=' + state.tick; }
    const p = state.units.find(u => u.id === 'p-1')!;
    const castDmg = casts.map(c => `${c.tick}:hp${perCast.get(c.seq) ?? 0}/raw${raw.get(c.seq) ?? 0}/n${hitIds.get(c.seq)?.size ?? 0}`).join(' ');
    const other = [...perCast.entries()].filter(([k]) => !casts.some(c => c.seq === k)).reduce((n, [, v]) => n + v, 0);
    lines.push(`${id} ${star}★ hp=${p.maxHp} ad=${p.attackDamage} casts=${casts.length} [tick:dmg] ${castDmg} unattributed=${other} attackDmg=${attackDmg} kills=${kills} ${outcomes.join(',')} end@${state.tick} ${state.result} ${err}`);
  }
  writeFileSync(process.env.OUT!, lines.join('\n'));
});
