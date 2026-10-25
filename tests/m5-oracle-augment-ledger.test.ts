import { expect, it } from 'vitest';
import { augmentGold, entryXp, freeRerollCredits } from './fixtures/m5/oracle.g2.cjs';

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
const env = { CATALOG, COST, ROUNDS, xp, entryXp };
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
