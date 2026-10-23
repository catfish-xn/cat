// Independent literal 14.24b contract transcription. No production imports.
const assert=require('node:assert/strict');
const LIVE=[[],['amumu','darius','draven','irelia','lux','maddie','morgana','powder','singed','steb','trundle','vex','violet','zyra'],['akali','camille','leona','nocturne','rell','renata','sett','tristana','urgot','vander','vladimir','zeri','ziggs'],['blitzcrank','cassiopeia','ezreal','gangplank','kogmaw','loris','nami','nunu','renni','scar','smeech','swain','twistedfate'],['ambessa','corki','drmundo','ekko','elise','garen','heimerdinger','illaoi','silco','twitch','vi','zoe'],['caitlyn','jayce','jinx','leblanc','malzahar','mordekaiser','rumble','sevika']];
const COMPONENTS=['sword','vest','belt','rod','cloak','bow','gloves','tear'];
// weight, components, gray, blue, gold, prismatic (omitted columns = 0).
const STAGES=[
 [[[35,3,3],[35,3,0,1],[12,2,3,1],[12,2,0,2],[6,1,3,2]],[[25,5,3],[25,5,0,1],[20,4,0,1],[20,3,0,2],[20,3,5]]],
 [[[20,3,0,1],[20,3,1,1],[20,4],[15,3,0,2],[15,2,0,2],[5,2,0,3],[5,0,0,3]],[[44,5],[44,2,0,0,1],[12,2,0,1,1]]],
 [[[20,4,1,1],[20,3,2,1],[20,4,2],[15,3,3],[15,2,2,2],[5,3,0,3],[5,5,0,1]],[[36,2,2,0,1],[34,5],[15,2,2,0,0,1],[13,2,0,2,1],[2,4,0,0,1]]],
 [[[20,2,3],[20,2,2,1],[20,3,2],[15,2,4],[15,2,1,2],[5,2,0,3],[5,4,0,1]],[[40,2,2,0,1],[30,3,2,2],[21,2,2,0,0,1],[8,2,0,1,2],[1,2,0,1,1,1]]],
];
const LESSER='TFT_Consumable_ChampionDuplicator_III',DUPLICATOR='TFT_Consumable_NeekosHelp';
// Atoms encode gold, hero cost, two-star cost, item, tool, forge.
const BOXES={
 copper:[[48,'h1','h1'],[47,'h2'],[1,'g2','remover'],[3,'g2','reforger'],[1,'lesser']],
 copperPlus:[[49,'h3'],[46,'h2','g1'],[3,'g3','reforger'],[1,'g3','remover'],[1,'lesser']],
 silver:[[31,'h3','g3'],[33,'h3','h3'],[31,'h2','h2','h2'],[2,'h2','h2','lesser'],[1,'h3','full'],[2,'g6','reforger']],
 silverPlus:[[49,'h4','g4'],[47,'h3','h3','g2'],[3,'g8','reforger'],[1,'g3','full']],
 gold:[[20,'g12'],[15,'g4','reforger'],[3,'full','g5'],[15,'h4','h4','g2'],[13,'h3','h3','h3','g2'],[10,'gloves','g1'],[18,'completed'],[3,'full','lesser','g2'],[3,'g3','s3']],
 goldPlus:[[15,'g10','h4','h4'],[20,'g13','h5'],[20,'g2','component','component'],[15,'completed','g4'],[10,'gloves','g4'],[5,'g4','reforger','component'],[5,'full','g8'],[5,'artifact'],[5,'g7','h5','h5']],
 ultraPlus:[[10,'artifact','artifact','remover'],[15,'remover','completed','g8'],[10,'g24'],[15,'support','artifact','remover'],[10,'support','component','g8','reforger','spatula'],[10,'artifact','g25','remover'],[10,'support','g25'],[10,'support','component','g8','reforger','frying-pan'],[10,'artifact','remover']],
};
function stream(initial){let s=BigInt(initial>>>0),draws=0;return {draw(n){const size=BigInt(n),limit=4294967296n/size*size;do{s=(s*1664525n+1013904223n)&0xffffffffn;draws++;}while(s>=limit);return Number(s%size);},value:()=>({state:Number(s),draws})};}
function hash(tuple){let h=2166136261n;const text=JSON.stringify(tuple);for(let i=0;i<text.length;i++)h=((h^BigInt(text.charCodeAt(i)))*16777619n)&0xffffffffn;return Number(h);}
function choose(rows,index){for(const r of rows){if(index<r[0])return r;index-=r[0];}throw Error('oracle weights');}
function sets(k){return Array.from({length:16},(_,mask)=>[1,2,3,4].filter(s=>mask&(1<<(s-1)))).filter(s=>s.length===k).sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:1);}
function totals(rows){return {components:rows.reduce((s,r)=>s+r[1],0),bonus:rows.reduce((s,r,i)=>s+(r[2]||0)*(i<2?2:3)+(r[3]||0)*(i<3?6:8)+(r[4]||0)*(i<3?15:18)+(r[5]||0)*40,0)};}
function plan(seed){const rng=stream(hash(['orb-stage-plan-v17',seed]));for(let attempts=1;attempts<=64;attempts++){
 const k=choose([[630,0],[300,1],[58,2],[10,3],[2,4]],rng.draw(1000))[1],subsets=sets(k),high=subsets[k===0||k===4?0:rng.draw(subsets.length)];
 const rows=STAGES.map((s,i)=>{const table=s[Number(high.includes(i+1))];return choose(table,rng.draw(table.reduce((n,r)=>n+r[0],0)));}),t=totals(rows);
 if(t.components>=11&&t.components<=15&&t.bonus>=20&&t.bonus<=79)return {rows,high,attempts,rng:rng.value()};
 }return {rows:STAGES.map(s=>s[0][0]),high:[],attempts:64,rng:rng.value()};}
