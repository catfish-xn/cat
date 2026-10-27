import { expect, it } from 'vitest';
import { augmentGold, benchXp, entryXp, freeRerollCredits } from './fixtures/m5/oracle.g2.cjs';

it('transcribes acquisition gold independently, including seed 3044 Scapegoat', () => {
  for (const [id, amount] of Object.entries({scapegoat:4, 'wandering-trainer-i':1,
    'wandering-trainer-ii':6, 'trade-sector':1, 'shopping-spree':4, kingslayer:1})) {
    expect(augmentGold(id, '2-1')).toBe(amount);
  }
  expect(augmentGold('risky-moves', '2-1')).toBe(0);
  expect(augmentGold('placebo-plus', '3-2')).toBe(18);
});

it('pays Patient Study only for a fought player combat and Epoch only at the next stage entry', () => {
  const state = {round:10, augments:[{definitionId:'epoch', acquiredRound:4},
    {definitionId:'patient-study', acquiredRound:4}], roundResults:[{round:10, roundKind:'pve', result:'playerWin'}]};
  expect(entryXp(state)).toBe(6);
  expect(entryXp({...state, round:9, roundResults:[{round:9, roundKind:'pvp', result:'draw'}]})).toBe(3);
  expect(entryXp({...state, round:9, roundResults:[{round:9, roundKind:'pvp', result:'playerWin'}]})).toBe(2);
  expect(entryXp({...state, round:9, roundResults:[]})).toBe(0);
});

it('accumulates free rerolls from source grants, stage boundaries and every reached level', () => {
  const state = {round:11, level:6, seatMechanics:{seat:{'augment-acquisition-levels':{shop:3, mobility:4}}},
    augments:[{definitionId:'epoch', acquiredRound:4, choiceId:'epoch'},
      {definitionId:'trade-sector', acquiredRound:4, choiceId:'trade'},
      {definitionId:'shopping-spree', acquiredRound:4, choiceId:'shop'},
      {definitionId:'upward-mobility', acquiredRound:4, choiceId:'mobility'}]};
  expect(freeRerollCredits(state)).toBe(4 + 8 + 4 + 5 + 6 + 6);
  expect(freeRerollCredits({...state, level:4})).toBe(4 + 8 + 4);
});

// Hand-written transition vectors: the expected amount/trigger never comes from production.
import { createMatch, rerollShop, deployMatchUnit } from '../src/simulation/match';
import { Ledger, CATALOG, COST, ROUNDS, augmentPool, xp } from './fixtures/m5/oracle.g2.cjs';
import { validateRewards, rewardPlan } from './fixtures/m5/augment-rewards-oracle.cjs';
const env = { CATALOG, COST, ROUNDS, xp, entryXp, benchXp };
const owner = (definitionId: string) => ({definitionId, choiceId:'round:2-1:augment', acquiredRound:4});
function vector(definitionId: string, facts: Record<string, unknown> = {}) {
  const a=owner(definitionId);
  const before={phase:'combat',seed:29,round:5,roundDefinitionId:'2-2',level:4,xp:0,augments:[a],
    preparation:{units:[] as unknown[]},resourceProvenance:{entries:[]},roundResults:[],
    seatMechanics:{receipts:[] as unknown[],seat:{'augment-acquisition-levels':{[a.choiceId]:4}},hidden:{progress:{economyReceipts:[]}}}};
  if(definitionId==='enforce')before.seatMechanics.receipts.push(...['steb','maddie'].map((definitionId,index)=>({receiptId:JSON.stringify(['augment-pool-batch1',a.choiceId,'enforce',index,0]),kind:'unit',source:'augment-pool-batch1',definitionId,unitId:'old-'+index})) as never[]);
  const after=structuredClone(before);after.phase='settlement';after.xp=2;
  const battle={round:5,roundKind:'pvp',result:'loss',alliedDeaths:0,...facts};
  (after.seatMechanics.hidden.progress.economyReceipts as unknown[]).push({kind:'battle',facts:battle});
  return {before,after,a};
}
const gold = (source: string, parts: unknown[], amount: number, round=5) =>
  ({source,receiptId:JSON.stringify([source,'round:2-1:augment',...parts]),kind:'gold',amount,round,roundId:'2-2'});
