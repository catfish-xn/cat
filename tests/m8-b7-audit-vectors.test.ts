import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accepted } from './match-helpers';
import { publicAuthoredPreparation, publicHeraldTarget as publicDragonTarget } from './fixtures/m8-neutral-public-route';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

// Pure combat audit vectors moved intact to m8-b7-audit-combat-vectors.test.ts,
// so obsolete public route fixtures cannot prevent their execution.

// Real acquisition prefixes preserve the full Match restoration boundary.
// v22: seed 42's scuttle-crab opening replaces the authored encounters; use the crab-free route.
const prepared = publicAuthoredPreparation;
const encounterArmy = (s: api.MatchState) => s.roundDefinitionId==='6-7'?publicDragonTarget(s):s;
// Let the restore boundary parse the saved text once; checkpoints/assertions stay unchanged.
const restored = (s: api.MatchState) => restoreMatch(serializeMatch(s));
const rejects = (s: api.MatchState, mutate: (x: any) => void) => { expect(restored(s)).toEqual(s); const x = JSON.parse(serializeMatch(s)); mutate(x); expect(() => restoreMatch(x)).toThrow(); };
const mechanismTick = (events: readonly api.MatchEvent[]) => events.some(e => ['death', 'heal', 'movement', 'statusChanged'].includes(e.type));

describe('B7 audit: Match save/restore of real encounters', () => {
  it.each(['2-7', '3-7', '4-7', '5-7', '6-7'])('%s: restoring at every opening and mechanism tick reproduces the continuous run', roundId => {
    // Use the independently recorded public Ionic prefix: the G2-2 default route
    // leaves Sunfire on Irelia, adding unrelated per-tick aura traffic to this neutral vector.
    const initial = encounterArmy(prepared(roundId));
    let continuous = accepted(api.startMatchCombat(initial)), resumed = restored(continuous), mechanismRestores = 0, afterMechanism = false;
    expect(continuous.combat!.tick).toBe(0);
    expect(resumed).toEqual(continuous);
    const continuousEvents: unknown[] = [], resumedEvents: unknown[] = [];
    while (continuous.phase === 'combat') {
      const a = api.stepMatch(continuous), b = api.stepMatch(resumed);
      continuous = a.state; continuousEvents.push(...a.events); resumedEvents.push(...b.events);
      // Opening/early attack window, every mechanism tick AND its next-tick consumer, and periodic checkpoints.
      const tick = continuous.combat!.tick;
      if (tick <= 13 || mechanismTick(a.events) || afterMechanism || tick % 50 === 0) {
        resumed = restored(b.state);
        if (mechanismTick(a.events)) mechanismRestores++;
        expect(resumed).toEqual(continuous);
      } else resumed = b.state;
      afterMechanism = mechanismTick(a.events);
    }
    expect(resumedEvents).toEqual(continuousEvents);
    expect(serializeMatch(resumed)).toBe(serializeMatch(continuous));
    expect(mechanismRestores).toBeGreaterThan(0);
  // T13 idle single-worker: 3-7 5.51s, 4-7 7.91s, 5-7 9.17s; keep every restore/assertion.
  }, 20000);

  it('4-7 rejects retimed buffs, forged death, and deletion of real consumed bird reactions', () => {
    let s = accepted(api.startMatchCombat(prepared('4-7')));
    const activeBuff = () => s.combat!.units.find(u=>u.alive && u.mechanismState?.statuses.some(g=>g.contributions.some(c=>c.source.definitionId==='furious-flock-project-v1')));
    while(s.phase==='combat' && !activeBuff()) s=api.stepMatch(s).state;
    const holder=activeBuff(); expect(holder).toBeDefined();
    const buff=(x:any)=>x.combat.units.find((u:any)=>u.id===holder!.id).mechanismState.statuses.flatMap((g:any)=>g.contributions).find((c:any)=>c.source.definitionId==='furious-flock-project-v1');
    rejects(s,x=>{buff(x).appliedAtTick++;});
    rejects(s,x=>{buff(x).expiresAtTick=x.combat.tick+1;});
    rejects(s,x=>{x.combat.neutralReceipts.deaths.push({unitId:holder!.id,tick:x.combat.tick,eventSeq:0});});
    rejects(s,x=>{const r=x.combat.companionState.reactions.find((r:any)=>r.targetId===holder!.id&&r.status==='executed');r.status='pending';});
    rejects(s,x=>{x.combat.companionState.reactions=x.combat.companionState.reactions.filter((r:any)=>r.targetId!==holder!.id);});
    rejects(s,x=>{const u=x.combat.units.find((u:any)=>u.id===holder!.id);u.mechanismState.statuses=[];u.statuses=[];});
  });

  it('2-7 rejects deleting an executed krug reaction whose holder is still alive', () => {
    let s = accepted(api.startMatchCombat(encounterArmy(prepared('2-7'))));
    const executedForLiving = (m: api.MatchState) => m.combat?.companionState?.reactions.find(r => r.status === 'executed' && m.combat!.units.find(u => u.id === r.targetId)!.alive);
    while (s.phase === 'combat' && !executedForLiving(s)) s = api.stepMatch(s).state;
    expect(s.phase).toBe('combat');
    const reaction = executedForLiving(s)!;
    rejects(s, x => { x.combat.companionState.reactions = x.combat.companionState.reactions.filter((r: any) => r.key !== reaction.key); });
  });
});
