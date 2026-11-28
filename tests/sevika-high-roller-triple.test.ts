import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME, applyStatus, origin, type S13Unit } from '../src/simulation/combat-s13-state';
import { nextRandom } from '../src/simulation/rng';
import { SEVIKA_PUNCH_HIT_TICKS } from '../src/simulation/cast-windup';
import { battle, freeze, unit } from './combat-helpers';

// 14.24b High Roller Triple: the enhanced spell's bonus is applied, and Jackpot is Spell4 coins (G24-SEVIKA-TRIPLE-01 / JACKPOT-01).
function hero(patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit('p','player',1,3,{definitionId:'sevika',starLevel:1,ability:resolveAbility('sevika-ability',1),
    hp:10000,maxHp:10000,mana:100,maxMana:100,attackDamage:100,abilityPower:100,attackRange:20,
    baseAttackSpeedBps:1,cooldownTicks:1000,moveCooldownTicks:1000,
    runtime:{...EMPTY_RUNTIME},statuses:[],tasks:[],shieldLayers:[],mechanics:[],...patch});
}
function dummy(id='e',patch:Partial<CombatUnit>={}):CombatUnit {
  return unit(id,'enemy',2,3,{definitionId:'neutral-stage-2',ability:resolveAbility('neutral-attack',1),
    hp:100000,maxHp:100000,mana:0,maxMana:0,attackDamage:0,cooldownTicks:1000,moveCooldownTicks:1000,
    runtime:{...EMPTY_RUNTIME},statuses:[],tasks:[],shieldLayers:[],...patch});
}
/** Third word picks the Triple row: [0,4000) blue, [4000,7500) knockout, [7500,9950) quadruple, [9950,10000) jackpot. */
function seedFor(lo:number,hi:number):number {
  for(let seed=0;seed<2000000;seed++){
    const a=nextRandom(seed),b=nextRandom(a.state),c=nextRandom(b.state);
    const first=Math.floor(b.word*10000/2**32),triple=Math.floor(c.word*10000/2**32);
    if(first>=9000&&triple>=lo&&triple<hi)return seed;
  }
  throw Error('seed');
}
function advance(initial:CombatState,count:number){
  let state=initial;const events:CombatEvent[]=[];
  for(let i=0;i<count&&state.status==='running';i++){const next=stepCombat(state);state=next.state;events.push(...next.events);}
  return {state,events};
}
const damage=(events:readonly CombatEvent[],target='e')=>events.flatMap(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='p'&&e.outcome.context.targetId===target?[e.outcome.raw]:[]);
const outcome=(events:readonly CombatEvent[])=>events.find(e=>e.type==='castOutcome');
/** The spell lands when the slot machine stops (G24-SEVIKA-SLOTS-01). */
const SLOT=25;

describe('Sevika High Roller Triple (AD100/AP100, 1 star)',()=>{
  it('Blue Flamethrower grows 20% per second of channel',()=>{
    const r=advance(freeze(battle([hero(),dummy()],{rngState:seedFor(0,4000)})),41+SLOT);
    expect(outcome(r.events)).toMatchObject({outcome:'blue-flamethrower',castVariant:{move:'flamethrower',enhanced:true}});
    expect(damage(r.events)).toEqual([260,312,364]);
  });
  it('Knockout Punch adds 400% AD to the punched target',()=>{
    // Sevika's punch (11-24, window only): the fist lands SEVIKA_PUNCH_HIT_TICKS after the slot machine stops.
    const r=advance(freeze(battle([hero(),dummy()],{rngState:seedFor(4000,7500)})),1+SLOT+SEVIKA_PUNCH_HIT_TICKS);
    expect(outcome(r.events)).toMatchObject({outcome:'knockout-punch',castVariant:{move:'punch'}});
    expect(damage(r.events)).toEqual([780,400,338]);
  });
  it('Quadruple Chomp bites four times and bleeds 400% AD over 5 seconds',()=>{
    const r=advance(freeze(battle([hero(),dummy()],{rngState:seedFor(7500,9950)})),101+SLOT);
    expect(outcome(r.events)).toMatchObject({outcome:'quadruple-chomp',castVariant:{move:'chomp'}});
    expect(damage(r.events)).toEqual([832,832,832,832,80,80,80,80,80]);
  });
  it('Jackpot casts no spell: six 250% AD + 20% AP coins over 1.5 s, no rockets, shield or gold',()=>{
    const r=advance(freeze(battle([hero(),dummy()],{rngState:seedFor(9950,10000)})),31+SLOT);
    expect(outcome(r.events)).toMatchObject({outcome:'jackpot',castVariant:{move:'jackpot',channelTicks:0,enhanced:true}});
    expect(damage(r.events)).toEqual([270,270,270,270,270,270]);
    const p=r.state.units.find(u=>u.id==='p')!;
    expect(p.g23?.highRoller).toEqual([expect.objectContaining({mod:'jackpot',spell:3,gold:0})]);
    expect(p.shieldLayers??[]).toEqual([]);
  });
  it('rolls at the pull and lands the spell only when the slot machine stops, standing still meanwhile',()=>{
    // Sevika's punch (11-24, scene change): the punch now lands after the stop (see below), so this check of the stop itself uses
    // the chomp, which still lands on the stop (was the knockout punch: [780, 400, 338] on the stop).
    const start=freeze(battle([hero(),dummy()],{rngState:seedFor(7500,9950)}));
    const waiting=advance(start,SLOT);
    expect(outcome(waiting.events)).toMatchObject({outcome:'quadruple-chomp'});
    expect(damage(waiting.events)).toEqual([]);
    expect(waiting.events.some(e=>e.type==='attack'&&e.attackerId==='p')).toBe(false);
    expect(waiting.state.units.find(u=>u.id==='p')!.tasks).toEqual([expect.objectContaining({kind:'g23Roll',targetId:'e'})]);
    expect(damage(advance(waiting.state,1).events)).toEqual([832,832,832,832]);
  });
});

