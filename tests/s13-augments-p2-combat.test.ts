import { applyStatusContribution } from '../src/simulation/m8/status';
import { effectIdentity } from '../src/simulation/m8/identity';
import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState } from '../src/simulation/combat';
import { readCombatStats } from '../src/simulation/combat-s13';
import { p2Bonus, p2Crit, p2Target, startP2Combat } from '../src/simulation/s13-augments-p2-combat';
import { validateMechanisms } from '../src/simulation/m8/restore';
import { spellCrit, type S13Unit } from '../src/simulation/combat-s13-state';
import type { Unit } from '../src/simulation/unit-types';
import type { ItemInstance } from '../src/simulation/strategy-types';
import { freezeCombatInput } from '../src/simulation/combat-input';
import { createRestoreCombatReplay } from '../src/simulation/restore-combat-replay';
import { validateP2Opening } from '../src/simulation/s13-augments-p2-combat';
import { grantCombatItem } from '../src/simulation/m8/combat-item-grants';
import { G24_CHEST_POOL } from '../src/simulation/content/g2-4-chest-pool';
const unit=(id:string,definitionId='lux',col=0,row=7,team:'player'|'enemy'='player'):Unit=>({id,definitionId,starLevel:1,team,location:{kind:'board',cell:{col,row}}});
const item=(id:string,definitionId:string,unitId='p',slot=0):ItemInstance=>({id,definitionId,location:{kind:'unit',unitId,slot}});
function fixture(ids:string[],players:Unit[]=[unit('p')],items:ItemInstance[]=[],anomaly:string|null=null){
  const base=createMatch(42),preparation={...base.preparation,units:[...players,unit('enemy','garen',6,0,'enemy')]};
  const inputs={...base,preparation,items,temporaryEquipment:[],augments:ids.map((definitionId,i)=>({definitionId,choiceId:`a${i}`,acquiredRound:1})),
    anomalyBinding:anomaly?{definitionId:anomaly,choiceId:'anomaly',unitId:'p',boundRound:1}:null};
  const strategy=buildStrategySnapshot(inputs),state=createCombatWithEvents(preparation,strategy,'p2',42).state;
  return {inputs,strategy,state};
}
const stats=(s:CombatState,id='p')=>readCombatStats(s.units.find(u=>u.id===id)!,s);
const quiet=(s:CombatState):CombatState=>({...s,units:s.units.map(u=>({...u,cooldownTicks:2000,moveCooldownTicks:2000,mana:0,maxMana:0}))});
const advance=(s:CombatState,n:number)=>{for(let i=0;i<n;i++)s=stepCombat(s).state;return s;};
function validate(s:CombatState){for(const u of s.units)validateMechanisms(u,s.units,s.tick,s.combatId!,s.status==='finished',s.nextActionSeq!);}

