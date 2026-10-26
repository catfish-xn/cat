import { prepareInput, copyInput } from './fixtures/prepared-input';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import {openingCrabCarrier,enterOpeningCrabs} from '../src/simulation/opening-crabs';
import {describe,it,expect} from 'vitest';
import {createMatch,openAnvil,selectChoice,claimOrb,type MatchState} from '../src/simulation/match';
import {isAnvil} from '../src/simulation/content/anvils';
import {prepareMatchLoot,revealMatchLoot,grantDirectLoot} from '../src/simulation/loot-runtime';
import {createCombat} from '../src/simulation/combat';
import {createRoundEnemies} from '../src/simulation/round-enemies';
import {getCatalogRoundById} from '../src/simulation/round-selectors';
import {epicForgeOffers} from '../src/simulation/epic-forges';
import {validateAnvils} from '../src/simulation/anvils';
import {G24_FORGE_POOLS} from '../src/simulation/content/g2-4-forges';
import {createOpeningEncounter,applyOpeningEffects,planOpeningRound} from '../src/simulation/opening-encounter';
import {subscriptionBucket,openingRewardAtoms,openingRewardOffers,claimOpeningReward} from '../src/simulation/opening-batch-rewards';
import {readLootView} from '../src/simulation/loot-view';
import {openAugmentForge,augmentForgeOffers} from '../src/simulation/augment-acquisition';
import {openG23Choice,drainG23Rewards} from '../src/simulation/g2-3-runtime';
import {readG23Progress,writeG23Progress} from '../src/simulation/g2-3-state';
import {g23RewardAtoms} from '../src/simulation/g2-3-rewards';
import {G23_CONQUEROR_CHESTS,g23ConquerorReward} from '../src/simulation/content/g2-3-policy';
import {validateMultiplayerOrbLedger} from '../src/simulation/orb-restore';
const accepted=<T extends {ok:boolean;state:MatchState}>(r:T):MatchState=>{if(!r.ok)throw Error(JSON.stringify(r));return r.state;};
import {fullBench,syntheticSharedRound,accept,conserved} from './tp-helpers';
import {runSharedMatchCommand,sellSharedUnit,restoreSharedOrbSnapshot} from '../src/simulation/shared-pool';
const units=(s:MatchState)=>s.preparation.units.filter(u=>isAnvil(u.definitionId));
function late(seed:number,node:string,base=createMatch(seed)){
 const r=getCatalogRoundById(node),loot=prepareMatchLoot(seed,r.ordinal),enemies=createRoundEnemies(r.ordinal);
 let s:MatchState={...base,phase:'preparation',pendingChoice:null,combat:null,round:r.ordinal,roundDefinitionId:node,m8:{...base.m8,round:r,loot},preparation:{...base.preparation,units:[...base.preparation.units.filter(u=>u.team==='player'),...enemies]}};
 s=enterOpeningCrabs(s);
 const raw=createCombat(s.preparation),source=openingCrabCarrier(s,node,loot.frozen.rounds.at(-1)!.orbs[0].sourceUnitId);
 const dead={...raw,combatId:`round-${s.round}`,status:'finished' as const,result:'playerWin' as const,tick:2,nextEventSeq:10,units:raw.units.map(u=>u.id===source?{...u,alive:false,hp:0}:u),neutralReceipts:{deaths:[{unitId:source,tick:1,eventSeq:1}],controls:[]}};
 return {...revealMatchLoot(s,dead).state,phase:'settlement' as const,combat:dead};
}
describe('anvil reward paths',()=>{
 it.each(['5-7','6-7'])('%s epic claim gives persistent units, no popup or terminal conversion',node=>{
  // Isolated frozen loot + grant boundary; opening none avoids crab replacement of the carrier.
  const seed=Array.from({length:20000},(_,i)=>i).find(s=>createOpeningEncounter(s).selection.encounterId==='none')!;
  const before=late(seed,node);let s=grantDirectLoot(before,node==='6-7').state;
  const receipts=s.m8.loot.receipts.filter(r=>r.payload.kind==='forge');expect(receipts.length).toBeGreaterThan(0);expect(s.pendingChoice).toBeNull();
  for(const r of receipts){if(r.payload.kind!=='forge')throw Error();const id=r.grantedUnitIds[0];expect(units(s).some(u=>u.id===id)).toBe(true);
   s=accepted(openAnvil(s,id));expect(s.pendingChoice!.offers).toEqual(epicForgeOffers(s.seed,r.receiptId,r.payload.definitionId));
   const c:NonNullable<MatchState['pendingChoice']>=s.pendingChoice!;s=accepted(selectChoice(s,c.choiceId,c.generation,c.offers[0]));
  }
  expect(()=>validateAnvils(s)).not.toThrow();expect(grantDirectLoot(s,false).events).toEqual([]);
 });
 it('completed pool retains Thief’s Gloves',()=>expect(G24_FORGE_POOLS.TFT_ArmoryKeyCompleted).toContain('thiefs-gloves'));
 it.each([3,4])('subscription bucket %i stays in orb until claim, uses old offers, is not auto-opened',bucket=>{
  let seed=0;for(;seed<200000;seed++)if(createOpeningEncounter(seed).selection.encounterId==='loot-subscription'&&subscriptionBucket(seed,'loot-subscription',2)===bucket)break;
  const base=createMatch(seed),r=getCatalogRoundById('2-1');let s:MatchState={...base,round:r.ordinal,roundDefinitionId:r.roundId,m8:{...base.m8,round:r}};
  if(s.openingEncounter.mode!=='solo')throw Error();s=accepted(applyOpeningEffects(s,planOpeningRound(s.openingEncounter.context,'2-1').facts));
  const atom=openingRewardAtoms(s).find(a=>a.payload.kind==='forge')!;expect(atom).toBeDefined();expect(s.pendingChoice).toBeNull();expect(units(s)).toHaveLength(0);
  const offers=openingRewardOffers(s,atom);s=accepted(claimOpeningReward(s,atom.id));expect(units(s)).toHaveLength(1);expect(s.pendingChoice).toBeNull();
  s=accepted(openAnvil(s,units(s)[0].id));expect(s.pendingChoice!.offers).toEqual(offers);
 });
 it.each(['4-7','5-7'])('%s full bench keeps forge orb; retry grants once and preserves shared pool',node=>{
  let {pool,state}=fullBench();const round=getCatalogRoundById(node),jump=syntheticSharedRound(pool,[state],round.ordinal);pool=jump.pool;
  state={...jump.states[0],roundDefinitionId:round.roundId,m8:{...jump.states[0].m8,round},phase:'preparation',combat:null,pendingChoice:null};
  const enemies=createRoundEnemies(round.ordinal);state={...state,preparation:{...state.preparation,units:[...state.preparation.units.filter(u=>u.team==='player'),...enemies]}};
  const plan=state.m8.loot.frozen.rounds.at(-1)!,forge=plan.orbs.find(o=>o.entries.some(e=>e.payload.kind==='forge'))!;
  // The source orb is revealed by a real neutral death vector, preserving frozen IDs.
  state=enterOpeningCrabs(state);const carrier=openingCrabCarrier(state,state.roundDefinitionId,forge.sourceUnitId);
  const raw=createCombat(state.preparation),dead={...raw,combatId:`round-${state.round}`,status:'finished' as const,result:'playerWin' as const,tick:2,nextEventSeq:10,units:raw.units.map(u=>u.id===carrier?{...u,alive:false,hp:0}:u),neutralReceipts:{deaths:[{unitId:carrier,tick:1,eventSeq:1}],controls:[]}};
  state={...revealMatchLoot(state,dead).state,phase:'settlement',combat:dead};
  const first=accept(runSharedMatchCommand(pool,state,{type:'claimOrb',round:state.round,orbId:forge.orbId}));pool=first.pool;state=first.state;
  expect(state.m8.loot.receipts.some(r=>r.payload.kind==='forge')).toBe(false);expect(readLootView(state).unclaimedOrbs!.some(o=>o.orbId===forge.orbId)).toBe(true);
  expect(()=>validateMultiplayerOrbLedger(state)).not.toThrow();
  // Free one bench slot using the public shared transaction, then retry the retained orb.
  const victim=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench')!;
  const sale=accept(sellSharedUnit(pool,state,victim.id));pool=sale.pool;state=sale.state;
  const second=accept(runSharedMatchCommand(pool,state,{type:'claimOrb',round:state.round,orbId:forge.orbId}));pool=second.pool;state=second.state;
  expect(units(state)).toHaveLength(1);expect(state.pendingChoice).toBeNull();conserved(pool,[state]);expect(restoreSharedOrbSnapshot(pool,state)).toEqual(state);
  expect(runSharedMatchCommand(pool,state,{type:'claimOrb',round:state.round,orbId:forge.orbId})).toMatchObject({ok:false,reason:'already-claimed'});
 });
 it.each(['portable-forge','radiant-relics'])('%s still opens immediately with its original offers',definitionId=>{
  const base=createMatch(42),a={definitionId,choiceId:'round:2-1:augment',acquiredRound:5};
  const s=openAugmentForge({...base,augments:[a]}).state;expect(s.pendingChoice?.offers).toEqual(augmentForgeOffers(base.seed,a));
  expect(s.pendingChoice?.offers).toHaveLength(definitionId==='portable-forge'?4:5);expect(units(s)).toHaveLength(0);
 });
 it('conqueror forge atoms grant units, preserve sample order, remain unopened',()=>{
  const base=createMatch(42),p=readG23Progress(base)!;
  const chest=G23_CONQUEROR_CHESTS.find(c=>g23RewardAtoms({id:'test',source:'conqueror',tier:c.tier,round:1,reward:g23ConquerorReward(c)},p.seed).some(a=>a.forgeDefinitionId))!;
  const b={id:`g23:conqueror:${chest.tier}`,source:'conqueror' as const,tier:chest.tier,round:1,reward:g23ConquerorReward(chest)};
  let s=drainG23Rewards(writeG23Progress(base,{...p,rewards:[b]}));const a=g23RewardAtoms(b,p.seed).find(a=>a.forgeDefinitionId)!;
  expect(units(s)).toHaveLength(0);expect(openG23Choice(s).state.pendingChoice).toBeNull();
  const orb=readLootView(s).unclaimedOrbs!.find(o=>o.orbId.startsWith('g23-anvil:'))!;
  s=accepted(claimOrb(s,orb.orbId,s.round));expect(units(s).length).toBeGreaterThan(0);
  s=accepted(openAnvil(s,units(s)[0].id));expect(s.pendingChoice!.offers).toEqual(a.options);
 });
});

