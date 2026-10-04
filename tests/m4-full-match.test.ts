import assertGolden from './fixtures/m4/assert-golden.cjs';
import { beforeAll, describe, expect, it } from 'vitest';
import generateRoute, { type Route } from '../scripts/generate-m4-route.cjs';
import { restoreMatch } from '../src/simulation/serialization';
let route:Route;
beforeAll(async()=>{route=await generateRoute();},60000);
describe('one ordinary seed42 Match covers the entire M4 vertical slice',()=>{
  it('matches the frozen legal transcript and every round state/event hash',()=>{assertGolden(route);});
  it('buys two-star units, grows population, upgrades a real trait tier and crafts acquired items',()=>{
    expect(route.allEvents.some(e=>e.type==='unitUpgraded'&&e.toStar===2)).toBe(true);
    expect(route.rounds[0].traits.find(t=>t.traitId==='conduit')?.tier).toBe(2);
    expect(route.rounds.some(r=>r.traits.some(t=>t.traitId==='conduit'&&t.tier===4))).toBe(true);
    expect(route.allEvents.some(e=>e.type==='itemCombined'&&e.definitionId==='spell-edge')).toBe(true);
    expect(route.rounds[0].started.combat?.units.find(u=>u.id==='unit-3')?.attackDamage).toBeGreaterThan(144);
  });
  it('chooses two augments and pays to reroll Anomaly, which acts in both R7 and R8 alongside all four sources',()=>{
    expect(route.final.augments).toHaveLength(2);
    expect(route.allEvents.some(e=>e.type==='anomalyRerolled'&&e.cost===2)).toBe(true);
    for(const round of route.rounds.filter(r=>[7,8].includes(r.round))){
      const carrier=round.started.combat!.units.find(u=>u.id===round.started.anomalyBinding!.unitId)!;
      expect(new Set(carrier.sources?.map(s=>s.source.sourceKind))).toEqual(new Set(['trait','item','augment','anomaly']));
      expect(round.events.some(e=>e.type==='effectTriggered'&&e.source.sourceKind==='anomaly')).toBe(true);
      expect(round.events.some(e=>e.type==='cast'&&e.sourceId===carrier.id)).toBe(true);
      expect(round.events.some(e=>e.type==='manaChanged'&&e.unitId===carrier.id)).toBe(true);
    }
  });
  it('includes three affordable D/buy/F/E chains and only real nonempty battles before Game Over',()=>{
    expect(route.actions.filter(a=>a.annotation?.startsWith('fast-chain-')&&a.annotation.endsWith('-end'))).toHaveLength(3);
    expect(route.rounds.every(r=>r.settled.combat!.tick>0&&r.before.preparation.units.some(u=>u.team==='player'&&u.location.kind==='board'))).toBe(true);
    expect(route.final.phase).toBe('gameOver');expect(route.final.playerHp).toBe(0);
    for(const round of route.rounds){const events=round.events.filter(e=>'tick' in e);expect(events.map(e=>e.eventSeq)).toEqual(events.map((_,i)=>i));}
  });
  it.each(['schemaVersion','rulesVersion','contentVersion','contentDigest'])('rejects incompatible %s',field=>{expect(()=>restoreMatch({...route.initial,[field]:'unsupported'})).toThrow();});
});
