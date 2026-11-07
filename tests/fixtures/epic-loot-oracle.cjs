/* Independent v16 reward oracle. Literal approved tables, BigInt LCG; no production imports. */
const EARLY=[[],['darius','irelia','lux','maddie','zyra'],['leona','vander','rell','tristana','urgot'],['loris','ezreal','scar','kogmaw','nami'],['corki','garen','zoe']];
const LIVE=[[],[],['akali','camille','leona','nocturne','rell','renata','sett','tristana','urgot','vander','vladimir','zeri','ziggs'],['blitzcrank','cassiopeia','ezreal','gangplank','kogmaw','loris','nami','nunu','renni','scar','smeech','swain','twistedfate'],['ambessa','corki','drmundo','ekko','elise','garen','heimerdinger','illaoi','silco','twitch','vi','zoe']];
const COMPONENTS=['sword','vest','belt','rod','cloak','bow','gloves','tear'];
const COMPLETED=['adaptive-helm','archangel','bloodthirster','blue-buff','bramble-vest','crownguard','deathblade','dragons-claw','protectors-vow','gargoyle','edge-of-night','rageblade','gunblade','infinity-edge','ionic-spark','jeweled-gauntlet','last-whisper','nashors-tooth','giant-slayer','morellonomicon','steadfast-heart','guardbreaker','quicksilver','deathcap','red-buff','sunfire-cape','redemption','runaans-hurricane','shojin','evenshroud','statikk-shiv','steraks-gage','thiefs-gloves','titans-resolve','hand-of-justice','warmog'];
// 2026-10-29 approved literal transcription: 4-7 = one large + four small birds; 6-7 = one elder dragon (d01). No content imports.
const TABLE=[['1-2','minions-a-v1',[['m01',0,'opening-unit']]],['1-3','minions-b-v1',[['m01',0,'opening-unit'],['r01',0,'component']]],['1-4','minions-c-v1',[['m01',0,'remover'],['r01',0,'component'],['r02',0,'bonus']]],['2-7','krugs-v1',[['k01',0,'equipment'],['k01',1,'extra',1]]],['3-7','wolves-v1',[['w00',0,'equipment'],['w00',1,'extra',2]]],['4-7','razorbeaks-v1',[['r00',0,'equipment'],['r00',1,'extra',3]]],['5-7','elder-dragon-v1',[['d01',0,'epic']]],['6-7','elder-dragon-v1',[['d01',0,'epic']]]];
const LESSER='TFT_Consumable_ChampionDuplicator_III',DUPLICATOR='TFT_Consumable_NeekosHelp';
function stream(seed){let state=BigInt(seed>>>0),draws=0;return {draw(n){let limit=4294967296n/BigInt(n)*BigInt(n);do{state=(1664525n*state+1013904223n)%4294967296n;draws++;}while(state>=limit);return Number(state%BigInt(n));},value:()=>({state:Number(state),draws})};}
const item=definitionId=>({kind:'item',definitionId,quantity:1}),gold=quantity=>({kind:'gold',quantity}),tool=definitionId=>({kind:'consumable',definitionId,quantity:1});
function bonus(tier,stage,index){
 if(stage>4||tier==='prismatic')return [];
 if(tier==='gray')return index===99?[LESSER]:[];
 if(tier==='blue')return stage<4?(index>=99?[DUPLICATOR]:index>=97?[LESSER]:[]):index===99?[DUPLICATOR]:[];
 return stage<4?(index>=97?[DUPLICATOR,LESSER]:index>=94?[DUPLICATOR]:[]):index>=95?[DUPLICATOR]:[];
}
function copper(index){return index<49?'three-cost':index<95?'two-cost-gold':index<98?'reforger':index<99?'remover':'lesser';}
function silver(index){return index<49?'four-cost-gold':index<96?'three-cost-pair':index<99?'reforger':'duplicator';}
function variant(index){return index<899?'standard':index<999?'artifact':'crown';}
// Independent BigInt FNV multiplication: no production hash/RNG helpers.
function bonusIndex(seed,orbId){let hash=2166136261n;for(const c of JSON.stringify(['orb-duplicator-v16',seed,orbId]))hash=((hash^BigInt(c.charCodeAt(0)))*16777619n)&0xffffffffn;return stream(Number(hash)).draw(100);}
function lootPlan(seed,ordinal=38,roomSeed=seed){
 const rng=stream((seed^0xdeadbeef)>>>0),layout=stream((roomSeed^0x4f524253)>>>0),rounds=[],rolls=[];
 const hero=(cost,live=false)=>{const pool=(live?LIVE:EARLY)[cost];return {kind:'unit',definitionId:pool[rng.draw(pool.length)],quantity:1};};
 const component=()=>item(COMPONENTS[rng.draw(8)]),remover=()=>tool('magnetic-remover');
 const box=(row,color)=>row==='three-cost'?[hero(3,true)]:row==='two-cost-gold'?[hero(2,true),gold(1)]:row==='four-cost-gold'?[hero(4,true),gold(4)]:row==='three-cost-pair'?[hero(3,true),hero(3,true),gold(2)]:row==='reforger'?[gold(color==='gray'?3:8),tool('reforger')]:row==='remover'?[gold(3),remover()]:row==='lesser'?[tool(LESSER)]:[gold(3),tool(DUPLICATOR)];
 for(const [roundId,encounterId,slots] of TABLE){const stage=Number(roundId[0]),roundOrdinal=stage===1?Number(roundId[2])-1:3+(stage-2)*7+Number(roundId[2]);if(roundOrdinal>ordinal)break;
  const drops=[],orbs=[];
  const add=(local,slotOrdinal,tier,templateId,payloads)=>{const sourceUnitId=JSON.stringify(['pve',roundId,encounterId,local]),orbId=JSON.stringify(['orb',roundId,encounterId,sourceUnitId,slotOrdinal]),identity={roundId,encounterId,sourceUnitId,slotOrdinal,orbId};const entries=payloads.map((payload,entryOrdinal)=>({...identity,entryOrdinal,dropId:JSON.stringify([orbId,entryOrdinal]),payload,status:'planned',revealCondition:'source-killed',receiptId:null}));drops.push(...entries);orbs.push({...identity,tier,templateId,entries});};
  for(const [local,slot,kind,cost] of slots){
   if(kind==='epic'){
    const v=variant(rng.draw(1000)),c=v==='crown'?null:copper(rng.draw(100)),ss=Array.from({length:v==='crown'?2:1},()=>silver(rng.draw(100)));rolls.push({roundId,variant:v,copper:c,silver:ss});let n=0;
    if(v==='crown')add(local,n++,'gold','epic-crown',[item('TFT_Item_ForceOfNature')]);
    else {add(local,n++,'gold','epic-completed-forge',[{kind:'forge',definitionId:'TFT_ArmoryKeyCompleted',quantity:1}]);if(v==='artifact')add(local,n++,'gold','epic-artifact-forge',[{kind:'forge',definitionId:'TFT_ArmoryKeyOrnn',quantity:1}]);add(local,n++,'gray','epic-copper',box(c,'gray'));}
    for(const row of ss)add(local,n++,'blue','epic-silver',box(row,'blue'));continue;
   }
   let tier='gray',templateId=kind,payloads;
   if(kind==='opening-unit')payloads=[hero(1),remover()];
   if(kind==='component'){tier='blue';payloads=[component()];}
   if(kind==='remover')payloads=[remover()];
   if(kind==='bonus'){const roll=layout.draw(100);tier=roll<50?'blue':'gray';templateId=roll<50?'component':'opening-gold';payloads=roll<50?[component()]:[gold(3)];}
   if(kind==='equipment'){const roll=layout.draw(100);tier=roll<90?'blue':roll<99?'gold':'prismatic';templateId=roll<90?'blue-pair':roll<99?'gold-pair':'prismatic-standard';payloads=roll<90?[component(),component()]:roll<99?[component(),component(),gold(4)]:[item(COMPLETED[rng.draw(36)]),gold(8),tool('reforger'),tool('reforger')];}
   if(kind==='extra'){templateId=`gray-${cost}`;payloads=[rng.draw(100)<75?gold(cost):hero(cost),remover()];if(rng.draw(100)>=80)payloads.push(tool('reforger'));}
   if(stage<=4&&tier!=='prismatic'){
    const source=JSON.stringify(['pve',roundId,encounterId,local]);
    const orbId=JSON.stringify(['orb',roundId,encounterId,source,slot]);
    payloads.push(...bonus(tier,stage,bonusIndex(seed,orbId)).map(tool));
   }
   add(local,slot,tier,templateId,payloads);
  }
  rounds.push({encounterPlan:{roundId,encounterId,policyVersion:'m8b-pve-project-v2',drops},choices:[],orbs});
 }
 return {rng:rng.value(),layoutRng:layout.value(),rounds,rolls};
}
module.exports={bonusIndex,lootPlan,stream,bonus,copper,silver,variant,COMPLETED,COMPONENTS,LIVE,LESSER,DUPLICATOR};
