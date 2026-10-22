/** Audit measurements, no latency threshold and no server/visual changes. */
import { expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';
import { writeFileSync, mkdirSync } from 'node:fs';
import { applySeatCommand } from '../src/server/room/room';
import { makeRoom, runUntil } from './server/helpers';
import type { RoomState } from '../src/server/room/types';

it('measures combat bench moves separately from Room.handle PvE catch-up',()=>{
  const rows:unknown[]=[];
  for(const avarice of [false,true]) {
    const {room,clock}=makeRoom();room.start();
    runUntil(room,clock,s=>s.round===3&&s.phase==='preparation');
    const holder=room as unknown as {current:RoomState};
    if(avarice)holder.current={...holder.current,seats:holder.current.seats.map(seat=>seat.seatId!=='s0'?seat:{...seat,match:{...seat.match,anomalyBinding:{definitionId:'avarice-incarnate',unitId:seat.match.preparation.units.find(u=>u.team==='player'&&u.location.kind==='board')!.id,choiceId:'audit',boundRound:3}}})};
    runUntil(room,clock,s=>s.round===3&&s.phase==='battle');
    // Buy a real shared-pool unit into the bench, preserving conservation and acquisition provenance.
    const slot=room.state.seats.find(s=>s.seatId==='s0')!.match.shop.slots.findIndex(s=>s.status==='available');
    const bought=room.handle('s0',{type:'buy',slot,generation:room.state.seats.find(s=>s.seatId==='s0')!.match.shop.generation});expect(bought.ok).toBe(true);
    const initial=room.state.seats.find(s=>s.seatId==='s0')!.match;
    const bench=initial.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench')!;expect(bench).toBeDefined();
    const cmd={type:'deploy' as const,unitId:bench.id,target:{kind:'bench' as const,slot:7}};
    for(let i=0;i<100;i++)expect(applySeatCommand(room.state.pool,initial,cmd).ok).toBe(true);
    const samples:number[]=[];
    for(let i=0;i<500;i++){const start=performance.now();const r=applySeatCommand(room.state.pool,initial,cmd);samples.push(performance.now()-start);expect(r.ok).toBe(true);}
    samples.sort((a,b)=>a-b);
    clock.advance(400);
    const before=room.state.seats.find(s=>s.seatId==='s0')!.match.combat!.tick;
    const start=performance.now();const r=room.handle('s0',cmd);const handleMs=performance.now()-start;expect(r.ok).toBe(true);
    const after=room.state.seats.find(s=>s.seatId==='s0')!.match.combat!.tick;
    rows.push({avarice,round:'1-4',samples:500,medianMs:samples[250],p95Ms:samples[475],maxMs:samples[499],handleMs,combatTickBefore:before,combatTickAfter:after});
    room.dispose();
  }
  mkdirSync('docs/evidence/playtest-1022b',{recursive:true});
  writeFileSync('docs/evidence/playtest-1022b/bench-timing.json',JSON.stringify({node:process.version,rows},null,2)+'\n');
},60_000);