const done=[{type:'combatFinished'}];
function receipts<T extends { seatMechanics: { receipts: unknown[] } }>(state: T, values: unknown[]) {
  return {...state,seatMechanics:{...state.seatMechanics,receipts:[...state.seatMechanics.receipts,...values]}};
}
it('rejects the review counterexample: fabricated +123 gold without command/event', () => {
  const before=createMatch(29);
  const after={...before,gold:before.gold+123,seatMechanics:{...before.seatMechanics!,receipts:[...before.seatMechanics!.receipts,gold('augment-pool-batch3',[0,0],123) as never]}};
  expect(()=>new Ledger(before).apply(before,after,null,[])).toThrow(/no (?:mechanic )?reward without|independent due/);
});
it.each([
 ['augment-pool-batch2','enforce',{batch2:[{definitionId:'enforce',count:6}]},['enforce',0],6],
 ['augment-pool-batch3','wealthy-rehab-i',{batch3Healing:10000},[0,0],8],
] as const)('%s independently rejects wrong/missing/extra gold receipts', (source,id,facts,parts,amount) => {
  const {before,after}=vector(id,facts), r=gold(source,[...parts],amount);
  expect(()=>validateRewards(before,receipts(after,[r]),null,done,env)).not.toThrow();
  for(const wrong of [[],[r,{...r,receiptId:JSON.stringify([source,'round:2-1:augment',...parts,'extra'])}],[{...r,amount:amount+123}],[{...r,round:4}],[{...r,receiptId:'invented'}]])
    expect(()=>validateRewards(before,receipts(after,wrong),null,done,env)).toThrow(/independent due augment gold/);
  expect(()=>validateRewards(before,receipts(after,[r]),null,[],env)).toThrow(/terminal combat event/);
});
it('does not pay healing gold below threshold, on acquisition, or a second time', () => {
  const {before,after}=vector('wealthy-rehab-i',{batch3Healing:9999}),r=gold('augment-pool-batch3',[0,0],8);
  expect(()=>validateRewards(before,after,null,done,env)).not.toThrow();
  expect(()=>validateRewards(before,receipts(after,[r]),null,done,env)).toThrow(/independent due/);
  const reached=vector('wealthy-rehab-i',{batch3Healing:10000});
  const paid=receipts(reached.after,[r]);paid.phase='preparation';
  expect(()=>validateRewards(paid,receipts(paid,[r,{...r}]),{type:'equip'},[],env)).toThrow(/independent due/);
});
it('derives level-9 gold from the pre-command level and rejects missing/extra/changed level rewards', () => {
  const {before}=vector('lategame-specialist');before.phase='preparation';before.level=8;before.xp=64;
  const after={...before,level:9,xp:0},r=gold('augment-pool-batch4',['level',9],33);
  expect(()=>validateRewards(before,receipts(after,[r]),{type:'buyXp'},[],env)).not.toThrow();
  for(const rs of [[],[{...r,amount:34}],[r,{...r}]])expect(()=>validateRewards(before,receipts(after,rs),{type:'buyXp'},[],env)).toThrow(/independent due/);
  expect(()=>validateRewards(before,receipts(before,[r]),{type:'equip'},[],env)).toThrow(/independent due/);
});
it('rejects unknown sources, including unknown names sharing the old wildcard prefix', () => {
  const {before,after}=vector('wealthy-rehab-i');
  for(const source of ['augment-pool-invented','opening-invented','made-up','forge','armory','radiant-conversion'])
    expect(()=>validateRewards(before,receipts(after,[gold(source,[],123)]),null,done,env)).toThrow(/unknown mechanic reward source/);
});
it('requires exactly the independently drawn birthday hero and star level', () => {
  const {before}=vector('birthday-presents');before.phase='preparation';before.level=4;before.xp=6;
  const after={...before,level:5,xp:0},a=before.augments[0];
  const plan=rewardPlan(after,{...env,pools:{}}),g=plan.gifts[0];
  const r={...g,round:5,roundId:'2-2',starLevel:2,resolution:'held',gold:0,unitId:'unit-1'};
  expect(g.definitionId).toBe('violet'); // independently computed FNV/LCG vector (seed 29).
  expect(()=>validateRewards(before,receipts(after,[r]),{type:'buyXp'},[],env)).not.toThrow();
  for(const rs of [[],[r,{...r}], [{...r,definitionId:'vex'}],[{...r,starLevel:3}],[{...r,gold:123}], [{...r,resolution:'gold',gold:1}]])
    expect(()=>validateRewards(before,receipts(after,rs),{type:'buyXp'},[],env)).toThrow();
  expect(a.definitionId).toBe('birthday-presents');
});
it('derives the Junker King price from the selected upgrade, rejecting receipt/payload co-forgery', () => {
  const {before}=vector('wealthy-rehab-i');before.phase='choice';
  const state={...before,pendingChoice:{kind:'armory',step:'offer',generation:0,choiceId:'menu',offers:['flamethrower'],payload:{source:'junker-king',prices:{flamethrower:123}}}};
  const r={kind:'choice',receiptId:'menu',source:'junker-king',choiceKind:'armory',optionId:'flamethrower',skipped:false,price:5,round:5,roundId:'2-2'};
  const after={...state,phase:'preparation'},selected=[{type:'choiceSelected',choiceId:'menu',definitionId:'flamethrower'}];
  expect(validateRewards(state,receipts(after,[r]),{type:'select',choiceId:'menu',generation:0,definitionId:'flamethrower'},selected,env).price).toBe(5);
  expect(()=>validateRewards(state,receipts(after,[{...r,price:123}]),{type:'select',choiceId:'menu',generation:0,definitionId:'flamethrower'},selected,env)).toThrow(/independent mechanic choice price/);
  expect(()=>validateRewards(state,after,{type:'select',choiceId:'menu',generation:0,definitionId:'flamethrower'},selected,env)).toThrow(/missing mechanic choice/);
});

