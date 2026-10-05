import {describe,expect,it} from 'vitest';
import {createMatch,startMatchCombat} from '../src/simulation/match';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import {accepted,readyMatch,finish} from './match-helpers';
import type {MatchState} from '../src/simulation/match-types';
const copy=(s:MatchState):any=>JSON.parse(JSON.stringify(s));
describe('schema5 rejects corrupted domain state without replaying side effects',()=>{
 it.each([
  ['old schema',(s:any)=>{s.schemaVersion=4;s.rulesVersion='m4-v1';s.contentVersion='m4-slice-v1';}],
  ['unknown digest',(s:any)=>{s.contentDigest='other';}],['protocol',(s:any)=>{s.commandProtocolVersion=1;}],
  ['RNG float',(s:any)=>{s.battleSeedRngState=1.5;}],['gold negative',(s:any)=>{s.gold=-1;}],['unbounded XP',(s:any)=>{s.xp=999;}],
  ['unknown round',(s:any)=>{s.roundDefinitionId='1-1';}],['streak',(s:any)=>{s.streak={kind:'win',count:5};}],
  ['fake progress',(s:any)=>{s.augmentProgress.investmentHp=800;}],['shop lock',(s:any)=>{s.shop.locked='true';}],
  ['shop wrapper',(s:any)=>{s.shop.slots[0].definitionId=['irelia'];}],['unit wrapper',(s:any)=>{s.preparation.units[0].definitionId={id:'irelia'};}],
  ['legacy unit',(s:any)=>{s.preparation.units[0].definitionId='sentinel';}],['enemy serial',(s:any)=>{s.preparation.units.find((u:any)=>u.team==='enemy').id='unit-4';}],
  ['duplicate unit',(s:any)=>{s.preparation.units.push(s.preparation.units[0]);}],['item wrapper',(s:any)=>{s.items[0].definitionId=['belt'];}],
  ['duplicate item',(s:any)=>{s.items.push(s.items[0]);}],['duplicate receipt',(s:any)=>{s.scheduleReceipts.push(s.scheduleReceipts[0]);}],
  ['invented acquisition gold',(s:any)=>{s.scheduleReceipts[0].gold=999;}],['unknown augment',(s:any)=>{s.augments[0].definitionId='__proto__';}],
 ] as const)('rejects %s',(_label,mutate)=>{
  const original=readyMatch(),invalid=copy(original);mutate(invalid);expect(()=>restoreMatch(invalid)).toThrow();expect(restoreMatch(serializeMatch(original))).toEqual(original);
 });
 it.each([['duplicate offers',(s:any)=>{s.pendingChoice.offers[1]=s.pendingChoice.offers[0];}],['invalid choice kind',(s:any)=>{s.pendingChoice.kind='surprise';}],['foreign offer',(s:any)=>{s.pendingChoice.offers[0]='deathblade';}],['stale choice',(s:any)=>{s.pendingChoice.generation=1;}] ] as const)('rejects %s',(_label,mutate)=>{const s=copy(createMatch());mutate(s);expect(()=>restoreMatch(s)).toThrow();});
 it('rejects forged early game over even if its finished battle and history are internally consistent',()=>{
  const settled=finish(accepted(startMatchCombat(readyMatch())));expect(settled.playerHp).toBeGreaterThan(0);
  expect(()=>restoreMatch({...settled,phase:'gameOver',outcome:'defeat'})).toThrow('terminal boundary');
 });
 it.each([
  ['base AD',(s:any)=>{s.combat.units[0].attackDamageBase++;}],['runtime stat',(s:any)=>{s.combat.units[0].runtime.attackSpeedBps=-1;}],
  ['unknown source',(s:any)=>{s.combat.units[0].mechanics.push({source:{ownerId:'alien',sourceKind:'ability',definitionId:'fake',instanceId:'fake',effectIndex:0},mechanic:'artillery',values:{}});}],
  ['finished running',(s:any)=>{s.combat.tick=1200;}],['self target',(s:any)=>{s.combat.units[0].targetId=s.combat.units[0].id;}],
  ['wrong RNG',(s:any)=>{s.combat.rngState=-1;}],['negative seq',(s:any)=>{s.combat.nextActionSeq=-1;}],
 ] as const)('rejects combat %s',(_label,mutate)=>{const s=copy(accepted(startMatchCombat(readyMatch())));mutate(s);expect(()=>restoreMatch(s)).toThrow();});
 it('makes an isolated restore and does not issue a new choice, RNG draw or receipt',()=>{
  const original=createMatch(),restored=restoreMatch(serializeMatch(original));expect(restored).toEqual(original);expect(restored).not.toBe(original);expect(restored.pendingChoice).not.toBe(original.pendingChoice);
 });
});
