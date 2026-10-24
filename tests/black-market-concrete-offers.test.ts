import {afterEach,expect,it,vi} from 'vitest';
import {blackMarket} from './fixtures/m5/oracle.g2.cjs';
import {concreteMarketItems} from './fixtures/m5/black-market-oracle.cjs';
import {G23_BLACK_MARKETS} from '../src/simulation/content/g2-3-policy';
import {advanceG23Economy,decideG23Market,type G23BattleFacts} from '../src/simulation/g2-3-economy';
import {createG23Progress,replayG23Economy,validateG23Progress} from '../src/simulation/g2-3-match-progress';
import {g23RewardAtoms} from '../src/simulation/g2-3-rewards';
import * as rng from '../src/simulation/rng';

afterEach(()=>vi.restoreAllMocks());
const facts=(round:number):G23BattleFacts=>({battleId:`concrete-${round}`,round,roundKind:'pvp',result:'win',
 conquerorTier:0,conquestTakedowns:[],chemBaronTier:3,alliedDeaths:0,rumbleStar:0,highRollerGold:0,crowns:2});

it('preserves every old bundle selection and exact source frequencies across 80,000 market openings',()=>{
 // Stratify all 10,000 source tickets. Inverting the LCG gives input seeds;
 // this guarantees exact frequencies, including the 1% package, without flaky tolerances.
 const base=createG23Progress(42),f=facts(1);
 let checked=0;
 for(const market of G23_BLACK_MARKETS){
  const counts=new Map(market.options.map(o=>[o.id,0]));
  let previous:string|undefined;
  for(let ticket=0;ticket<10000;ticket++){
   const word=BigInt(Math.floor((ticket+0.5)*4294967296/10000));
   const seed=Number(BigInt.asUintN(32,(word-1013904223n)*4276115653n));
   const old=blackMarket(market.tier,seed);
   const p={...base,rngState:seed,chem:{...base.chem,shimmer:market.tier*100-15}};
   const next=advanceG23Economy(p,f).progress,offer=next.chem.offer!;
   if(offer.optionId!==old.offers[0]||offer.optionIds.length!==1)throw Error(`Selection changed: ${market.tier}/${ticket}`);
   let cursor=BigInt(old.rng);for(let crown=0;crown<2;crown++)cursor=(cursor*1664525n+1013904223n)%4294967296n;
   if(next.rngState!==Number(cursor)||next.rngDraws!==base.rngDraws+3)throw Error('Market/crown cursor changed');
   counts.set(offer.optionId,counts.get(offer.optionId)!+1);checked++;
   // Each source package also gets an independent raw-data equipment audit.
   if(offer.optionId!==previous)
    expect(offer.concreteItems).toEqual(concreteMarketItems(base.seed,offer));
   previous=offer.optionId;
  }
  expect(Object.fromEntries(counts)).toEqual(Object.fromEntries(market.options.map(o=>[o.id,o.weightBps])));
 }
 expect(checked).toBe(80000);
},30_000);

it('authenticates pending and accepted items by deterministic economy replay, including delayed take',()=>{
 let p=createG23Progress(9);
 for(let round=1;round<=7;round++)p=advanceG23Economy(p,facts(round)).progress;
 const offer=p.chem.offer!;
 expect(offer.concreteItems).toEqual(concreteMarketItems(p.seed,offer));
 expect(offer.concreteItems.length).toBeGreaterThan(0);
 expect(replayG23Economy(p.seed,JSON.parse(JSON.stringify(p.economyReceipts)))).toEqual(p);
 const taken=decideG23Market(p,offer.id,true,8);
 const bundle=taken.rewards.at(-1)!;
 expect(bundle.concreteItems).toEqual(offer.concreteItems);
 expect(g23RewardAtoms(bundle,p.seed).filter(a=>a.kind==='item').map(a=>({atomId:a.id,definitionId:a.options[0]}))).toEqual(offer.concreteItems);
 validateG23Progress(taken,p.seed,8);
 expect(replayG23Economy(p.seed,JSON.parse(JSON.stringify(taken.economyReceipts)))).toEqual(taken);
 const bad=offer.concreteItems.map((item,i)=>i?item:{...item,definitionId:'TFT13_Crime_Bronze_ChemGrips'});
 // Use a valid alternative from the same tier, not just an unknown ID.
 if(bad[0].definitionId===offer.concreteItems[0].definitionId)bad[0]={...bad[0],definitionId:'TFT13_Crime_Bronze_MageGuard'};
 expect(()=>validateG23Progress({...p,chem:{...p.chem,offer:{...offer,concreteItems:bad}}},p.seed,7)).toThrow();
 expect(()=>validateG23Progress({...taken,rewards:[{...bundle,concreteItems:bad}]},p.seed,8)).toThrow();
 const kept=decideG23Market(p,offer.id,false,8);
 expect(kept.chem).toEqual({...p.chem,offer:null,skips:p.chem.skips+1});
 expect(kept.rewards).toEqual(p.rewards);
});

it('uses stored equipment without drawing even on a cold reward cache',()=>{
 const reward=G23_BLACK_MARKETS[7].options[0].reward;
 const bundle={id:'cold-concrete-equipment',round:1,source:'black-market' as const,tier:8,reward};
 const offer={id:bundle.id,optionId:G23_BLACK_MARKETS[7].options[0].id};
 const concreteItems=concreteMarketItems(42,offer);
 const spy=vi.spyOn(rng,'nextRandom').mockImplementation(()=>{throw Error('Equipment must not draw on take');});
 expect(g23RewardAtoms({...bundle,concreteItems},42).map(a=>({atomId:a.id,definitionId:a.options[0]}))).toEqual(concreteItems);
 expect(spy).not.toHaveBeenCalled();
});

it('rejects reordering multiple concrete items and stripping accepted equipment',()=>{
 let p=createG23Progress(9);
 for(let round=1;round<=8;round++){
  p=advanceG23Economy(p,{...facts(round),result:'loss',chemBaronTier:7}).progress;
  const offer=p.chem.offer;
  if(!offer)continue;
  if(offer.concreteItems.length<2){p=decideG23Market(p,offer.id,false,round);continue;}
  expect(offer.concreteItems).toEqual(concreteMarketItems(p.seed,offer));
  validateG23Progress(p,p.seed,round);
  const reversed={...offer,concreteItems:[...offer.concreteItems].reverse()};
  expect(()=>validateG23Progress({...p,chem:{...p.chem,offer:reversed}},p.seed,round)).toThrow();
  const taken=decideG23Market(p,offer.id,true,round);
  validateG23Progress(taken,p.seed,round);
  const forged={...taken,rewards:taken.rewards.map(({concreteItems:_,...b})=>b)};
  expect(()=>validateG23Progress(forged,p.seed,round)).toThrow();
  return;
 }
 throw Error('Route must exercise a multi-item offer');
});