// Sevika's punch (11-24, authorization ②, timing only; docs/S13_RULES_GAP.md 塞薇卡重拳): the slot machine stops SLOT ticks after
// the cast with a display marker naming the coming hit tick; the punch's damage, knock-back, leap, area damage and stun settle
// together SEVIKA_PUNCH_HIT_TICKS later, and she stands still until then.
describe('Sevika punch lands on the fist hit, after the slot machine stops', () => {
  const punch = () => freeze(battle([hero(), dummy('e', { cell: { col: 1, row: 1 } })], { rngState: seedFor(4000, 7500) }));
  it('the stop shows the coming hit tick; nothing of the punch settles before it; everything settles on it', () => {
    const start = punch(), cast = start.tick + 1;
    const toStop = advance(start, SLOT + 1), stop = cast + SLOT, hitTick = stop + SEVIKA_PUNCH_HIT_TICKS;
    expect(toStop.events.filter(e => e.type === 'abilityMarker')).toEqual([
      { type: 'abilityMarker', tick: stop, unitId: 'p', marker: 'sevika-punch-thrown', cell: { col: 1, row: 1 }, arrivalTick: hitTick },
    ]);
    expect(damage(toStop.events)).toEqual([]);
    const before = advance(toStop.state, SEVIKA_PUNCH_HIT_TICKS - 1);
    expect(damage(before.events)).toEqual([]);
    expect(before.events.filter(e => e.type === 'movement')).toEqual([]);
    expect(before.state.units.find(u => u.id === 'p')!.cell).toEqual({ col: 1, row: 3 });
    const hit = advance(before.state, 1);
    expect(hit.state.tick).toBe(hitTick);
    expect(damage(hit.events)).toEqual([780, 400, 338]);
    expect(hit.events.some(e => e.type === 'movement' && (e as { reason?: string }).reason === 'sevika-knockback')).toBe(true);
    expect(hit.events.some(e => e.type === 'movement' && e.unitId === 'p')).toBe(true);
  });
  // Between the stop and the hit (fitted, not original: as the slot task already did): a stun on her does not stop the fist;
  // her death does; a target that died first is replaced by the enemy nearest to her.
  it('stunned between the stop and the hit: the punch still lands on the hit tick', () => {
    const stop = advance(punch(), SLOT + 1);
    const stunned = structuredClone(stop.state), p = stunned.units.find(u => u.id === 'p')! as S13Unit;
    applyStatus(p, origin(stunned.units.find(u => u.id === 'e')! as S13Unit), 'stun', 0, 30, stunned.tick, [], true);
    const hit = advance(stunned, SEVIKA_PUNCH_HIT_TICKS);
    expect(damage(hit.events)).toEqual([780, 400, 338]);
  });
  it('dead between the stop and the hit: the punch does not settle', () => {
    const stop = advance(punch(), SLOT + 1);
    const dead = { ...stop.state, units: stop.state.units.map(u => u.id === 'p' ? { ...u, hp: 0 } : u) };
    expect(damage(advance(dead, SEVIKA_PUNCH_HIT_TICKS).events)).toEqual([]);
  });
  it('the target dead before the hit: the fist lands on the enemy nearest to her', () => {
    const stop = advance(punch(), SLOT + 1);
    // Another enemy stands next to her once the slot machine has stopped; the punched target dies before the fist lands.
    const other = dummy('f', { cell: { col: 2, row: 3 } }) as typeof stop.state.units[number];
    const gone = { ...stop.state, units: [...stop.state.units.map(u => u.id === 'e' ? { ...u, hp: 0, alive: false } : u), other] };
    const hit = advance(gone, SEVIKA_PUNCH_HIT_TICKS);
    expect(damage(hit.events, 'e')).toEqual([]);
    expect(damage(hit.events, 'f').slice(0, 2)).toEqual([780, 400]);
  });
});

// The punch timing changes battle results, so its rule identifier is part of the content digest: a save written under the digest
// just before it (Violet's combo v2) is turned away as another version, never replayed under the new rule.
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { M8_VERSION } from '../src/simulation/m8/version';
import { readyMatch } from './match-helpers';
const BEFORE_DIGEST = 'fnv1a32-utf16:8bb37864';
describe('Sevika punch: files written before it', () => {
  it('the rule has its own identifier and the digest moved', () => {
    expect(S13_COMBAT_RULES.sevikaPunch).toBe('sevika-punch-lands-on-fist-hit-after-slot-stop-v1');
    expect(CONTENT_DIGEST).not.toBe(BEFORE_DIGEST);
  });
  it('a save carrying the earlier digest is rejected as another version, cannot resume or replay, and its archive is quarantined', () => {
    const file = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
      runId: 'before-sevika-punch', createdAt: '2026-11-24T00:00:00Z', match: { ...readyMatch(42), contentDigest: BEFORE_DIGEST }, battles: [], currentBattle: null };
    expect(readCompatibility(file)).toEqual({ status: 'rejected', currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion: M8_VERSION.rulesVersion,
      canResume: false, canReplay: false, canExportOriginal: false, reason: 'digest-mismatch' });
    expect(routeSaveFile(file).envelope).toBeNull();
    const admission = admitArchives([file], routeSaveFile);
    expect(admission.records).toEqual([]);
    expect(admission.quarantined.map(q => q.runId)).toEqual(['before-sevika-punch']);
    const state = JSON.parse(serializeMatch(readyMatch(42)));
    expect(() => restoreMatch(JSON.stringify({ ...state, contentDigest: BEFORE_DIGEST }))).toThrow('content-digest');
  });
});
