import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { toCombatViewEvents } from '../src/simulation/combat-replay-view';
import { createBatch2VfxBridge, batch2BoardPoint } from '../src/rendering/three-mode/vfx-ltk/batch2-bridge';
import { createVfxLibrary, parseIndex } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import type { LtkPlayOptions } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { readEmissionMesh } from '../src/rendering/three-mode/vfx-ltk/assets/emissionMesh';
import { Rng } from '../src/rendering/three-mode/vfx-ltk/engine/utils/Rng';
import { jayceSkills } from '../src/rendering/three-mode/vfx-ltk/champions/jayce';
import { sevikaSkills } from '../src/rendering/three-mode/vfx-ltk/champions/sevika';
import { viktorSkills } from '../src/rendering/three-mode/vfx-ltk/champions/viktor';
import { jinxSkills } from '../src/rendering/three-mode/vfx-ltk/champions/jinx';
import { melSkills } from '../src/rendering/three-mode/vfx-ltk/champions/mel';
import { warwickSkills } from '../src/rendering/three-mode/vfx-ltk/champions/warwick';
import { binaryFixture } from './vfx-ltk-binary-fixture';
import { syntheticSystem } from './vfx-ltk-synthetic';

const profiles = { ...jayceSkills, ...sevikaSkills, ...viktorSkills, ...jinxSkills, ...melSkills, ...warwickSkills };
const board = { columns: 7, rows: 8, hexRadius: 34, origin: { x: 10, y: 20 } };
const point = batch2BoardPoint(board)!;
const cast = (sourceId: string, actionSeq = 1, tick = 0): Extract<DisplayCombatEvent,{type:'cast'}> => ({
  type: 'cast', eventSeq: 1, tick, sourceId, actionSeq, targetIds: ['target'], completed: true, actualManaSpent: 0, refundedMana: 0, completionCell: { col: 0, row: 0 },
});
/** Viktor's own storm packet. Equipment, rays and untagged magic must not use this shape. */
const stormDamage = (tick = 40): Extract<DisplayCombatEvent, { type: 'packetDamage' }> => ({
  type: 'packetDamage', eventSeq: tick + 1, tick, sourceId: 'v', targetId: 'target', damageType: 'magic',
  sourceKind: 'ability', definitionId: 'viktor-ability', delivery: 'ability-direct',
  hit: true, hpDamage: 100, absorbed: 0, critical: false, killingPacket: false,
});
function bridge(champion: string, form: 'front' | 'back' = 'front') {
  const play = vi.fn((_champion: string, _source: string, _targets: readonly string[], _index: number, _action: 'cast' | 'attack', _context: LtkPlayOptions) => true);
  const host = { unit: (_id: string) => ({ definitionId: champion, form, alive: true, starLevel: 1 }), board: () => board, play };
  return { bridge: createBatch2VfxBridge(host), play };
}
describe('batch 2 exact display stages', () => {
  it('keeps every explicit profile within the existing twelve-cue gate and rejects a thirteenth', () => {
    const systems = Object.fromEntries(Object.values(profiles).flatMap(c => c.map(x => [x.system, 'system.json'])));
    // Per-champion indices have their own resource limits; this synthetic catalogue only needs cue validation.
    for (const [name,cues] of Object.entries(profiles)) {
      expect(cues.length).toBeLessThanOrEqual(12);
      expect(() => parseIndex({ version: 1, systems: Object.fromEntries(cues.map(c => [c.system, systems[c.system]])), assets: {}, skills: { [name]: cues } })).not.toThrow();
    }
    expect(() => parseIndex({ version: 1, systems: { a: 'a.json' }, assets: {}, skills: { jinx: Array(13).fill({system:'a',event:'cast-start',delay:0,duration:1}) } })).toThrow('skill');
  });
  it('selects Jayce form and Forge recipients from the action slice, without choosing allies itself', () => {
    for (const form of ['front','back'] as const) {
      const { bridge: b, play } = bridge('jayce',form), c = cast('j');
      b.begin([c, {type:'statusChanged',eventSeq:2,tick:0,targetId:'ally',kind:'stat-buff',effectiveMagnitudeBps:1000,reason:'applied'}]);
      b.action('cast','j',['target'],0,c);
      expect(play.mock.calls[0]?.[5]).toMatchObject({skill:`jayce-${form}`});
      if (form === 'back') expect(play.mock.calls[1]).toMatchObject(['jayce','j:g23-forge',['ally'],0,'cast',{skill:'jayce-forge-back'}]);
      else expect(play).toHaveBeenCalledTimes(1);
    }
  });
  it.each(['flamethrower','punch','chomp'] as const)('selects Sevika %s from a later outcome in the batch, including animation branch', move => {
    const { bridge: b, play } = bridge('sevika'), c = cast('s',42);
    const outcome: DisplayCombatEvent = {type:'castOutcome',eventSeq:2,tick:0,unitId:'s',abilityKey:'sevika-ability',outcome:'none',subOutcomes:[],castVariant:{actionSeq:42,move,channelTicks:40,enhanced:false,heroAugmentIds:[]}};
    b.begin([c,outcome]); b.action('cast','s',['target'],7,c);
    expect(play.mock.calls[0]?.[5]).toMatchObject({skill:`sevika-${move}`});
    expect(play.mock.calls[0]?.[5].channelSeconds).toBe(move === 'flamethrower' ? 2 : undefined);
    expect(b.branch(c)).toBe(({flamethrower:'one',punch:'two',chomp:'three'} as Record<string,string>)[move]);
    expect(play).toHaveBeenCalledTimes(1);
    b.begin([c]); expect(b.action('cast','s',['target'],8,c)).toBe(false);
  });
  it('adds jackpot only for its own cast outcome and keeps it out of other branches', () => {
    const { bridge: b, play } = bridge('sevika'), c = cast('s');
    b.begin([c,{type:'castOutcome',eventSeq:2,tick:0,unitId:'s',abilityKey:'sevika-ability',outcome:'jackpot',subOutcomes:[],castVariant:{actionSeq:1,move:'punch',channelTicks:0,enhanced:true,heroAugmentIds:[]}}]);
    b.action('cast','s',['target'],0,c);
    expect(play.mock.calls.map(x=>x[5].skill)).toEqual(['sevika-punch','sevika-jackpot']); expect(b.branch(c)).toBe('four');
  });
  it('maps Jinx W/E/R and central R without making the first enemy its landing point', () => {
    const w = mapSkillTimeline(jinxSkills.jinx.filter(c=>!c.action),'j',['a','b','c'],0,point);
    expect(w.spawns.some(c=>c.system==='40140250')).toBe(true);
    const e = mapSkillTimeline(jinxSkills.jinx,'j',['a','b','c','d'],1,point);
    expect(e.spawns.filter(c=>c.system==='9bd80364').map(c=>c.targetId)).toEqual(['a','b','c']);
    const r = mapSkillTimeline(jinxSkills.jinx.filter(c=>!c.action),'j',['a','b'],2,point);
    expect(r.spawns.filter(c=>c.location==='board')).toHaveLength(2);
    expect(r.spawns.find(c=>c.system==='809da1b1')).toMatchObject({point});
    expect(r.spawns.find(c=>c.system==='809da1b1')?.targetId).toBeUndefined();
    expect(mapSkillTimeline(jinxSkills.jinx,'j',['a'],2).unsupported.map(c=>c.reason)).toContain('missing-point');
  });
  it('distinguishes Mel normal/third cast, throttles energy only within the same tick, and keeps confirmed save independent of a living caster', () => {
    const {bridge:b,play}=bridge('mel');
    for (let i=0;i<4;i++) b.action('cast','m',['target'],i);
    expect(play.mock.calls.map(c=>c[5].skill)).toEqual(['mel','mel','mel-third','mel']);
    play.mockClear();
    for (const tick of [1,1,2]) b.event({type:'melEnergyChanged',eventSeq:1,tick,unitId:'m',before:0,after:10},true);
    expect(play).toHaveBeenCalledTimes(2); b.save('battle'); expect(play.mock.calls[2]?.[5]).toMatchObject({skill:'mel-save',board:point});
    b.clear(); b.event({type:'melEnergyChanged',eventSeq:1,tick:2,unitId:'m',before:0,after:10},true); expect(play).toHaveBeenCalledTimes(4);
  });
  it('uses a Warwick self buff at cast and a snapshotted victim only after a devoured receipt', () => {
    expect(mapSkillTimeline(warwickSkills.warwick.filter(c=>!c.action),'w',['w']).unsupported).toEqual([]);
    const {bridge:b,play}=bridge('warwick');
    b.event({type:'devoured',eventSeq:2,tick:1,unitId:'w',targetId:'dead'},false); expect(play).not.toHaveBeenCalled();
    b.event({type:'devoured',eventSeq:2,tick:1,unitId:'w',targetId:'dead'},true);
    expect(play.mock.calls[0]?.[5]).toMatchObject({skill:'warwick-devour',snapshotTargets:true});
  });
  it('starts Viktor full-board slam from the later ability packet and does not mistake an attack tick for it', () => {
    const {bridge:b,play}=bridge('viktor'), c=cast('v');
    b.begin([c]);b.event(c,true);b.action('cast','v',['target'],0,c);play.mockClear();
    const damage = stormDamage();
    b.begin([{type:'attack',eventSeq:1,tick:40,attackerId:'v',targetId:'target'},damage]);b.event(damage,true);expect(play).not.toHaveBeenCalled();
    b.begin([{...damage,tick:60}]);b.event({...damage,tick:60},true);
    expect(play.mock.calls[0]?.[5]).toMatchObject({skill:'viktor-slam',board:point});
    b.event({...damage,tick:61},true);expect(play).toHaveBeenCalledTimes(1);
  });
  it('does not consume Viktor pending storm on true burn, physical damage, another source or an unrelated target', () => {
    const { bridge: b, play } = bridge('viktor'), c = cast('v');
    b.begin([c]); b.event(c, true);
    const damage = stormDamage();
    const unrelated: DisplayCombatEvent[] = [
      { ...damage, tick: 1, damageType: 'true' },
      { ...damage, tick: 2, damageType: 'physical' },
      { ...damage, tick: 3, sourceId: 'other' },
      { ...damage, tick: 4, targetId: 'not-in-cast' },
    ];
    b.begin(unrelated);
    for (const event of unrelated) b.event(event, true);
    expect(play).not.toHaveBeenCalled();
    b.begin([damage]); b.event(damage, true);
    expect(play).toHaveBeenCalledTimes(1);
    expect(play.mock.calls[0]?.[5].skill).toBe('viktor-slam');
    b.event({ ...damage, targetId: 'target', tick: 41 }, true);
    expect(play).toHaveBeenCalledTimes(1);
  });
  it('observes old casts without action playback and consumes old landings without replaying them later', () => {
    const { bridge: b, play } = bridge('viktor'), c = cast('v'), damage = stormDamage();
    b.begin([c, damage]); b.event(c, false); b.event(damage, true);
    expect(play.mock.calls.map(call => call[5].skill)).toEqual(['viktor-slam']);
    play.mockClear(); b.clear();
    b.begin([c]); b.event(c, false);
    b.begin([damage]); b.event(damage, false);
    b.begin([{ ...damage, tick: 80 }]); b.event({ ...damage, tick: 80 }, true);
    expect(play).not.toHaveBeenCalled();
    b.begin([cast('v', 2, 81)]); b.event(cast('v', 2, 81), false);
    b.begin([stormDamage(121)]); b.event(stormDamage(121), true);
    expect(play).toHaveBeenCalledTimes(1);
  });
  it('ignores Deathfire magic, death-ray magic and untagged magic, then plays the ability packet once', () => {
    const { bridge: b, play } = bridge('viktor'), c = cast('v', 1, 241);
    b.begin([c]); b.event(c, true);
    const earlier: DisplayCombatEvent[] = [
      { ...stormDamage(250), delivery: 'basic-attack' },
      { ...stormDamage(260), sourceKind: 'item', definitionId: 'TFT9_Item_OrnnDeathfireGrasp', delivery: 'equipment-proc' },
      { type: 'packetDamage', eventSeq: 9, tick: 270, sourceId: 'v', targetId: 'target', damageType: 'magic', hit: true, hpDamage: 40, absorbed: 0, critical: false, killingPacket: false },
    ];
    for (const event of earlier) { b.begin([event]); b.event(event, true); }
    expect(play).not.toHaveBeenCalled();
    b.begin([stormDamage(281)]); b.event(stormDamage(281), true);
    expect(play).toHaveBeenCalledTimes(1);
    expect(play.mock.calls[0]?.[5].skill).toBe('viktor-slam');
    b.begin([stormDamage(282)]); b.event(stormDamage(282), true);
    expect(play).toHaveBeenCalledTimes(1);
  });
  it('still requests surviving target hits when Viktor is dead or already gone', () => {
    const units = new Map<string, { definitionId: string; form: 'front'; alive: boolean; starLevel: number }>([
      ['v', { definitionId: 'viktor', form: 'front', alive: true, starLevel: 3 }],
      ['target', { definitionId: 'dummy', form: 'front', alive: true, starLevel: 1 }],
    ]);
    const play = vi.fn((_champion: string, _source: string, _targets: readonly string[], _index: number, _action: 'cast' | 'attack', _context: LtkPlayOptions) => true);
    const b = createBatch2VfxBridge({ unit: id => units.get(id), board: () => board, play });
    const c = { ...cast('v', 1, 241), targetIds: ['target'] };
    b.begin([c]); b.event(c, false);
    units.get('v')!.alive = false;
    b.begin([stormDamage(281)]); b.event(stormDamage(281), true);
    expect(play.mock.calls[0]).toMatchObject(['viktor', 'v', ['target'], 0, 'cast', { skill: 'viktor-slam-3star', boardOnly: false }]);
    play.mockClear(); b.clear();
    units.set('v', { definitionId: 'viktor', form: 'front', alive: true, starLevel: 3 });
    b.begin([c]); b.event(c, false);
    units.delete('v');
    b.begin([stormDamage(281)]); b.event(stormDamage(281), true);
    expect(play.mock.calls[0]?.[2]).toEqual(['target']);
    expect(play.mock.calls[0]?.[5]).toMatchObject({ skill: 'viktor-slam-3star', boardOnly: false });
  });
  it('projects ability-versus-item packet tags and leaves the rest of the source off the view', () => {
    const event = { domain: 'combat', combatId: 'c', eventSeq: 8, tick: 281, type: 'packetDamage' as const, outcome: {
      context: { source: { ownerId: 'v', sourceKind: 'ability' as const, definitionId: 'viktor-ability', instanceId: 'secret-instance', effectIndex: 4, parentItemInstanceId: null },
        targetId: 'target', damageType: 'magic' as const, delivery: 'ability-direct' as const, packetId: 'SECRET', permissions: ['do-not-send'],
        actionSeq: 1, rootActionSeq: 1, parentPacketId: null, triggeringCastActionSeq: 1, packetOrdinal: 2, equipmentDepth: 0 as const, redirected: false, area: true, critEligibility: 'never' as const },
      hit: true, hpDamage: 10, absorbed: 1, critical: false, killingPacket: false, raw: 10, prevented: 0, mitigated: 0, overkill: 0 } };
    const [view] = toCombatViewEvents([event as never]);
    expect(view).toEqual({ type: 'packetDamage', tick: 281, eventSeq: 8, sourceId: 'v', targetId: 'target', damageType: 'magic',
      sourceKind: 'ability', definitionId: 'viktor-ability', delivery: 'ability-direct', hit: true, hpDamage: 10, absorbed: 1, critical: false, killingPacket: false });
    expect(JSON.stringify(view)).not.toMatch(/SECRET|do-not-send|secret-instance|parentItem/);
  });
  it('does not register future casts before earlier damage and clears pending storms between battles', () => {
    const { bridge: b, play } = bridge('viktor'), c = cast('v'), damage = stormDamage();
    b.begin([damage, c]); b.event(damage, true); expect(play).not.toHaveBeenCalled();
    b.event(c, false); b.clear();
    b.begin([damage]); b.event(damage, true); expect(play).not.toHaveBeenCalled();
  });
});