const forge={completed:'TFT_ArmoryKeyCompleted',component:'TFT_ArmoryKeyComponent',support:'TFT_ArmoryKeySupport',artifact:'TFT_ArmoryKeyOrnn'};
function atom(spec,rng){if(/^g\d+$/.test(spec))return {kind:'gold',quantity:Number(spec.slice(1))};
 if(/^[hs]\d$/.test(spec)){const cost=Number(spec[1]),pool=LIVE[cost];return {kind:'unit',definitionId:pool[rng.draw(pool.length)],quantity:1,...(spec[0]==='s'?{starLevel:2}:{})};}
 if(forge[spec])return {kind:'forge',definitionId:forge[spec],quantity:1};
 if(['spatula','frying-pan'].includes(spec))return {kind:'item',definitionId:spec,quantity:1};
 if(spec==='gloves')return {kind:'item',definitionId:'thiefs-gloves',quantity:1};
 return {kind:'consumable',definitionId:({remover:'magnetic-remover',reforger:'reforger',lesser:LESSER,full:DUPLICATOR})[spec],quantity:1};}
function box(seed,orbId,id){const rng=stream(hash(['orb-box-v17',seed,orbId]));
 if(id==='component')return [{kind:'item',definitionId:COMPONENTS[rng.draw(8)],quantity:1}];
 return choose(BOXES[id],rng.draw(100)).slice(1).map(s=>atom(s,rng));}