it('transcribes every level-reward threshold, acquisition catch-up and repeated-copy identity independently', () => {
  const state=(id:string,level:number,from=4)=>{
    const {before}=vector(id);return {...before,phase:'preparation',level,
      seatMechanics:{...before.seatMechanics,seat:{'augment-acquisition-levels':{'round:2-1:augment':from}}}};
  };
  const ally=rewardPlan(state('caretakers-ally',6),{...env,pools:{}}).gifts;
  expect(ally).toHaveLength(3);
  expect(ally.map(g=>COST[g.definitionId])).toEqual([2,2,2]);
  expect(new Set(ally.map(g=>g.definitionId)).size).toBe(1);
  expect(new Set(ally.map(g=>g.receiptId)).size).toBe(3);
  expect(rewardPlan(state('caretakers-favor',6,6),{...env,pools:{}}).gifts.map(g=>g.definitionId)).toEqual(['TFT_ArmoryKeyComponent','TFT_ArmoryKeyComponent']);
  expect(rewardPlan(state('caretakers-chosen',7,7),{...env,pools:{}}).gifts.map(g=>g.definitionId)).toEqual(['TFT_ArmoryKeyComponent','TFT_ArmoryKeyCompleted','TFT_ArmoryKeyRadiant']);
  const birthdays=rewardPlan(state('birthday-presents',8),{...env,pools:{}}).gifts;
  expect(birthdays.map(g=>[COST[g.definitionId],g.starLevel])).toEqual([[1,2],[2,2],[3,2],[4,2]]);
  expect(rewardPlan(state('birthday-presents',10),{...env,pools:{}}).gifts.map(g=>[COST[g.definitionId],g.starLevel])).toEqual([[1,2],[2,2],[3,2],[4,2],[5,2],[6,2]]);
  expect(rewardPlan(state('lategame-specialist',8),{...env,pools:{}}).gold).toEqual([]);
  expect(rewardPlan(state('lategame-specialist',9),{...env,pools:{}}).gold).toEqual([gold('augment-pool-batch4',['level',9],33)] .map(({roundId: _roundId,...r})=>r));
});
it('rejects a forged threshold fact even when its gold receipt agrees with the forged fact', () => {
  const {before,after}=vector('wealthy-rehab-i',{battleId:'battle-5',batch3Healing:10000,openingDeaths:[]});
  const finished={...after,combat:{combatId:'battle-5',result:'enemyWin',units:[],openingDeaths:[]}};
  expect(()=>validateRewards(before,receipts(finished,[gold('augment-pool-batch3',[0,0],8)]),null,done,env)).toThrow(/independent healing counter/);
});
it('binds every loaded independent oracle dependency into recording source digests', async () => {
  const {createRequire}=await import('node:module'),{readFileSync}=await import('node:fs'),{createHash}=await import('node:crypto');
  const require=createRequire(import.meta.url);
  const audit=require('../scripts/v23-online-rules-fixture-audit.cjs') as {sourceDigests():Record<string,string>};
  require('./fixtures/m5/oracle.g2.cjs'); // Include the native CJS entrypoint as the recorder loads it.
  const digests=audit.sourceDigests();
  const dependencies=Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/tests/')&&(/\/fixtures\/m5\/.*\.cjs$/.test(p)||/augment-.*-oracle-data\.cjs$/.test(p)));
  expect(dependencies.length).toBeGreaterThanOrEqual(7);
  for(const file of dependencies)expect(digests[file.slice(process.cwd().length+1)]).toBe(createHash('sha256').update(readFileSync(file)).digest('hex'));
});
it('permits only real full-bench escrow and requires the reward once a sale frees capacity', () => {
  const {before}=vector('birthday-presents');before.phase='preparation';before.xp=6;
  const full={...before,preparation:{units:Array.from({length:9},(_,slot)=>({id:`held-${slot}`,team:'player',definitionId:'irelia',starLevel:1,location:{kind:'bench',slot}}))}};
  const reached={...full,level:5,xp:0};
  expect(()=>validateRewards(full,reached,{type:'buyXp'},[],env)).not.toThrow();
  const g=rewardPlan(reached,{...env,pools:{}}).gifts[0];
  const r={...g,round:5,roundId:'2-2',resolution:'held',unitId:'new-unit',gold:0};
  expect(()=>validateRewards(full,receipts(reached,[r]),{type:'buyXp'},[],env)).toThrow(/unit receipt existence/);
  const sold={...reached,preparation:{units:reached.preparation.units.slice(1)}};
  expect(()=>validateRewards(reached,receipts(sold,[r]),{type:'sell',id:'held-0'},[],env)).not.toThrow();
  expect(()=>validateRewards(reached,sold,{type:'sell',id:'held-0'},[],env)).toThrow(/unit receipt existence/);
});

it('retains the archive Blood Brothers exclusions when the enlarged pool is scanned', () => {
  for(const definitionId of ['menaces','geniuses','field-medic','shocking-troll'])expect(augmentPool('prismatic',[{definitionId}])).not.toContain('blood-brothers');
  expect(augmentPool('gold',[{definitionId:'epoch'}])).not.toContain('epoch-plus');
  expect(augmentPool('prismatic',[{definitionId:'trade-sector'}])).not.toContain('shopping-spree');
});
it('cannot fabricate a reached level together with a matching level-reward receipt', () => {
  const {before}=vector('lategame-specialist');before.phase='preparation';before.level=8;before.xp=0;
  const forged={...before,level:9};
  expect(()=>validateRewards(before,receipts(forged,[gold('augment-pool-batch4',['level',9],33)]),{type:'buyXp'},[],env)).toThrow(/independent XP state/);
});

it('rejects co-forged balance and receipt after a real free refresh by an owned non-gold augment', () => {
  // Synthetic owned-augment economic input, not a recorded acquisition route.
  const before={...createMatch(29),augments:[{definitionId:'rolling-for-days-i',choiceId:'fixture:rolling',acquiredRound:1}]};
  const result=rerollShop(before);if(!result.ok)throw Error(result.reason);
  const r={...gold('augment-pool-batch3',[0,0],123,before.round),roundId:before.roundDefinitionId,
    receiptId:JSON.stringify(['augment-pool-batch3','fixture:rolling',0,0])};
  const after={...result.state,gold:result.state.gold+123,seatMechanics:{...result.state.seatMechanics!,receipts:[...result.state.seatMechanics!.receipts,r as never]}};
  expect(()=>new Ledger(before).apply(before,after,{type:'reroll'},result.events)).toThrow(/independent due augment gold/);
});