it.each([['sword-overflow','sword',250],['wand-overflow','rod',250],['belt-overflow','belt',75]] as const)('%s adds the raw bonus per component instance only',(id,component,bonus)=>{
  const worn=[item('i1',component),item('i2',component,'p',1)],plain=fixture([],undefined,worn),buff=fixture([id],undefined,worn);
  if(component==='belt')expect(buff.state.units.find(u=>u.id==='p')!.maxHp-plain.state.units.find(u=>u.id==='p')!.maxHp).toBe(2*bonus);
  else expect(buff.strategy.units.find(u=>u.unitId==='p')!.stats.attackSpeedBonusBps!-plain.strategy.units.find(u=>u.unitId==='p')!.stats.attackSpeedBonusBps!).toBe(2*bonus);
  const inventory=[{...worn[0],location:{kind:'inventory' as const}}];
  expect(fixture([id],undefined,inventory).strategy.units.find(u=>u.unitId==='p')!.stats).toEqual(fixture([],undefined,inventory).strategy.units.find(u=>u.unitId==='p')!.stats);
  expect(fixture([id],undefined,[item('done','bloodthirster')]).strategy.units.find(u=>u.unitId==='p')!.stats).toEqual(fixture([],undefined,[item('done','bloodthirster')]).strategy.units.find(u=>u.unitId==='p')!.stats);
});
it('Crown Guarded doubles each opening shield and adds five seconds without changing its end AP',()=>{
  const s=fixture(['crown-guarded'],undefined,[item('c1','crownguard'),item('c2','crownguard','p',1)]).state,p=s.units.find(u=>u.id==='p')!;
  expect(p.maxHp).toBe(700);expect(p.shield).toBe(700);
  expect(p.shieldLayers!.map(l=>[l.granted,l.expiresAtTick])).toEqual([[350,260],[350,260]]);
  expect(p.shieldLayers!.map(l=>l.m8Grant!.endEffects[0])).toEqual([expect.objectContaining({modifier:expect.objectContaining({value:{kind:'constant',amount:25}})}),expect.objectContaining({modifier:expect.objectContaining({value:{kind:'constant',amount:25}})})]);validate(s);
});
it('Not Today gives an Edge holder 35% opening AS and retains the item survival program',()=>{
  const buff=fixture(['not-today'],undefined,[item('e','edge-of-night')]),plain=fixture([],undefined,[item('e','edge-of-night')]);
  expect(buff.strategy.units.find(u=>u.unitId==='p')!.stats.attackSpeedBonusBps!-plain.strategy.units.find(u=>u.unitId==='p')!.stats.attackSpeedBonusBps!).toBe(3500);
  expect(buff.strategy.units.find(u=>u.unitId==='p')!.itemPrograms!.map(p=>p.program)).toEqual(plain.strategy.units.find(u=>u.unitId==='p')!.itemPrograms!.map(p=>p.program));
});
it.each(['crownguard-spirit','guardbreaker-spirit','shojin-spirit'])('%s grants its team stats to unequipped units',(id)=>{
  const players=[unit('p'),unit('other','darius',6,7)],plain=fixture([],players),buff=fixture([id],players);
  for(const u of players){const a=stats(plain.state,u.id),b=stats(buff.state,u.id),resolved=buff.strategy.units.find(v=>v.unitId===u.id)!;
    if(id==='crownguard-spirit'){expect(b.abilityPower-a.abilityPower).toBe(10);expect(b.armor-a.armor).toBe(10);}
    if(id==='guardbreaker-spirit'){expect(resolved.stats.attackSpeedBonusBps).toBe(800);expect(buff.state.units.find(v=>v.id===u.id)!.spellCrit!.chanceBps).toBe(4500);}
    if(id==='shojin-spirit'){expect(b.attackDamage).toBe(Math.floor(a.attackDamage*1.1));expect(resolved.stats.initialMana-plain.strategy.units.find(v=>v.unitId===u.id)!.stats.initialMana).toBe(10);}
  }
  expect(stats(buff.state,'enemy')).toEqual(stats(plain.state,'enemy'));
});
it('Flurry gives each actual Zeke aura receiver 35% crit per item, with row/range boundaries',()=>{
  const players=[unit('p','lux',0),unit('near','lux',2),unit('far','lux',3),unit('row','lux',0,6)];
  const s=fixture(['flurry-of-blows'],players,[item('z1','TFT_Item_ZekesHerald'),item('z2','TFT_Item_ZekesHerald','p',1)]).state;
  expect(s.units.find(u=>u.id==='p')!.spellCrit!.chanceBps).toBe(9500);expect(s.units.find(u=>u.id==='near')!.spellCrit!.chanceBps).toBe(9500);
  for(const id of ['far','row','enemy'])expect(spellCrit(s.units.find(u=>u.id===id)!).chanceBps).toBe(2500);validate(s);
});
it('Immovable Object changes each Randuin aura to radius two and 48 resists',()=>{
  const players=[unit('p','lux',0),unit('near','lux',2),unit('far','lux',3)],s=fixture(['immovable-object'],players,[item('r1','TFT4_Item_OrnnRanduinsSanctum'),item('r2','TFT4_Item_OrnnRanduinsSanctum','p',1)]).state;
  expect(stats(s,'near').armor).toBe(116);expect(stats(s,'near').magicResist).toBe(116);expect(stats(s,'far').armor).toBe(20);validate(s);
});
it('All For One counts unique deployed one-cost definitions, excluding duplicates and bench',()=>{
  const players=[unit('p'),unit('dup'),unit('one','maddie',1),unit('two','nocturne',2),{...unit('bench','darius'),location:{kind:'bench' as const,slot:0}}];
  const {strategy}=fixture(['all-for-one-ii'],players);
  expect(strategy.units.find(u=>u.unitId==='p')!.stats.health).toBe(530);
  expect(strategy.units.find(u=>u.unitId==='two')!.mechanics!.find(m=>m.mechanic==='damageAmp')!.values.bps).toBe(500);
});
it('Pair of Fours requires exactly two four-cost units, including duplicate definitions',()=>{
  const players=[unit('p','silco'),unit('second','silco',1)],plain=fixture([],players),buff=fixture(['pair-of-fours'],players);
  for(const id of ['p','second']){expect(buff.state.units.find(u=>u.id===id)!.maxHp-plain.state.units.find(u=>u.id===id)!.maxHp).toBe(404);expect(buff.strategy.units.find(u=>u.unitId===id)!.stats.attackSpeedBonusBps!-plain.strategy.units.find(u=>u.unitId===id)!.stats.attackSpeedBonusBps!).toBe(2440);}
  expect(fixture(['pair-of-fours'],[...players,unit('third','twitch',2)]).strategy.units.find(u=>u.unitId==='p')!.stats.health).toBe(plain.strategy.units.find(u=>u.unitId==='p')!.stats.health);
});
it('Calculated Enhancement uses four seeded choices from the back two rows, without replacement',()=>{
  const players=Array.from({length:5},(_,i)=>unit(`p${i}`,'lux',i,6)),front=unit('front','lux',6,5),f=fixture(['calculated-enhancement'],[...players,front]);
  const chosen=f.state.units.filter(u=>u.s13P2Opening?.selected.includes('calculated-enhancement')).map(u=>u.id).sort();
  let rng=42;const pool=players.map(u=>u.id),expected:string[]=[];for(let i=0;i<4;i++){rng=(Math.imul(rng,1664525)+1013904223)>>>0;expected.push(pool.splice(Math.floor(rng*pool.length/4294967296),1)[0]);}
  expect(chosen).toEqual(expected.sort());expect(f.state.rngDraws).toBe(4);expect(f.state.rngState).toBe(rng);
  for(const id of chosen){expect(stats(f.state,id).attackDamage).toBe(40);expect(stats(f.state,id).abilityPower).toBe(140);}
  expect(stats(f.state,'front').abilityPower).toBe(100);validate(f.state);
  expect(stepCombat(JSON.parse(JSON.stringify(f.state)))).toEqual(stepCombat(f.state));
});
it('Trifecta gives all allies 9% AS and exactly three seeded three-costs +330 HP and +24% AS',()=>{
  const players=Array.from({length:4},(_,i)=>unit(`p${i}`,'blitzcrank',i)),plain=fixture([],players),buff=fixture(['trifecta-ii'],players);
  expect(buff.state.rngDraws).toBe(3);expect(buff.state.units.filter(u=>u.s13P2Opening?.selected.includes('trifecta-ii'))).toHaveLength(3);
  for(const u of buff.state.units.filter(u=>u.team==='player')){
    expect(u.maxHp-plain.state.units.find(v=>v.id===u.id)!.maxHp).toBe(u.s13P2Opening?330:0);
    expect(p2Bonus(u,'attackSpeedBps')).toBe(u.s13P2Opening?2400:0);expect(buff.strategy.units.find(v=>v.unitId===u.id)!.stats.attackSpeedBonusBps).toBe(900);
  }validate(buff.state);
});
it('Both random augments consume one shared combat stream after the existing opening, independently per side',()=>{
  const players=Array.from({length:5},(_,i)=>unit(`p${i}`,'blitzcrank',i)),s=fixture(['calculated-enhancement','trifecta-ii'],players).state;
  expect(s.rngDraws).toBe(7);expect(s.units.filter(u=>u.s13P2Opening?.selected.includes('calculated-enhancement'))).toHaveLength(4);expect(s.units.filter(u=>u.s13P2Opening?.selected.includes('trifecta-ii'))).toHaveLength(3);
});
it('Share Your Energy freezes all donors before broadcasting all five stats and never feeds back',()=>{
  const players=[unit('p','lux',0),unit('ally','lux',1),unit('far','lux',4)],plain=fixture([],players),buff=fixture([],players,[],'share-your-energy');
  expect(stats(buff.state,'ally')).toMatchObject({attackDamage:34,abilityPower:115,armor:23,magicResist:23});expect(buff.state.units.find(u=>u.id==='ally')!.maxHp).toBe(575);
  expect(stats(buff.state)).toEqual(stats(plain.state));expect(stats(buff.state,'far')).toEqual(stats(plain.state,'far'));validate(buff.state);
  const units=structuredClone(plain.state.units) as S13Unit[];
  for(const u of units.filter(u=>u.team==='player'&&u.id!=='far'))u.mechanics=[...u.mechanics??[],{mechanic:'s13P2Anomaly',values:{enabled:1},source:{ownerId:u.id,sourceKind:'anomaly',definitionId:'share-your-energy',instanceId:u.id,effectIndex:0}}];
  startP2Combat({tick:0,units,combatId:'p2',board:plain.state.board,events:[],packets:[],heals:[],draw:()=>{throw Error('share must not draw');}});
  for(const u of units.filter(u=>u.team==='player'&&u.id!=='far')){expect(u.maxHp).toBe(575);expect(p2Bonus(u,'attackDamageFlat')).toBe(4);expect(p2Bonus(u,'abilityPower')).toBe(15);}
});
it('Share Your Energy samples the completed seeded enhancement before broadcasting',()=>{
  const {state}=fixture(['calculated-enhancement'],[unit('p'),unit('ally','lux',1)],[],'share-your-energy');
  expect(state.rngDraws).toBe(2);expect(stats(state)).toMatchObject({attackDamage:40,abilityPower:140});
  expect(stats(state,'ally')).toMatchObject({attackDamage:46,abilityPower:161});
  expect(state.units.find(u=>u.id==='ally')!.maxHp).toBe(575);validate(state);
});
it('Stoneskin has 225 opening resists, loses ten each second and floors the bonus at zero',()=>{
  const s=quiet(fixture([],undefined,[],'stoneskin').state);
  expect(stats(s).armor).toBe(245);expect(stats(advance(s,19)).armor).toBe(245);expect(stats(advance(s,20))).toMatchObject({armor:235,magicResist:235});expect(stats(advance(s,440)).armor).toBe(25);expect(stats(advance(s,460)).armor).toBe(20);validate(s);
});
it('Cull The Weak uses target missing-health percentage for crit and retargets in-range at three seconds',()=>{
  const {state}=fixture([],undefined,[],'cull-the-weak'),p=structuredClone(state.units.find(u=>u.id==='p')!) as S13Unit;
  const e=structuredClone(state.units.find(u=>u.id==='enemy')!) as S13Unit;
  p.cell={col:0,row:4};p.attackRange=2;e.cell={col:1,row:4};e.id='high-absolute';e.hp=50;e.maxHp=100;
  const low={...e,id:'low-ratio',cell:{col:2,row:4},hp:100,maxHp:1000};const far={...e,id:'out-of-range',cell:{col:6,row:0},hp:1,maxHp:10000};
  p.targetId=e.id;expect(p2Target(p,[p,e,low,far],59)!.id).toBe(e.id);expect(p2Target(p,[p,e,low,far],60)!.id).toBe(low.id);
  expect(p2Crit(p,e,spellCrit(p)).chanceBps).toBe(7500);expect(p2Crit(p,low,spellCrit(p)).chanceBps).toBe(10000);
  const start={...state,units:[{...p,cooldownTicks:0,moveCooldownTicks:2000,mana:0,maxMana:0}, {...low,cooldownTicks:2000,moveCooldownTicks:2000,mana:0,maxMana:0}]};
  const packets=stepCombat(start).events.filter(e=>e.type==='packetDamage');
  expect(packets.some(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId===p.id&&e.outcome.critical)).toBe(true);
});
it.each(['share-your-energy','cull-the-weak','stoneskin'])('%s opening facts are reconstructed independently and reject fabricated broadcasts',anomaly=>{
  const f=fixture([], [unit('p'),unit('ally','lux',1)],[],anomaly);
  const basis={...freezeCombatInput(f.inputs,42,0),combatId:'p2'},replay=createRestoreCombatReplay(basis,f.strategy,0);
  expect(()=>validateP2Opening(f.state,replay)).not.toThrow();
  const bad=structuredClone(f.state) as any,ally=bad.units.find((u:any)=>u.id==='ally');
  if(ally.s13P2Opening)ally.s13P2Opening.shared[0].attackDamage++;
  else ally.s13P2Opening={selected:['trifecta-ii'],shared:[]};
  expect(()=>validateP2Opening(bad,replay)).toThrow('S13 P2 opening');
});
it.each([['crown-guarded','crownguard'],['not-today','edge-of-night']])('%s also overrides a new Treasure Chest item instance gained during combat',(id,itemId)=>{
  const f=fixture([id]),state=structuredClone(f.state),target=state.units.find(u=>u.id==='p')! as S13Unit;
  const chest={ownerId:'enemy',sourceKind:'item' as const,definitionId:'TFT_Item_UnstableTreasureChest',instanceId:'chest',effectIndex:0,parentItemInstanceId:null};
  const before=stats(state),word=G24_CHEST_POOL.findIndex(p=>p.definitionId===itemId);expect(word).toBeGreaterThanOrEqual(0);
  grantCombatItem({tick:1,combatId:'p2',board:state.board,units:state.units as S13Unit[],events:[],packets:[],heals:[],manaRequests:[],draw:()=>word},chest,target,1);
  if(id==='crown-guarded'){expect(target.maxHp).toBe(600);expect(target.shieldLayers!.at(-1)!.granted).toBe(300);expect(target.shieldLayers!.at(-1)!.expiresAtTick).toBe(261);}
  else expect(stats({...state,tick:1}).attackIntervalTicks).toBeLessThan(before.attackIntervalTicks);
  const granted=target.mechanismDefinitions!.survivalTriggers.filter(t=>t.source.instanceId.startsWith('["chest"'));
  if(id==='not-today')expect(granted.some(t=>t.effects.some(e=>e.kind==='modify-stat'&&e.modifier.stat==='attackSpeed'&&e.modifier.value.kind==='constant'&&e.modifier.value.amount===3500))).toBe(true);
});

