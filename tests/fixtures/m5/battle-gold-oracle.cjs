/* Independent match payout boundary: combat outcomes are inputs, payout receipts are not.
 * 14.24b map22 Conqueror breakpoints/Gold; Crown 10%; Sevika coin/jackpot 3G.
 * This checks settlement eligibility and amounts, not a second combat simulator.
 */
const assert=require('node:assert/strict');
const sources=['g24-item-gold','conqueror-chest','high-roller','tacticians-crown'];
const thresholds=[10,35,65,100,150,200,330,440,550,650,750,850,1000,1200,1500];
const chestGold=[2,0,0,0,0,0,0,0,0,0,0,20,20,50,80];
function battleGold(before,after,command,events,{word,blackMarket,ROUNDS}){
 const due=[],prior=before.seatMechanics?.receipts??[];
 const add=(source,receiptId,amount)=>{if(amount)due.push({receiptId,source,round:before.round,roundId:before.roundDefinitionId,kind:'gold',amount});};
 const terminal=after.roundResults.length===before.roundResults.length+1&&events.some(e=>e.type==='combatFinished');
 if(terminal){
  assert(before.phase==='combat'||command?.type==='start','battle payout requires combat settlement');
  const c=after.combat;assert(c&&c.status==='finished','battle payout requires finished combat');
  const allies=c.units.filter(u=>u.team==='player'&&!u.anomalySummon&&!u.definitionId.startsWith('g23-'));
  const ids=new Set(allies.map(u=>u.id)),splits=(c.trenchSplits??[]).filter(s=>s.copyIds.some(id=>ids.has(id)));
  for(const s of splits)ids.add(s.ownerId);
  let roller=0;
  for(const u of [...allies,...splits])for(const r of u.g23?.highRoller??[]){
   assert(u.definitionId==='sevika'||splits.includes(u),'High Roller needs Sevika');
   const amount=['coin','jackpot'].includes(r.mod)?3:0;
   assert.equal(r.gold,amount,'independent High Roller cast amount');roller+=amount;
  }
  add('high-roller',`g23:high-roller:${c.combatId}`,roller);
  const opening=new Set((before.combatInputBasis?.inputs.preparation.units??before.preparation.units).filter(u=>u.team==='player'&&u.location.kind==='board').map(u=>u.id));
  const strategy=before.phase==='combat'?before.combat.strategy:c.strategy;
  const crowns=(strategy?.units??[]).reduce((n,u)=>n+(opening.has(u.unitId)?(u.itemPrograms??[]).filter(p=>p.source.ownerId===u.unitId&&p.source.sourceKind==='item'&&p.source.definitionId==='TFT_Item_ForceOfNature').length:0),0);
  const p={...before.seatMechanics.hidden.progress,chem:before.seatMechanics.seat.alchemist,conquest:before.seatMechanics.seat.conqueror},traits=c.strategy?.traits??[],tier=id=>traits.find(t=>t.team==='player'&&t.traitId===id)?.tier??0;
  let rng=p.rngState;
  const chemTier=tier('chem-baron'),losses=c.result==='enemyWin'?p.chem.losses+1:0;
  if(ROUNDS[before.round-1].kind==='pvp'&&chemTier){
   const gain=({3:[15,35],4:[20,45],5:[20,55],6:[25,70],7:[30,100]})[chemTier][losses>=3?1:0];
   const offerTier=Math.min(8,Math.floor((p.chem.shimmer+gain)/100));
   if(!p.chem.offer&&offerTier>p.chem.offeredThrough)rng=blackMarket(offerTier,rng).rng;
  }
  let crownGold=0;if(c.result==='playerWin')for(let i=0;i<crowns;i++){rng=word(rng);if(BigInt(rng)*10000n<1000n*4294967296n)crownGold++;}
  add('tacticians-crown',`g23:crown:${c.combatId}`,crownGold);
  const conquestTier=tier('conqueror');
  const kills=new Set([...allies,...splits].flatMap(u=>u.g23?.conquestTakedowns??[]));
  const stacks=p.conquest.stacks+kills.size*(({2:1,4:3,6:6,9:20})[conquestTier]??0);
  const opened=thresholds.filter(n=>n<=stacks).length;
  for(let i=p.conquest.chestsOpened;i<opened;i++)add('conqueror-chest',`g23:conqueror:${i+1}:gold`,chestGold[i]);
  const battleSeed=before.combatInputBasis?.battleSeed??after.combatInputBasis?.battleSeed;
  const streams={'collector':(battleSeed^0x636f6c6c)>>>0,'gamblers-blade':(battleSeed^0x67616d62)>>>0};
  const mechanisms={'collector':'g24Collector','gamblers-blade':'g24Gambler','moguls-full':'g24Mogul','moguls-periodic':'g24Mogul','perfected-chainblade':'v19Chainblade','tactician-shield':'g23Tactician','tactician-cape':'g23Tactician'};
  for(const r of c.itemGoldReceipts??[]){
   assert(Object.hasOwn(mechanisms,r.kind),'independent eligible item gold kind');
   const holder=c.units.find(u=>u.id===r.ownerId)??before.combat?.units?.find(u=>u.id===r.ownerId);
   assert(holder?.mechanics?.some(m=>m.mechanic===mechanisms[r.kind]&&m.source.instanceId===r.itemInstanceId),'independent item gold owner and instance');
   if(r.kind==='perfected-chainblade')assert.equal(ROUNDS[before.round-1].kind,'pvp','Chainblade requires player combat');
   const random=['collector','gamblers-blade','tactician-shield','tactician-cape'].includes(r.kind);
   if(random){
    assert(Number.isInteger(battleSeed),'independent item gold battle seed');
    const stream=r.kind==='gamblers-blade'?'gamblers-blade':'collector';streams[stream]=word(streams[stream]);
    assert.equal(r.word,streams[stream],'independent item gold random word');
   }else assert.equal(r.word,null,'fixed item gold does not draw');
   const chance=r.kind==='collector'?4000:r.kind==='gamblers-blade'?500:1000;
   const amount=random?(BigInt(r.word)*10000n<BigInt(chance)*4294967296n?1:0):r.kind==='perfected-chainblade'?3:1;
   assert.equal(r.gold,amount,'independent item opportunity gold');
   assert.equal(r.battleId,c.combatId);assert.equal(r.id,JSON.stringify(['g24-item-gold',c.combatId,r.ownerId,r.itemInstanceId,r.kind,r.ordinal]));
   if(ids.has(r.ownerId)&&amount)add('g24-item-gold',r.id,amount);
  }
 }
 const actual=(after.seatMechanics?.receipts??[]).slice(prior.length).filter(r=>sources.includes(r.source));
 const sort=xs=>[...xs].sort((a,b)=>a.receiptId.localeCompare(b.receiptId));
 assert.deepEqual(sort(actual),sort(due),'independent due battle gold receipts (eligibility, timing, identity, amount)');
 return due;
}
module.exports={battleGold};