it('preserves one serial order when older P2 and level gifts drain in the same transaction', () => {
  // Explicit pending-grant input vector; no claim that this is an acquisition route.
  const base=createMatch(29),before={...base,level:2,augments:[
    {definitionId:'sisters',choiceId:'fixture:sisters',acquiredRound:1},
    {definitionId:'birthday-presents',choiceId:'fixture:birthday',acquiredRound:1}],
    seatMechanics:{...base.seatMechanics!,seat:{...base.seatMechanics!.seat,'augment-acquisition-levels':{'fixture:birthday':1}}}};
  const command={type:'deploy',id:'unit-1',target:{kind:'board' as const,cell:{col:3,row:4}}};
  const result=deployMatchUnit(before,command.id,command.target);if(!result.ok)throw Error(result.reason);
  const grants=result.state.seatMechanics!.receipts.filter(r=>r.kind==='unit');
  expect(grants.map(r=>r.source)).toEqual(['s13-augments-p2','s13-augments-p2','augment-pool-batch1']);
  expect(()=>new Ledger(before).apply(before,result.state,command,result.events)).not.toThrow();
});

it('does not let a rewritten acquisition baseline erase a level reward', () => {
  const {before}=vector('birthday-presents');before.phase='preparation';before.xp=6;
  const after={...before,level:5,xp:0,seatMechanics:{...before.seatMechanics,
    seat:{...before.seatMechanics.seat,'augment-acquisition-levels':{'round:2-1:augment':5}}}};
  expect(()=>validateRewards(before,after,{type:'buyXp'},[],env)).toThrow(/independent acquisition level baseline/);
});
it('binds reward random streams to the before-state seed and seat', () => {
  const {before}=vector('birthday-presents');before.phase='preparation';before.xp=6;
  for(const change of [{seed:30},{multiplayer:{seatId:'other-seat'}}]){
    const after={...before,level:5,xp:0,...change},g=rewardPlan(after,{...env,pools:{}}).gifts[0];
    const r={...g,round:5,roundId:'2-2',resolution:'held',unitId:'unit-1',gold:0};
    expect(()=>validateRewards(before,receipts(after,[r]),{type:'buyXp'},[],env)).toThrow(/immutable reward/);
  }
});
it('does not mint a Form Swapper reward from fabricated after-state upgrade provenance', () => {
  const vectorState=vector('why-not-both').before;
  const before={...vectorState,phase:'preparation',resourceProvenance:{entries:[
    {kind:'form-swapper-selected',choiceId:'round:2-1:augment',sequence:0,roundId:'2-1'}]}};
  for(const g of rewardPlan(before,{...env,pools:{}}).gifts)before.seatMechanics.receipts.push({...g,unitId:'old-'+g.definitionId});
  const upgrade={type:'unitUpgraded',definitionId:'swain',fromStar:2,toStar:3,survivorId:'fake',consumedIds:['absent-1','absent-2'],location:{kind:'bench',slot:0}};
  const after={...before,resourceProvenance:{entries:[...before.resourceProvenance.entries,
    {kind:'unit-upgraded',sequence:1,roundId:'2-2',event:upgrade}]}};
  const g=rewardPlan(after,{...env,pools:{}}).gifts.at(-1)!;
  const r={...g,round:5,roundId:'2-2',resolution:'held',unitId:'unit-1',gold:0};
  expect(()=>validateRewards(before,receipts(after,[r]),{type:'reroll'},[],env)).toThrow(/reward upgrade needs actual upgrade event/);
});
it('pays threshold gold during a locked XP purchase and defers its hero rewards', () => {
  const multiplayer={seatId:'seat-0',status:'active',combatRosterLocked:true};
  const goldBefore={...vector('lategame-specialist').before,level:8,xp:64,multiplayer};
  const goldAfter={...goldBefore,level:9,xp:0};
  expect(validateRewards(goldBefore,receipts(goldAfter,[gold('augment-pool-batch4',['level',9],33)]),{type:'buyXp'},[],env).gold.size).toBe(1);
  const heroBefore={...vector('birthday-presents').before,xp:6,multiplayer};
  const heroAfter={...heroBefore,level:5,xp:0};
  expect(()=>validateRewards(heroBefore,heroAfter,{type:'buyXp'},[],env)).not.toThrow();
  const g=rewardPlan(heroAfter,{...env,pools:{}}).gifts[0];
  const r={...g,round:5,roundId:'2-2',resolution:'orb',unitId:null,gold:0};
  expect(()=>validateRewards(heroBefore,receipts(heroAfter,[r]),{type:'buyXp'},[],env)).toThrow(/locked roster/);
});
it('requires an online hero receipt to name its real independently derived escrow orb', () => {
  const before={...vector('birthday-presents').before,phase:'preparation',xp:6,multiplayer:{seatId:'seat-0',status:'active',combatRosterLocked:false}};
  const after={...before,level:5,xp:0},g=rewardPlan(after,{...env,pools:{}}).gifts[0];
  const orbId=JSON.stringify(['orb','2-2','mechanic',g.receiptId,0]),payload={kind:'unit',definitionId:g.definitionId,quantity:1,starLevel:2};
  const r={...g,round:5,roundId:'2-2',resolution:'orb',unitId:null,gold:0,orbId};
  const queued={...after,m8:{loot:{rewardOrbs:[{orbId,entries:[{payload}]}]}}};
  expect(()=>validateRewards(before,receipts(queued,[r]),{type:'buyXp'},[],env)).not.toThrow();
  for(const bad of [receipts(after,[r]),receipts(queued,[{...r,unitId:'fake'}]),
    receipts({...queued,m8:{loot:{rewardOrbs:[{orbId,entries:[{payload:{...payload,starLevel:3}}]}]}}},[r])])
    expect(()=>validateRewards(before,bad,{type:'buyXp'},[],env)).toThrow();
});
it('never resolves a summon into an undefined-cost gold fallback, including online', () => {
  const before={...vector('dummify').before,phase:'preparation',multiplayer:{seatId:'seat-0',status:'active',combatRosterLocked:false}};
  const g=rewardPlan(before,{...env,pools:{}}).gifts[0];
  const r={...g,round:5,roundId:'2-2',resolution:'held',unitId:'unit-1',gold:0};
  expect(()=>validateRewards(before,receipts(before,[r]),{type:'reroll'},[],env)).not.toThrow();
  expect(()=>validateRewards(before,receipts(before,[{...r,resolution:'gold',unitId:null,gold:undefined}]),{type:'reroll'},[],env)).toThrow(/summons are held/);
});