it.each(['trifecta-ii','share-your-energy'])('opening %s HP does not rewrite the earlier Crown shield sample',id=>{
  const f=id==='trifecta-ii'
    ? fixture([id],[unit('p','nami')],[item('c','crownguard')])
    : fixture([],[unit('p'),unit('ally','lux',1)],[item('c','crownguard','ally')],id);
  const holder=f.state.units.find(u=>u.id===(id==='trifecta-ii'?'p':'ally'))!;
  expect(holder.maxHp).toBe(id==='trifecta-ii'?1130:675);
  expect(holder.shield).toBe(id==='trifecta-ii'?200:150);
  validate(f.state);validate(JSON.parse(JSON.stringify(f.state)));
  const forged=structuredClone(f.state),bad=forged.units.find(u=>u.id===holder.id)! as any;
  const layer=bad.shieldLayers[0],wrong=Math.floor(bad.maxHp*layer.m8Grant.amount.maxHpBps/10000);
  layer.granted=wrong;layer.remaining=wrong;layer.m8State.granted=wrong;layer.m8State.remaining=wrong;bad.shield=wrong;
  expect(()=>validate(forged)).toThrow('declared shield sampled amount');
});
it('Mirror freezes the Trifecta holder after its +330 opening health',()=>{
  const {state}=fixture(['trifecta-ii'],[unit('p','nami')],[item('m','TFT9_Item_OrnnTrickstersGlass')]);
  const owner=state.units.find(u=>u.id==='p')!,copy=state.units.find(u=>u.itemSummon?.kind==='mirror')!;
  expect(owner.maxHp).toBe(1030);expect(copy.itemSummonOpeningMaxHp).toBe(1030);expect(copy.maxHp).toBe(721);validate(state);
});
it('Share health received by a Mirror retains its 70% summon scaling',()=>{
  // A donor adjacent to the clone, but outside the holder neighbourhood.
  const plain=fixture([],[unit('owner','lux',0),unit('p','lux',2)],[item('m','TFT9_Item_OrnnTrickstersGlass','owner')]);
  const copy=plain.state.units.find(u=>u.itemSummon?.kind==='mirror')!;
  const units=structuredClone(plain.state.units) as S13Unit[],donor=units.find(u=>u.id==='p')!;
  donor.cell={col:copy.cell.col+1,row:copy.cell.row};
  donor.mechanics=[...donor.mechanics??[],{mechanic:'s13P2Anomaly',values:{enabled:1},source:{ownerId:'p',sourceKind:'anomaly',definitionId:'share-your-energy',instanceId:'a',effectIndex:0}}];
  startP2Combat({tick:0,units,combatId:'p2',board:plain.state.board,events:[],packets:[],heals:[],draw:()=>{throw Error('no draw');}});
  const recipient=units.find(u=>u.id===copy.id)!;
  expect(p2Bonus(recipient,'health')).toBe(75);expect(recipient.maxHp).toBe(402);
  validate({...plain.state,units});
});
it('Calculated Enhancement excludes Jayce Forge before the four seeded draws',()=>{
  const {state}=fixture(['calculated-enhancement'],[...Array.from({length:4},(_,i)=>unit(`p${i}`,'lux',i,6)),unit('j','jayce',5,5)]);
  expect(state.units.find(u=>u.id==='j:g23-forge')!.cell).toEqual({col:5,row:6});
  expect(state.units.filter(u=>u.s13P2Opening?.selected.includes('calculated-enhancement')).map(u=>u.id).sort()).toEqual(['p0','p1','p2','p3']);
  expect(state.rngDraws).toBe(4);for(let i=0;i<4;i++)expect(stats(state,`p${i}`).abilityPower).toBe(140);
});
it('Cull breaks equal health ratios by unit ID independently of input order',()=>{
  const {state}=fixture([],undefined,[],'cull-the-weak'),p=structuredClone(state.units.find(u=>u.id==='p')!) as S13Unit;
  p.cell={col:0,row:4};p.attackRange=3;
  const e=state.units.find(u=>u.id==='enemy')!;
  const a={...e,id:'a',cell:{col:1,row:4},hp:100,maxHp:200},z={...e,id:'z',cell:{col:2,row:4},hp:50,maxHp:100};
  for(const targets of [[z,a],[a,z]])expect(p2Target(p,[p,...targets] as S13Unit[],60)!.id).toBe('a');
});
it.each(['stun','channel'] as const)('Cull retargets at tick 60 while %s blocks actions',kind=>{
  const {state}=fixture([],undefined,[],'cull-the-weak'),p=structuredClone(state.units.find(u=>u.id==='p')!) as S13Unit;
  p.cell={col:0,row:4};p.attackRange=3;p.targetId='high';
  const source={ownerId:'enemy',sourceKind:'ability' as const,definitionId:'test-control',instanceId:'control',effectIndex:0,parentItemInstanceId:null};
  if(kind==='stun')p.mechanismState={...p.mechanismState!,statuses:applyStatusContribution([],effectIdentity('p2',source,p.id),{kind:'stun',magnitudeBps:0,activation:'immediate',duration:{kind:'ticks',ticks:3},stackPolicy:{kind:'independent-instances'},removable:true,polarity:'harmful',damageFilter:null,onEnd:null},59).groups};
  else {
    const activity={key:'control',source,targetId:p.id,actionSeq:0,startsAtTick:59,expiresAtTick:62,kind:'channel' as const,blocks:['move','attack','cast'] as const,cancelOnControl:true as const,lifecycle:'active' as const,endedAtTick:null,endReason:null};
    p.mechanismState={...p.mechanismState!,activities:[activity]};
    p.statuses=[{key:'control',source,kind,amount:0,startsAtTick:59,expiresAtTick:62,activity}];
  }
  const e=state.units.find(u=>u.id==='enemy')!;
  const high={...e,id:'high',cell:{col:1,row:4},hp:500,maxHp:1000,cooldownTicks:2000,moveCooldownTicks:2000};
  const low={...high,id:'low',cell:{col:2,row:4},hp:100};
  const result=stepCombat({...state,tick:59,units:[p,high,low]});
  expect(result.state.units.find(u=>u.id==='p')!.targetId).toBe('low');
  expect(result.events.some(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='p')).toBe(false);
});
it('the complete opening keeps a Mirror-only share at 402 HP after final owner freezing',()=>{
  const {state}=fixture([],[unit('owner','lux',0,7),unit('p','lux',0,5)],[item('m','TFT9_Item_OrnnTrickstersGlass','owner')],'share-your-energy');
  const copy=state.units.find(u=>u.itemSummon?.kind==='mirror')!;
  expect(copy.cell).toEqual({col:0,row:6});expect(p2Bonus(copy,'health')).toBe(75);
  expect(state.units.find(u=>u.id==='owner')!.maxHp).toBe(500);
  expect(copy).toMatchObject({maxHp:402,itemSummonOpeningMaxHp:500,maxHpBasis:{base:500,flat:75}});validate(state);
});
it('a Mirror Enforcer shield retains its pre-Trifecta owner health sample',()=>{
  const {state}=fixture(['trifecta-ii'],[unit('p','loris',0,7),unit('m','maddie',5,7)],[item('mirror','TFT9_Item_OrnnTrickstersGlass')]);
  const copy=state.units.find(u=>u.itemSummon?.kind==='mirror')!;
  expect(state.units.find(u=>u.id==='p')!.maxHp).toBe(1180);
  expect(copy.itemSummonOpeningMaxHp).toBe(1180);expect(copy.maxHp).toBe(826);
  expect(copy.shieldLayers![0].granted).toBe(71);validate(state);
});