const ROUNDS=[['1-2','minions-a-v1',['m01','m02']],['1-3','minions-b-v1',['m01','m02','r01']],['1-4','minions-c-v1',['m01','m02','r01','r02']],['2-7','krugs-v1',['k01','k02','k03']],['3-7','wolves-v1',['w00','w01','w02','w03','w04']],['4-7','razorbeaks-v1',['r00','r01','r02','r03','r04','r05']],['5-7','elder-dragon-v1',['d01']],['6-7','rift-herald-v1',['h01']]];
function lootPlan(seed,ordinal=38,roomSeed=seed){const p=plan(roomSeed),rng=stream((seed^0xdeadbeef)>>>0),rounds=[],rolls=[];
 for(const [roundId,encounterId,carriers] of ROUNDS){const stage=Number(roundId[0]),ord=stage===1?Number(roundId[2])-1:stage*7-4;if(ord>ordinal)break;
  const drops=[],orbs=[];
  const add=(local,slotOrdinal,tier,templateId,payloads)=>{const sourceUnitId=JSON.stringify(['pve',roundId,encounterId,local]),orbId=JSON.stringify(['orb',roundId,encounterId,sourceUnitId,slotOrdinal]),identity={roundId,encounterId,sourceUnitId,slotOrdinal,orbId};
   payloads??=box(seed,orbId,templateId);
   // v22 approved rule: the first 4-7 orb gains one component anvil appended after its sampled entries (no RNG draw).
   if(roundId==='4-7'&&orbs.length===0)payloads=[...payloads,{kind:'forge',definitionId:'TFT_ArmoryKeyComponent',quantity:1}];
   const entries=payloads.map((payload,entryOrdinal)=>({...identity,entryOrdinal,dropId:JSON.stringify([orbId,entryOrdinal]),payload,status:'planned',revealCondition:'source-killed',receiptId:null}));drops.push(...entries);orbs.push({...identity,tier,templateId,entries});};
  if(stage<=4){let seq=[];const row=p.rows[stage-1];for(let col=1;col<=5;col++)for(let n=0;n<(row[col]||0);n++)seq.push(col);
   if(stage===1)seq=seq.filter((_,i)=>i%3===ord-1);
   const slots=seq.map((col,i)=>{const tier=['blue','gray','blue','gold','prismatic'][col-1],id=col===1?'component':col===2?(stage<3?'copper':'copperPlus'):col===3?(stage<4?'silver':'silverPlus'):col===4?(stage<4?'gold':'goldPlus'):'ultraPlus';return {local:carriers[i%carriers.length],slot:Math.floor(i/carriers.length),tier,id};});
   slots.sort((a,b)=>a.local<b.local?-1:a.local>b.local?1:a.slot-b.slot).forEach(s=>add(s.local,s.slot,s.tier,s.id));
  }else{
   const v=rng.draw(1000),variant=v<899?'standard':v<999?'artifact':'crown',c=v===999?null:choose(BOXES.copperPlus,rng.draw(100)),ss=Array.from({length:v===999?2:1},()=>choose(BOXES.silverPlus,rng.draw(100)));
   const copperIds=['three-cost','two-cost-gold','reforger','remover','lesser'],silverIds=['four-cost-gold','three-cost-pair','reforger','duplicator'];
   rolls.push({roundId,variant,copper:c?copperIds[BOXES.copperPlus.indexOf(c)]:null,silver:ss.map(r=>silverIds[BOXES.silverPlus.indexOf(r)])});let n=0;
   if(v===999)add(carriers[0],n++,'gold','epic-crown',[{kind:'item',definitionId:'TFT_Item_ForceOfNature',quantity:1}]);
   else{add(carriers[0],n++,'gold','epic-completed-forge',[atom('completed',rng)]);if(v>=899)add(carriers[0],n++,'gold','epic-artifact-forge',[atom('artifact',rng)]);add(carriers[0],n++,'gray','epic-copper',c.slice(1).map(s=>atom(s,rng)));}
   for(const r of ss)add(carriers[0],n++,'blue','epic-silver',r.slice(1).map(s=>atom(s,rng)));
  }
  rounds.push({encounterPlan:{roundId,encounterId,policyVersion:'m8b-pve-project-v2',drops},choices:[],orbs});
 }return {rounds,rng:rng.value(),layoutRng:{state:(roomSeed^0x4f524253)>>>0,draws:0},rolls};}
// Exact one-attempt independent product enumeration, conditioned on acceptance.
function distribution(){const components=Array(5).fill(0),high=Array(5).fill(0),boxCounts=Object.fromEntries(Object.keys(BOXES).map(k=>[k,0]));let mass=0,opening=0,maxEquipment=0;
 for(let k=0;k<=4;k++)for(const hs of sets(k)){
  const visit=(rows,prob)=>{const i=rows.length;if(i===4){const t=totals(rows);if(t.components<11||t.components>15||t.bonus<20||t.bonus>79)return;mass+=prob;components[t.components-11]+=prob;high[k]+=prob;opening+=rows[0][1]*prob;
   let equipment=t.components;rows.forEach((r,i)=>{boxCounts[i<2?'copper':'copperPlus']+=(r[2]||0)*prob;boxCounts[i<3?'silver':'silverPlus']+=(r[3]||0)*prob;boxCounts[i<3?'gold':'goldPlus']+=(r[4]||0)*prob;boxCounts.ultraPlus+=(r[5]||0)*prob;equipment+=2*(r[4]||0)+4*(r[5]||0);});maxEquipment=Math.max(maxEquipment,equipment);return;}
   const table=STAGES[i][Number(hs.includes(i+1))],sum=table.reduce((s,r)=>s+r[0],0);for(const r of table)visit([...rows,r],prob*r[0]/sum);};
  visit([],([630,300,58,10,2][k]/1000)/sets(k).length);
 }
 assert(mass>0);return {mass,components:components.map(n=>n/mass),high:high.map(n=>n/mass),mean:components.reduce((s,n,i)=>s+n*(i+11),0)/mass,opening:opening/mass,boxCounts:Object.fromEntries(Object.entries(boxCounts).map(([k,v])=>[k,v/mass])),maxEquipment};}
module.exports={LIVE,COMPONENTS,STAGES,BOXES,ROUNDS,LESSER,DUPLICATOR,stream,hash,plan,totals,box,atom,lootPlan,distribution};