it('cannot rewrite historical battle counters to mint a reward after an unrelated command',()=>{
  const {before}=vector('wealthy-rehab-i');before.phase='preparation';
  (before.seatMechanics.hidden.progress.economyReceipts as unknown[]).push({kind:'battle',facts:{round:4,roundKind:'pvp',result:'loss',alliedDeaths:0,batch3Healing:0}});
  const after=structuredClone(before);
  (after.seatMechanics.hidden.progress.economyReceipts as unknown as {facts:{batch3Healing:number}}[])[0].facts.batch3Healing=10000;
  expect(()=>validateRewards(before,receipts(after,[{...gold('augment-pool-batch3',[0,0],8,4),roundId:'2-1'}]),{type:'reroll'},[],env)).toThrow(/battle counters append-only/);
});

it('contains exactly 237 independently tiered unique augment identities',()=>{
  const pools=(['silver','gold','prismatic'] as const).map(tier=>augmentPool(tier,[]));
  const all=pools.flat();expect(all).toHaveLength(237);expect(new Set(all).size).toBe(237);
  const groups={silver:['patience-is-a-virtue'],gold:['clear-mind','cluttered-mind','slammin','slammin-plus','category-five','long-distance-pals','sated-spellweaver','overheal'],prismatic:['invested-plus','invested-plus-plus']};
  for(const [tier,ids]of Object.entries(groups))for(const id of ids)expect(augmentPool(tier as 'silver'|'gold'|'prismatic',[])).toContain(id);
});
it('retains batch-4 stage bans and all exclusions against the current pool in both directions',()=>{
  const nodes=['2-1','3-2','4-2'];
  const permitted:Record<string,string[]>={
    'clear-mind':['2-1'],'cluttered-mind':['2-1'],slammin:['2-1'],'slammin-plus':['3-2'],
    'patience-is-a-virtue':['2-1'],'invested-plus':['3-2'],'invested-plus-plus':['4-2'],
    'category-five':['2-1','3-2'],'long-distance-pals':nodes,overheal:['3-2','4-2'],'sated-spellweaver':['3-2','4-2'],
  };
  for(const [id,allowed]of Object.entries(permitted))for(const node of nodes){
    const all=(['silver','gold','prismatic'] as const).flatMap(tier=>augmentPool(tier,[],[],`round:${node}:augment`));
    expect(all.includes(id)).toBe(allowed.includes(node));
  }
  const pairs=[['clear-mind','cluttered-mind'],['slammin','slammin-plus'],['category-five','not-today'],
    ['sated-spellweaver','wealthy-rehab-i'],['sated-spellweaver','wealthy-rehab-ii'],['invested-plus','invested-plus-plus']];
  for(const id of ['invested-plus','invested-plus-plus'])for(const other of ['raining-gold','raining-gold-plus','hedge-fund','going-long'])pairs.push([id,other]);
  for(const [a,b]of pairs)for(const [owned,blocked]of [[a,b],[b,a]]){
    expect((['silver','gold','prismatic'] as const).flatMap(tier=>augmentPool(tier,[{definitionId:owned}]))).not.toContain(blocked);
  }
});
const xpState=(id:string,champions=0,inventory=false,round=5)=>({round,augments:[owner(id)],
  preparation:{benchSize:9,units:[...Array.from({length:champions},(_,slot)=>({team:'player',definitionId:'irelia',location:{kind:'bench',slot}})),
    {team:'player',definitionId:'training-dummy',location:{kind:'bench',slot:8}},
    {team:'enemy',definitionId:'irelia',location:{kind:'bench',slot:0}}]},
  items:inventory?[{location:{kind:'inventory'}}]:[{location:{kind:'unit',unitId:'any'}}]});