describe('batch 2 runtime boundaries', () => {
  it.each([1, 3])('plays Viktor %i-star landing with surviving receipt targets and retains the board layer when none survive', async starLevel => {
    const skills = viktorSkills, systems = Object.fromEntries(Object.values(skills).flatMap(c => c.map(x => [x.system, 'a.json'])));
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
      ? { version: 1, systems, assets: { 'synthetic.tex': 'a.png' }, skills } : syntheticSystem(), readTexture: async () => new Texture() });
    const unit = (alive: boolean, disposed = false) => ({ root: new Group(), body: null, alive, disposed, definitionId: 'viktor', form: 'front' as const, starLevel });
    const units = new Map([['v', unit(true)], ['dead', unit(false)], ['target', unit(true)], ['disposed', unit(true, true)]]);
    const scene = new Scene(), runtime = createLtkRuntime(library, scene, id => units.get(id));
    const play = vi.fn(runtime.play), b = createBatch2VfxBridge({ unit: id => units.get(id), board: () => board, play });
    const c = { ...cast('v'), targetIds: ['dead', 'target', 'missing', 'disposed'] };
    const skill = starLevel >= 3 ? 'viktor-slam-3star' : 'viktor-slam';
    const boardSystem = starLevel >= 3 ? 'efdd9461' : 'c4ef93f3';
    await runtime.warm('viktor');
    // Default runtime atomicity stays intact for callers that pass an invalid target.
    expect(runtime.play('viktor', 'v', c.targetIds, 0, 'cast', { skill, board: point })).toBe(false);
    expect(runtime.queued).toBe(0);
    b.begin([c]); b.event(c, false);
    b.begin([stormDamage()]); b.event(stormDamage(), true);
    expect(play.mock.calls[0]?.[2]).toEqual(['target']);
    expect(play.mock.results[0]?.value).toBe(true); expect(runtime.queued).toBe(2);
    runtime.update(.01, new Camera());
    expect(scene.children.map(child => child.userData.ltkSystem).sort()).toEqual(['607d7b6b', boardSystem].sort());
    runtime.clear(); units.get('target')!.alive = false; play.mockClear();
    b.begin([c]); b.event(c, false);
    b.begin([stormDamage()]); b.event(stormDamage(), true);
    expect(play.mock.calls[0]?.[2]).toEqual([]);
    expect(play.mock.calls[0]?.[5]).toMatchObject({ skill, boardOnly: true });
    expect(play.mock.results[0]?.value).toBe(true); expect(runtime.queued).toBe(1);
    runtime.update(.01, new Camera());
    expect(scene.children.map(child => child.userData.ltkSystem)).toEqual([boardSystem]);
    runtime.dispose(); expect(runtime.active).toBe(0); expect(runtime.queued).toBe(0);
  });
  it('keeps Viktor slam board and target hits after the caster dies, and still rejects a caster-bound cast', async () => {
    const skills = viktorSkills, systems = Object.fromEntries(Object.values(skills).flatMap(c => c.map(x => [x.system, 'a.json'])));
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
      ? { version: 1, systems, assets: { 'synthetic.tex': 'a.png' }, skills } : syntheticSystem(), readTexture: async () => new Texture() });
    const unit = (alive: boolean) => ({ root: new Group(), body: null, alive, definitionId: 'viktor', form: 'front' as const, starLevel: 1 as const });
    const units = new Map([['v', unit(true)], ['target', unit(true)]]);
    const scene = new Scene(), runtime = createLtkRuntime(library, scene, id => units.get(id));
    await runtime.warm('viktor');
    expect(runtime.play('viktor', 'v', ['target'], 0, 'cast', { skill: 'viktor', board: point })).toBe(true);
    runtime.clear();
    units.get('v')!.alive = false;
    expect(runtime.play('viktor', 'v', ['target'], 0, 'cast', { skill: 'viktor', board: point })).toBe(false);
    expect(runtime.queued).toBe(0);
    const play = vi.fn(runtime.play), b = createBatch2VfxBridge({ unit: id => units.get(id), board: () => board, play });
    const c = { ...cast('v', 1, 241), targetIds: ['target'] };
    b.begin([c]); b.event(c, false);
    b.begin([stormDamage(281)]); b.event(stormDamage(281), true);
    expect(play.mock.calls[0]?.[2]).toEqual(['target']);
    expect(play.mock.calls[0]?.[5]).toMatchObject({ skill: 'viktor-slam', boardOnly: false });
    expect(play.mock.results[0]?.value).toBe(true); expect(runtime.queued).toBe(2);
    runtime.stopUnit('v'); expect(runtime.queued).toBe(2);
    runtime.update(.01, new Camera());
    expect(scene.children.map(child => child.userData.ltkSystem).sort()).toEqual(['607d7b6b', 'c4ef93f3'].sort());
    runtime.dispose(); expect(runtime.active).toBe(0); expect(runtime.queued).toBe(0);
  });
  it('keeps original-space mesh births on the triangle, samples deterministically and rejects skin/invalid indices', () => {
    const bytes=binaryFixture('mesh',false), sampler=readEmissionMesh(bytes), a=new Rng(5), b=new Rng(5);
    const out=()=>({position:new Float32Array(3),normal:new Float32Array(3)});
    for(let i=0;i<100;i++) {const x=out(),y=out();sampler.sample(0,a,x);sampler.sample(0,b,y);expect(x).toEqual(y);
      expect([...x.position].every(n=>n>=0&&n<=1)).toBe(true);expect([...x.position].reduce((s,n)=>s+n,0)).toBeCloseTo(1);
      expect(Math.hypot(...x.normal)).toBeCloseTo(1);}
    expect(()=>readEmissionMesh(binaryFixture('mesh',true))).toThrow('static-triangles');
    const broken=bytes.slice(0);new DataView(broken).setUint32(24+36+24,100,true);
    expect(()=>readEmissionMesh(broken)).toThrow('index');
  });
  it('requires a binary mesh and supplies a real sampler to the unchanged simulation', async () => {
    const index={version:1,systems:{a:'a.json'},assets:{'synthetic.tex':'a.png','birth.scb':'a.ltkg'},skills:{viktor:[{system:'a',event:'cast-start',delay:0,duration:1}]}};
    const doc=syntheticSystem({emissionMeshName:{type:'asset',path:'birth.scb',asset:null}});
    const reader={readJson:async(url:string)=>url.endsWith('index.json')?index:doc,readTexture:async()=>new Texture()};
    const missing=createVfxLibrary('/root/',reader);await expect(missing.load('a')).rejects.toThrow('emission-mesh-binary-reader');missing.dispose();
    const library=createVfxLibrary('/root/',{...reader,readBinary:async()=>binaryFixture('mesh',false)});
    const prepared=await library.load('a');expect(prepared.surfaces?.get('')?.get(0)?.mesh).toBeDefined();library.dispose();
  });
  it('allows a board-only save without a caster; snapshots an already dead victim; preserves default dead-target fallback', async () => {
    const skills={mel:melSkills['mel-save'],'mel-save':melSkills['mel-save'],warwick:warwickSkills['warwick-devour'],'warwick-devour':warwickSkills['warwick-devour']};
    const systems=Object.fromEntries(Object.values(skills).flatMap(c=>c.map(x=>[x.system,'a.json'])));
    const library=createVfxLibrary('/root/',{readJson:async url=>url.endsWith('index.json')?{version:1,systems,assets:{'synthetic.tex':'a.png'},skills}:syntheticSystem(),readTexture:async()=>new Texture()});
    const source={root:new Group(),body:null,alive:true},dead={root:new Group(),body:null,alive:false},scene=new Scene(),budget={live:0,max:1500};dead.root.position.set(7,0,9);
    const runtime=createLtkRuntime(library,scene,id=>id==='w'?source:id==='dead'?dead:undefined,{budget});
    await runtime.warm('mel');await runtime.warm('warwick');
    expect(runtime.play('mel','absent',[],0,'cast',{skill:'mel-save',board:point,persistAcrossPhase:true})).toBe(true);
    runtime.clear(true); // Settlement feedback survives the following preparation frame.
    runtime.update(.01,new Camera());expect(runtime.active).toBe(1);
    runtime.clear(true);expect(runtime.active).toBe(1);runtime.clear();expect(runtime.active).toBe(0);
    expect(runtime.play('warwick','w',['dead'],0,'cast',{skill:'warwick-devour'})).toBe(false);
    expect(runtime.play('warwick','w',['dead'],0,'cast',{skill:'warwick-devour',snapshotTargets:true})).toBe(true);
    runtime.stopUnit('dead'); // The next frame reports the victim dead as well.
    runtime.update(.01,new Camera());expect(runtime.active).toBe(2);expect(budget.live).toBe(500);
    runtime.stopUnit('dead');runtime.update(.01,new Camera());expect(runtime.active).toBe(2);
    runtime.clear();expect(budget.live).toBe(0);expect(scene.children).toHaveLength(0);runtime.dispose();
  });
  it('does not let an unavailable different Jinx phase force a prepared phase to legacy', async () => {
    const cues=[{system:'a',phase:0,event:'cast-start',delay:0,duration:1},{system:'b',phase:1,event:'cast-start',delay:0,duration:1}];
    const library=createVfxLibrary('/root/',{readJson:async url=>url.endsWith('index.json')?{version:1,systems:{a:'a.json',b:'missing.json'},assets:{'synthetic.tex':'a.png'},skills:{jinx:cues}}:url.endsWith('missing.json')?Promise.reject(Error('404')):syntheticSystem(),readTexture:async()=>new Texture()});
    const source={root:new Group(),body:null,alive:true},runtime=createLtkRuntime(library,new Scene(),()=>source);
    await runtime.warm('jinx');expect(runtime.play('jinx','j',[],0)).toBe(true);expect(runtime.play('jinx','j',[],1)).toBe(false);runtime.dispose();
  });
});
