import {expect,it} from 'vitest';
import {createMatch} from '../src/simulation/match';
import {createItemRandomStreams} from '../src/simulation/g2-4b-item-kernel';
import {recordItemGold,itemGoldPayouts,validateItemGoldPayouts} from '../src/simulation/g2-4b-item-gold';
import {commitG23Settlement} from '../src/simulation/g2-3-settlement';
import {readG23Progress,validateG23MechanicLinks} from '../src/simulation/g2-3-state';
import {validateG23Progress} from '../src/simulation/g2-3-match-progress';
import {validateG23BattleFacts,type G23BattleFacts} from '../src/simulation/g2-3-economy';

function facts():G23BattleFacts{
 const ledger=recordItemGold({streams:createItemRandomStreams(42),receipts:[]},{battleId:'round-1',ownerId:'holder',itemInstanceId:'mogul',kind:'moguls-full',tick:100,ordinal:0});
 return {battleId:'round-1',round:1,roundKind:'pve',result:'win',conquerorTier:0,conquestTakedowns:[],chemBaronTier:0,alliedDeaths:0,rumbleStar:0,highRollerGold:0,itemGoldPayouts:itemGoldPayouts(ledger,new Set(['holder']))};
}

it('settles item gold through the generic receipt exactly once and replays its economy facts',()=>{
 const initial=createMatch(42),f=facts(),settled=commitG23Settlement(initial,f);
 expect(settled.gold).toBe(initial.gold+1);
 expect(settled.seatMechanics!.receipts.filter(r=>r.source==='g24-item-gold')).toHaveLength(1);
 expect(commitG23Settlement(settled,f)).toBe(settled);
 expect(commitG23Settlement(JSON.parse(JSON.stringify(settled)),f)).toEqual(settled);
 expect(readG23Progress(settled)!.economyReceipts.at(-1)).toMatchObject({gold:1});
 expect(()=>validateG23Progress(readG23Progress(settled)!,42,1)).not.toThrow();
 expect(()=>validateG23MechanicLinks(settled)).not.toThrow();
 for(const change of ['amount','missing','extra'] as const){
  const forged=structuredClone(settled),receipts=forged.seatMechanics!.receipts;
  const receipt=receipts.find(r=>r.source==='g24-item-gold')!;
  if(change==='amount')Object.assign(receipt,{amount:2});
  if(change==='missing')Object.assign(forged.seatMechanics!,{receipts:receipts.filter(r=>r!==receipt)});
  if(change==='extra')Object.assign(forged.seatMechanics!,{receipts:[...receipts,{...receipt,receiptId:'unearned-item-gold'}]});
  expect(()=>validateG23MechanicLinks(forged)).toThrow();
 }
});

it('rejects duplicate, other-battle and forged item payout facts without accepting arbitrary gold amounts',()=>{
 const f=facts(),payout=f.itemGoldPayouts![0];
 for(const payouts of [[payout,payout],[{...payout,amount:2}],[{...payout,source:'high-roller'}],
  [{...payout,receiptId:JSON.stringify(['g24-item-gold','another-battle','holder','item','collector',0])}]]){
   expect(()=>validateG23BattleFacts({...f,itemGoldPayouts:payouts} as G23BattleFacts)).toThrow();
 }
 expect(()=>validateItemGoldPayouts([payout],'round-2')).toThrow();
 expect(()=>validateG23BattleFacts({...f,highRollerGold:1})).toThrow();
});