it('samples batch-4 XP from the live champion bench and item inventory only at PvP end',()=>{
  expect(benchXp(xpState('clear-mind'))).toBe(3);
  expect(benchXp(xpState('clear-mind',1))).toBe(0);
  expect(benchXp(xpState('cluttered-mind',8))).toBe(0);
  expect(benchXp(xpState('cluttered-mind',9))).toBe(3);
  for(const id of ['slammin','slammin-plus']){
    expect(benchXp(xpState(id))).toBe(2);expect(benchXp(xpState(id,0,true))).toBe(0);
    expect(benchXp(xpState(id,0,false,10))).toBe(0); // 2-7 PvE
    expect(benchXp(xpState(id,0,false,7))).toBe(0); // 2-4 supply
  }
  expect(benchXp({...xpState('clear-mind'),augments:[{...owner('clear-mind'),acquiredRound:6}]})).toBe(0);
});
it('rejects missing or co-forged batch-4 settlement XP even if the claimed result agrees',()=>{
  const {before,after}=vector('clear-mind');
  const real={...before,...xpState('clear-mind')};
  expect(()=>validateRewards(real,{...after,...xpState('clear-mind'),phase:'settlement',xp:5},null,done,env)).not.toThrow();
  expect(()=>validateRewards(real,after,null,done,env)).toThrow(/independent XP state/);
  const blocked={...real,items:[{location:{kind:'inventory'}}],augments:[owner('slammin')]};
  expect(()=>validateRewards(blocked,{...after,augments:blocked.augments,xp:4},null,done,env)).toThrow(/independent XP state/);
});
it('transcribes batch-4 initial gold, heroes, components and hurricane without importing production',()=>{
  expect(augmentGold('invested-plus','3-2')).toBe(26);expect(augmentGold('invested-plus-plus','4-2')).toBe(45);
  const plan=(id:string)=>rewardPlan(vector(id).before,{...env,pools:{component:['sword']}}).gifts;
  expect(plan('cluttered-mind').map(g=>[g.kind,COST[g.definitionId],g.starLevel])).toEqual(Array.from({length:4},()=>['unit',1,1]));
  for(const id of ['slammin','slammin-plus'])expect(plan(id).map(g=>[g.kind,g.definitionId])).toEqual([['item','sword']]);
  expect(plan('category-five').map(g=>[g.kind,g.definitionId])).toEqual([['item','runaans-hurricane']]);
  for(const id of ['long-distance-pals','sated-spellweaver','overheal'])expect(plan(id)).toEqual([]);
});
it('grants patience only after acquisition and detects any shop purchase even if its hero was sold',()=>{
  const base={round:5,level:4,augments:[owner('patience-is-a-virtue')],resourceProvenance:{entries:[]}};
  expect(freeRerollCredits({...base,round:4})).toBe(0);expect(freeRerollCredits(base)).toBe(2);
  const bought={...base,resourceProvenance:{entries:[{kind:'unit-acquired',roundId:'2-1',source:{kind:'shop'}},
    {kind:'unit-sold',roundId:'2-1'}]}};
  expect(freeRerollCredits(bought)).toBe(0);
  expect(freeRerollCredits({...base,resourceProvenance:{entries:[{kind:'unit-acquired',roundId:'2-1',source:{kind:'opening'}}]}})).toBe(2);
});
it('reconstructs invested entry credits across every bank boundary and deferred settlement adjustment',()=>{
  const credits=(goldAfter:number,extra:unknown[]=[],entries:unknown[]=[])=>freeRerollCredits({round:5,level:4,
    augments:[owner('invested-plus')],roundResults:[{round:4,roundId:'2-1',goldAfter,mechanicReceiptPrefixLength:1}],
    seatMechanics:{receipts:[{kind:'gold',round:4,amount:999},...extra]},resourceProvenance:{entries}});
  for(const [bank,n]of [[0,0],[49,0],[50,0],[59,0],[60,1],[69,1],[70,2],[79,2],[80,3],[180,3]])expect(credits(bank)).toBe(n);
  expect(credits(50,[{kind:'gold',round:4,amount:12},{kind:'unit',round:4,gold:3},{kind:'choice',round:4,price:5}])).toBe(1);
  expect(credits(59,[],[{kind:'unit-sold',context:'settlement-capacity',roundId:'2-1',goldGranted:1}])).toBe(1);
  expect(credits(59,[{kind:'gold',round:5,amount:100}])).toBe(0);
});
it('requires Slammin Plus acquisition XP and its independently drawn component in the same selection',()=>{
  const basis=vector('slammin-plus').before;
  const pendingChoice={kind:'augment',step:'offer',choiceId:'round:3-2:augment',generation:0,offers:['slammin-plus']};
  const before={...basis,phase:'choice',augments:[],pendingChoice};
  const after={...before,phase:'preparation',level:5,xp:0,augments:[{definitionId:'slammin-plus',choiceId:pendingChoice.choiceId,acquiredRound:5}]};
  const data = require('./augment-reward-pools-oracle-data.cjs');
  const g=rewardPlan(after,{...env,pools:data.pools}).gifts[0];
  const r={...g,round:5,roundId:'2-2',itemId:'item-1'};
  const command={type:'select',choiceId:pendingChoice.choiceId,generation:0,definitionId:'slammin-plus'};
  const events=[{type:'choiceSelected',choiceId:pendingChoice.choiceId,definitionId:'slammin-plus'}];
  expect(()=>validateRewards(before,receipts(after,[r]),command,events,env)).not.toThrow();
  expect(()=>validateRewards(before,receipts({...after,level:4,xp:0},[r]),command,events,env)).toThrow(/independent XP state/);
  expect(()=>validateRewards(before,after,command,events,env)).toThrow(/item receipt existence/);
  expect(()=>validateRewards(before,receipts(after,[{...r,definitionId:'invented'}]),command,events,env)).toThrow(/independent gift draw/);
});
it('independently binds Spoils counters to opening ownership and all ordinary PvE deaths',()=>{
  const source={source:{sourceKind:'augment',sourceDefinitionId:'spoils-of-war-i'}};
  const {before,after}=vector('spoils-of-war-i',{roundKind:'pve',battleId:'battle-10',openingDeaths:[],batch2:[{definitionId:'spoils-of-war',count:1}]});
  const live={...before,round:10,roundDefinitionId:'2-7',preparation:{units:[
    {id:'ally',team:'player',definitionId:'irelia',location:{kind:'board'}},
    {id:'wolf',team:'enemy',definitionId:'pve-wolf',location:{kind:'board'}},
  ]}};
  const finished={...after,round:10,roundDefinitionId:'2-7',combat:{combatId:'battle-10',result:'enemyWin',
    units:[{id:'ally',team:'player',definitionId:'irelia',alive:true},{id:'wolf',team:'enemy',definitionId:'pve-wolf',alive:false}],
    openingDeaths:[{unitId:'wolf',eventSeq:7}],strategy:{units:[{unitId:'ally',sources:[source]}]}},
    seatMechanics:{...after.seatMechanics,hidden:{progress:{economyReceipts:[{kind:'battle',facts:{round:10,roundKind:'pve',result:'loss',battleId:'battle-10',alliedDeaths:0,openingDeaths:[],batch2:[{definitionId:'spoils-of-war',count:1}]}}]}}}};
  const spoils=(s:unknown)=>rewardPlan(s,{...env,pools:{},spoils:()=>({'3':1})}).gold;
  expect(spoils(finished)).toEqual([{source:'augment-pool-batch3',receiptId:'["augment-pool-batch3","round:2-1:augment",0,1]',kind:'gold',amount:1,round:10}]);
  // Seed 29 independently selects source table 4, slot 3 = 1 gold.
  expect(()=>validateRewards(live,receipts(finished,[{...gold('augment-pool-batch3',[0,1],1,10),roundId:'2-7'}]),null,done,env)).not.toThrow();
  // The source counter must be rejected even when an attacker supplies a matching reward.
  for(const count of [0,2]){
    const bad=structuredClone(finished);bad.seatMechanics.hidden.progress.economyReceipts[0].facts.batch2[0].count=count;
    expect(()=>validateRewards(live,bad,null,done,env)).toThrow(/independent batch2 counter/);
  }
  const noOwner={...finished,combat:{...finished.combat,strategy:{units:[{unitId:'ally',sources:[]}]}}};
  expect(()=>validateRewards(live,noOwner,null,done,env)).toThrow(/independent batch2 counter/);
  const erased=structuredClone(noOwner);erased.seatMechanics.hidden.progress.economyReceipts[0].facts.batch2=[];
  expect(()=>validateRewards({...live,combat:{strategy:finished.combat.strategy}},erased,null,done,env)).toThrow(/independent batch2 counter/);
});

