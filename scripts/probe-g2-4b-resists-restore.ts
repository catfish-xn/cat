/** Diagnostic only. All positive states are obtained through public commands.
 * Run: esbuild scripts/probe-g2-4b-resists-restore.ts --bundle --platform=node --format=esm --outfile=/tmp/resists-probe.mjs && node /tmp/resists-probe.mjs
 */
import {createMatch,selectChoice,selectAnomalyTarget,deployMatchUnit,startMatchCombat,stepMatch,nextRound,buyUnit,equipItem,type MatchState,type MatchCommandResult} from '../src/simulation/match';
import {grantMechanicItem} from '../src/simulation/seat-mechanics';
import {restoreMatch} from '../src/simulation/serialization';
import {readCombatStats} from '../src/simulation/combat-s13';
import {CONTENT_DIGEST} from '../src/simulation/content';
import {LOOT_REPLAY_DIGEST} from '../src/simulation/loot-freeze';
import {M8_VERSION} from '../src/simulation/m8/version';
const crest='TFT_Item_Artifact_LightshieldCrest';
function ok(result:MatchCommandResult):MatchState {if(!result.ok)throw Error(result.reason);return result.state;}
function choices(input:MatchState){let s=input;while(s.phase==='choice'){const c=s.pendingChoice!;s=ok(c.step==='target'?selectAnomalyTarget(s,c.choiceId,c.generation,s.preparation.units.find(u=>u.team==='player')!.id):selectChoice(s,c.choiceId,c.generation,c.kind==='augment'?c.offers.find(id=>id!=='placebo'&&id!=='glass-cannon-i')!:c.offers[0]));}return s;}
function start(seekers=false){
 let s=createMatch(5);
 while(s.roundDefinitionId!=='2-1'){
  s=choices(s);
  for(const u of s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board')){
   const used=new Set(s.preparation.units.flatMap(u=>u.location.kind==='bench'?[u.location.slot]:[]));
   s=ok(deployMatchUnit(s,u.id,{kind:'bench',slot:Array.from({length:s.preparation.benchSize},(_,i)=>i).find(i=>!used.has(i))!}));
  }
  s=ok(startMatchCombat(s));while(s.phase==='combat')s=stepMatch(s).state;s=choices(s);s=ok(nextRound(s,s.round));
 }
 s=choices(s);s=ok(deployMatchUnit(s,'unit-1',{kind:'board',cell:{col:1,row:4}}));
 if(seekers)for(const id of ['maddie','lux']){s=ok(buyUnit(s,s.shop.slots.findIndex(x=>x.status==='available'&&x.definitionId===id),s.shop.generation));const n=s.nextUnitSerial-1;s=ok(deployMatchUnit(s,`unit-${n}`,{kind:'board',cell:{col:n===2?3:5,row:7}}));}
 for(const [slot,definitionId] of (seekers?[crest,'gargoyle','TFT_Item_Artifact_SeekersArmguard']:[crest]).entries()){
  const g=grantMechanicItem(s,{receiptId:`probe-${slot}`,source:'resists-restore-test',definitionId});if(!g.ok)throw Error(g.reason);s=ok(equipItem(g.state,g.state.items.at(-1)!.id,'unit-1',slot));
 }
 return ok(startMatchCombat(s));
}
const result=(state:MatchState)=>{const before=performance.now();try{restoreMatch(state);return {accepted:true,ms:performance.now()-before};}catch(e){return {accepted:false,error:String(e),ms:performance.now()-before};}};
const find=(s:any)=>{const unit=s.combat.units.find((u:any)=>u.shieldLayers?.some((l:any)=>l.source.definitionId===crest));return {unit,layer:unit.shieldLayers.find((l:any)=>l.source.definitionId===crest)};};
console.log(JSON.stringify({CONTENT_DIGEST,LOOT_REPLAY_DIGEST,M8_VERSION}));
let state=start();while(state.phase==='combat'&&state.combat!.tick<60)state=stepMatch(state).state;
console.log('positive tick60',JSON.stringify(result(state)));
for(const [name,delta] of [['plus-one',1],['minus-one',-1],['negative',-find(state).layer.granted-1],['fraction',0.5]] as const){const candidate=structuredClone(state),{unit,layer}=find(candidate);layer.granted+=delta;layer.remaining+=delta;layer.m8State.granted+=delta;layer.m8State.remaining+=delta;unit.shield+=delta;console.log(name,JSON.stringify(result(candidate)));}
const moved:any=structuredClone(state),{unit,layer}=find(moved),target=moved.combat.units.find((u:any)=>u.id!==unit.id);
unit.shieldLayers=unit.shieldLayers.filter((l:any)=>l!==layer);unit.shield-=layer.remaining;unit.shieldExpiresAtTick=null;target.shieldLayers.push(layer);target.shield+=layer.remaining;target.shieldExpiresAtTick=Math.max(target.shieldExpiresAtTick??0,layer.expiresAtTick);const key=JSON.parse(layer.m8State.key);key[7]=target.id;layer.m8State.key=JSON.stringify(key);layer.m8State.targetId=target.id;
console.log('rebound-target',JSON.stringify(result(moved)));
let dynamic=start(true);while(dynamic.phase==='combat'&&dynamic.combat!.tick<600)dynamic=stepMatch(dynamic).state;
const holder=dynamic.combat!.units.find(u=>u.id==='unit-1')!;
console.log('seekers tick600',JSON.stringify({tick:dynamic.combat!.tick,stats:readCombatStats(holder,dynamic.combat!),runtime:holder.runtime,result:result(dynamic)}));