// Cache actual preparation entrances, one public round per case. Mutating an
// anvil or restoring a candidate remains local to each original test below.
const anvilEntries=new Map<string,MatchState>();
let anvilCursor:MatchState|undefined;
async function publicAnvilPrefix(node:string):Promise<MatchState>{
 const cached=anvilEntries.get(node);if(cached)return cached;
 const {battle}=await import('./fixtures/t13-loot-public');
 const api=await import('../src/simulation/match');
 const {decideBotAction}=await import('../src/simulation/bot');
 const {context,execute}=await import('./t7-helpers');
 let before=anvilCursor??createMatch(42);
 while(before.roundDefinitionId!==node){
   for(let n=0;n<64;n++){const d=decideBotAction(before,context(before,n),0);if(d.action==='done')break;before=accepted(execute(before,d.action));}
   if(before.phase==='preparation')before=battle(before).ended;
   while(before.phase==='choice'){const c=before.pendingChoice!;before=accepted(selectChoice(before,c.choiceId,c.generation,c.offers[0]));}
   if(before.phase==='gameOver')throw Error(`route ended at ${before.roundDefinitionId}`);
   while(before.m8.loot.direct.some(d=>d.status==='pending-capacity')){
     const u:import('../src/simulation/unit-types').Unit|undefined=before.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench'&&!isAnvil(u.definitionId));if(!u)throw Error('capacity reserve');before=accepted(api.sellUnit(before,u.id));
   }
   const next=api.nextRound(before,before.round);if(!next.ok)throw Error(`${before.roundDefinitionId}: ${next.reason}`);before=next.state;
   anvilCursor=prepareInput(before);anvilEntries.set(before.roundDefinitionId,anvilCursor);
 }
 anvilCursor=anvilEntries.get(node)??prepareInput(before);anvilEntries.set(node,anvilCursor);return anvilCursor;
}
for(const round of ROUND_CATALOG.filter(r=>r.ordinal<=getCatalogRoundById('5-7').ordinal))
 it(`public anvil route reaches ${round.roundId}`,async()=>{expect((await publicAnvilPrefix(round.roundId)).roundDefinitionId).toBe(round.roundId);});