// Public 2-1 Heroic Grab Bag offer with no prior lesser duplicator, after Batch 5 H3 pool expansion.
// Seed 4 already earns one from its opening, so it does not satisfy this vector's two-tool premise.
// Keep the pre-command independent ledger so co-forged balances exercise Ledger.apply.
import * as matchApi from '../src/simulation/match';
import { run } from '../scripts/generate-m5-route.cjs';
const heroicCase: {before:any;after:any;command:any;events:any;ledger:any}[]=[];
const HEROIC_SEED=5;
const routeLedger=new Ledger(createMatch(HEROIC_SEED));
const stopHeroic=Symbol('heroic selection reached');
try {
  await run(matchApi,{seed:HEROIC_SEED,build:'cannon',augmentPriorities:['heroic-grab-bag'],onStep(before,result,command){
    if(!('events' in result))throw Error(result.reason);
    if(command?.type==='select'&&command.definitionId==='heroic-grab-bag'){
      heroicCase.push({before,after:result.state,command,events:result.events,ledger:routeLedger});throw stopHeroic;
    }
    routeLedger.apply(before,result.state,command,result.events);
  }});
} catch(error) {if(error!==stopHeroic)throw error;}
const forkLedger=(ledger:any)=>Object.assign(Object.create(Ledger.prototype),structuredClone(ledger));
it(`rejects seed-${HEROIC_SEED} omitted acquisition receipt and gold together, and binds the complete due schedule set`,()=>{
  expect(heroicCase).toHaveLength(1);
  const {before,after,command,events,ledger}=heroicCase[0];
  const suffix=after.scheduleReceipts.slice(before.scheduleReceipts.length);
  expect(suffix).toHaveLength(1);expect(suffix[0].gold).toBe(9);
  expect(()=>forkLedger(ledger).apply(before,after,command,events)).not.toThrow();
  const missing={...after,gold:after.gold-9,scheduleReceipts:before.scheduleReceipts};
  expect(()=>forkLedger(ledger).apply(before,missing,command,events)).toThrow(/independent due schedule/);
  for(const patch of [{definitionId:'raining-gold'},{round:5},{eventId:'round:3-2:augment'},
    {kind:'component'},{unitId:'unit-1'},{gold:132},{itemIds:['item-999']}]){
    const forged={...after,scheduleReceipts:[...before.scheduleReceipts,{...suffix[0],...patch}]};
    expect(()=>forkLedger(ledger).apply(before,forged,command,events)).toThrow();
  }
  const duplicate={...after,scheduleReceipts:[...after.scheduleReceipts,suffix[0]]};
  expect(()=>forkLedger(ledger).apply(before,duplicate,command,events)).toThrow();
});
it(`rejects seed-${HEROIC_SEED} missing duplicators while keeping reward receipts, wrong IDs, definitions and serials`,()=>{
  const {before,after,command,events,ledger}=heroicCase[0];
  expect(after.consumables.filter((c:any)=>c.definitionId==='TFT_Consumable_ChampionDuplicator_III')).toHaveLength(2);
  for(const patch of [
    {consumables:before.consumables},
    {consumables:after.consumables.slice(0,-1)},
    {consumables:after.consumables.map((c:any,i:number)=>i===after.consumables.length-1?{...c,consumableId:'consumable-999'}:c)},
    {consumables:after.consumables.map((c:any,i:number)=>i===after.consumables.length-1?{...c,definitionId:'reforger'}:c)},
    {nextConsumableSerial:after.nextConsumableSerial+1},
  ])expect(()=>forkLedger(ledger).apply(before,{...after,...patch},command,events)).toThrow(/independent consumable/);
});
it('rejects future schedule grants, unreceipted tools and all four forged battle-gold sources on deploy',()=>{
  const before=createMatch(29),command={type:'deploy',id:'unit-1',target:{kind:'board' as const,cell:{col:3,row:4}}};
  const result=deployMatchUnit(before,command.id,command.target);if(!result.ok)throw Error(result.reason);
  const check=(after:any)=>new Ledger(before).apply(before,after,command,result.events);
  expect(()=>check(result.state)).not.toThrow();
  expect(()=>check({...result.state,gold:result.state.gold+123,scheduleReceipts:[...before.scheduleReceipts,
    {eventId:'round:2-1:augment',round:4,kind:'augment',definitionId:'heroic-grab-bag',unitId:null,itemIds:[],gold:123}]})).toThrow(/independent due schedule/);
  expect(()=>check({...result.state,consumables:[...result.state.consumables,
    {consumableId:`consumable-${before.nextConsumableSerial}`,definitionId:'TFT_Consumable_ChampionDuplicator_III'}],nextConsumableSerial:before.nextConsumableSerial+1})).toThrow(/independent consumable/);
  for(const source of ['high-roller','tacticians-crown','g24-item-gold','conqueror-chest']){
    const r={source,kind:'gold',amount:123,receiptId:'forged:'+source,round:before.round,roundId:before.roundDefinitionId};
    expect(()=>check({...result.state,gold:result.state.gold+123,seatMechanics:{...result.state.seatMechanics!,receipts:[...result.state.seatMechanics!.receipts,r]}})).toThrow(/independent due battle gold/);
  }
});
it('independently removes exactly the commanded tool and preserves all other inventory on use and idle ticks',()=>{
  const base=vector('overheal').before;
  const before={...base,phase:'preparation',consumables:[{consumableId:'consumable-1',definitionId:'reforger'},
    {consumableId:'consumable-2',definitionId:'magnetic-remover'}],nextConsumableSerial:3};
  const command={type:'useConsumable',consumableId:'consumable-1'};
  const after={...before,consumables:before.consumables.slice(1)};
  expect(()=>validateRewards(before,after,command,[],env)).not.toThrow();
  for(const consumables of [before.consumables,[],before.consumables.slice(0,1)])
    expect(()=>validateRewards(before,{...after,consumables},command,[],env)).toThrow(/independent consumable/);
  expect(()=>validateRewards(before,before,null,[],env)).not.toThrow();
  expect(()=>validateRewards(before,after,null,[],env)).toThrow(/independent consumable/);
  const locked={...before,phase:'combat',multiplayer:{seatId:'seat-0',combatRosterLocked:true}};
  expect(()=>validateRewards(locked,{...locked,consumables:[]},{type:'equip'},[],env)).toThrow(/independent consumable/);
});