it.each(['4-7','5-7'])('public %s combat: save/replay before and after opening an anvil',async node=>{
 const {battle}=await import('./fixtures/t13-loot-public');
 const api=await import('../src/simulation/match');
 const {decideBotAction}=await import('../src/simulation/bot');
 const {context,execute}=await import('./t7-helpers');
 const {serializeMatch,restoreMatch}=await import('../src/simulation/serialization');
 let before=copyInput(await publicAnvilPrefix(node));
 for(let n=0;n<64;n++){const d=decideBotAction(before,context(before,n),0);if(d.action==='done')break;before=accepted(execute(before,d.action));}
 let s:MatchState=battle(before).ended;
 expect(restoreMatch(serializeMatch(s))).toEqual(s);
 while(s.phase==='choice'){const c:NonNullable<MatchState['pendingChoice']>=s.pendingChoice!;s=accepted(selectChoice(s,c.choiceId,c.generation,c.offers[0]));}
 while(s.m8.loot.direct.some(d=>d.status==='pending-capacity')){const u:import('../src/simulation/unit-types').Unit=s.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench'&&!isAnvil(u.definitionId))!;s=accepted(api.sellUnit(s,u.id));}
 if(!units(s).length){
   const orb=readLootView(s).unclaimedOrbs!.find(o=>o.entries.some(p=>p.kind==='forge'))!;expect(orb).toBeDefined();
   s=accepted(api.nextRound(s,s.round));expect(restoreMatch(serializeMatch(s))).toEqual(s);
   const u:import('../src/simulation/unit-types').Unit=s.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench'&&!isAnvil(u.definitionId))!;s=accepted(api.sellUnit(s,u.id));
   const claim=api.claimOrb(s,orb.orbId,s.round);if(!claim.ok)throw Error(claim.reason);s=claim.state;
 }
 expect(units(s).length).toBeGreaterThan(0);expect(restoreMatch(serializeMatch(s))).toEqual(s);
 s=accepted(openAnvil(s,units(s)[0].id));expect(restoreMatch(serializeMatch(s))).toEqual(s);
 const c:NonNullable<MatchState['pendingChoice']>=s.pendingChoice!;s=accepted(selectChoice(s,c.choiceId,c.generation,c.offers[0]));expect(restoreMatch(serializeMatch(s))).toEqual(s);
});

it.each(['5-7','6-7'])('crab-rave %s grants two anvil units with the original batch B offers',async node=>{
 const {commitG23Settlement}=await import('../src/simulation/g2-3-settlement');
 const {openingRewards,openingRewardOffers,validateBatchBRewards}=await import('../src/simulation/opening-batch-b-rewards');
 const seed=Array.from({length:20000},(_,i)=>i).find(s=>createOpeningEncounter(s).selection.encounterId==='crab-rave')!;
 const base=createMatch(seed),r=getCatalogRoundById(node);
 const f:import('../src/simulation/g2-3-economy').G23BattleFacts={battleId:`round-${r.ordinal}`,round:r.ordinal,roundKind:'pve',result:'win',conquerorTier:0,conquestTakedowns:[],chemBaronTier:0,alliedDeaths:0,rumbleStar:0,highRollerGold:0,openingDeaths:[{victimId:'pve-giant-crab',eventSeq:1}]};
 let s=commitG23Settlement({...base,round:r.ordinal,roundDefinitionId:node,m8:{...base.m8,round:r},phase:'settlement',combat:null,roundResults:[{round:r.ordinal,roundId:node,result:'playerWin',levelBefore:1} as MatchState['roundResults'][number]]},f);
 expect(units(s)).toHaveLength(2);expect(s.pendingChoice).toBeNull();expect(commitG23Settlement(s,f)).toBe(s);
 for(const u of [...units(s)]){const receipt=s.seatMechanics!.receipts.find(r=>r.kind==='unit'&&r.unitId===u.id)!;const reward=openingRewards(s).find(r=>r.id===receipt.receiptId)!;
  const expected=openingRewardOffers(s,reward);s=accepted(openAnvil(s,u.id));expect(s.pendingChoice!.offers).toEqual(expected);
  const c:NonNullable<MatchState['pendingChoice']>=s.pendingChoice!;s=accepted(selectChoice(s,c.choiceId,c.generation,c.offers[0]));
 }
 expect(()=>validateBatchBRewards(s)).not.toThrow();expect(()=>validateAnvils(s)).not.toThrow();
});
it('Mel branch 9 gives two claimable component anvils, no automatic choice',async()=>{
 const {melBranch}=await import('../src/simulation/opening-batch-rewards');
 const {commitOpeningEncounterHealth}=await import('../src/simulation/opening-encounter');
 const seed=Array.from({length:100000},(_,i)=>i).find(s=>createOpeningEncounter(s).selection.encounterId==='mels-blessing'&&melBranch(s)===9)!;
 const base=createMatch(seed);let s:MatchState={...base,phase:'settlement',combat:null,playerHp:40,roundResults:[{round:1,roundId:'1-2',settlementId:'mel-vector',hpBefore:41,hpAfter:40} as MatchState['roundResults'][number]]};
 s=commitOpeningEncounterHealth(s);expect(s.pendingChoice).toBeNull();const atoms=openingRewardAtoms(s).filter(a=>a.payload.kind==='forge');expect(atoms).toHaveLength(2);
 for(const a of atoms)s=accepted(claimOpeningReward(s,a.id));expect(units(s)).toHaveLength(2);expect(s.pendingChoice).toBeNull();
});

it('G2-3 full bench retains anvil orb; freeing capacity never auto-claims it',()=>{
 let {state,pool}=fullBench();const p=readG23Progress(state)!;
 const chest=G23_CONQUEROR_CHESTS.find(c=>g23RewardAtoms({id:'test',source:'conqueror',tier:c.tier,round:1,reward:g23ConquerorReward(c)},p.seed).some(a=>a.forgeDefinitionId))!;
 const b={id:`g23:conqueror:${chest.tier}`,source:'conqueror' as const,tier:chest.tier,round:1,reward:g23ConquerorReward(chest)};
 state=writeG23Progress(state,{...p,rewards:[b]});
 const orb=readLootView(state).unclaimedOrbs!.find(o=>o.orbId.startsWith('g23-anvil:'))!;
 const full=accept(runSharedMatchCommand(pool,state,{type:'claimOrb',round:state.round,orbId:orb.orbId}));
 expect(full.state).toEqual({...state,sharedPool:{...state.sharedPool!,revision:state.sharedPool!.revision+1}});expect(units(full.state)).toHaveLength(0);pool=full.pool;state=full.state;
 const sale=accept(sellSharedUnit(pool,state,state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench')!.id));pool=sale.pool;state=sale.state;
 expect(units(state)).toHaveLength(0);expect(readLootView(state).unclaimedOrbs!.some(o=>o.orbId===orb.orbId)).toBe(true);
 const claimed=accept(runSharedMatchCommand(pool,state,{type:'claimOrb',round:state.round,orbId:orb.orbId}));
 expect(units(claimed.state)).toHaveLength(1);expect(claimed.state.pendingChoice).toBeNull();
});

it('mixed orb allocation pays other entries once and retains its full-bench anvil',()=>{
 // Isolated allocator vector: extra gold shares the real frozen forge orb identity.
 const base=fullBench().state,r=getCatalogRoundById('5-7');let s:MatchState=late(5,r.roundId,base);
 const forge=s.m8.loot.frozen.rounds.at(-1)!.orbs.flatMap(o=>o.entries).find(d=>d.payload.kind==='forge')!;
 const gold={...forge,dropId:`${forge.dropId}:gold`,entryOrdinal:forge.entryOrdinal+1,payload:{kind:'gold' as const,quantity:4}};
 s={...s,m8:{...s.m8,loot:{...s.m8.loot,direct:[...s.m8.loot.direct,{dropId:gold.dropId,status:'revealed',receiptId:null}]}}};
 const before=s,g=grantDirectLoot(s,false,undefined,[forge,gold]);s=g.state;
 expect(s.gold).toBe(before.gold+4);expect(s.m8.loot.direct.find(d=>d.dropId===forge.dropId)?.status).toBe('revealed');
 expect(s.m8.loot.direct.find(d=>d.dropId===gold.dropId)?.status).toBe('granted');expect(units(s)).toHaveLength(0);
 const retry=grantDirectLoot(s,false,undefined,[forge,gold]);expect(retry.state).toBe(s);expect(retry.events).toEqual([]);
});