const {battleGold}=require('./fixtures/m5/battle-gold-oracle.cjs');
import { blackMarket } from './fixtures/m5/oracle.g2.cjs';
const {word}=require('./fixtures/m5/oracle.g2.cjs');
it.each(['high-roller','tacticians-crown','conqueror-chest','g24-item-gold'])('derives %s gold from completed combat and rejects missing/extra/mistimed/altered receipts',(source)=>{
  const base=createMatch(29),battleId='battle:independent',round=5;
  const crown={unitId:'ally',itemPrograms:[{source:{ownerId:'ally',sourceKind:'item',definitionId:'TFT_Item_ForceOfNature'}}]};
  const strategy={units:source==='tacticians-crown'?[crown]:[],traits:source==='conqueror-chest'?[{team:'player',traitId:'conqueror',tier:2}]:[]};
  const ally={id:'ally',mechanics:[{mechanic:'v19Chainblade',source:{instanceId:'item-1'}}],definitionId:source==='high-roller'?'sevika':'irelia',team:'player',location:{kind:'board'},g23:{
    highRoller:source==='high-roller'?[{mod:'coin',gold:3}]:[],conquestTakedowns:source==='conqueror-chest'?Array.from({length:10},(_,i)=>'enemy-'+i):[]}};
  // Search the independent LCG for a Crown success; no production reward receipt input.
  let crownSeed=0;while(BigInt(word(crownSeed))*10n>=4294967296n)crownSeed++;
  const before={...base,phase:'combat',round,roundDefinitionId:'2-2',roundResults:[],preparation:{units:[ally]},combat:{strategy},
    seatMechanics:{...base.seatMechanics!,hidden:{progress:{rngState:crownSeed}},seat:{...base.seatMechanics!.seat}}};
  const itemId=JSON.stringify(['g24-item-gold',battleId,'ally','item-1','perfected-chainblade',0]);
  const combat={status:'finished',combatId:battleId,result:'playerWin',strategy,units:[ally],
    itemGoldReceipts:source==='g24-item-gold'?[{id:itemId,battleId,ownerId:'ally',itemInstanceId:'item-1',kind:'perfected-chainblade',ordinal:0,word:null,gold:3}]:[]};
  const receiptId=source==='high-roller'?`g23:high-roller:${battleId}`:source==='tacticians-crown'?`g23:crown:${battleId}`:source==='conqueror-chest'?'g23:conqueror:1:gold':itemId;
  const amount=source==='tacticians-crown'?1:source==='conqueror-chest'?2:3;
  const r={source,receiptId,amount,kind:'gold',round,roundId:'2-2'};
  const after={...before,combat,roundResults:[{}],seatMechanics:{...before.seatMechanics,receipts:[...base.seatMechanics!.receipts,r]}};
  const check=(state:any,events=done)=>battleGold(before,state,null,events,{word,blackMarket,ROUNDS});
  expect(check(after)).toEqual([r]);
  for(const rs of [[],[r,r],[{...r,amount:amount+123}],[{...r,round:round+1}],[{...r,receiptId:'forged'}],[{...r,source:source==='high-roller'?'tacticians-crown':'high-roller'}]]){
    expect(()=>check({...after,seatMechanics:{...after.seatMechanics,receipts:[...base.seatMechanics!.receipts,...rs]}})).toThrow(/independent due battle gold/);
  }
  expect(()=>check(after,[])).toThrow(/independent due battle gold/);
});
