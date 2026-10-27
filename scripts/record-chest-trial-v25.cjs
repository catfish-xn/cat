/* Deterministic public recipe search/recording for the chest + repeated bracer
 * trial. Seed554 now forces prismatic; preserve the original scenario obligations. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const oracle=require('../tests/fixtures/m5/oracle.g2.cjs');
const sha=x=>createHash('sha256').update(x).digest('hex');
async function main(){
 const {createServer}=await import('vite');const server=await createServer({configFile:false,cacheDir:'artifacts/v25-online-rules-recording/trials-cache',server:{middlewareMode:true,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom',logLevel:'error'});
 try{
 const {startFight}=await server.ssrLoadModule('/tests/fixtures/v25-online-rules-chest-trial.ts'),{stepMatch}=await server.ssrLoadModule('/src/simulation/match.ts');
 const {selectOpeningUnit}=await server.ssrLoadModule('/src/simulation/opening-unit.ts');
 const output='tests/fixtures/v25-online-rules-chest-trial.json',check=process.argv.includes('--check');
 const pinned=fs.existsSync(output)?JSON.parse(fs.readFileSync(output)).seed:null;
 let chosen=null;const candidates=[];
 for(let seed=0;seed<100000;seed++){
  if(check&&seed!==pinned)continue;
  if(oracle.augmentTier(seed,'round:2-1:augment')!=='silver')continue;
  // Preserve the old seed554 Morgana chest holder as well as the Lux receiver.
  if(selectOpeningUnit(seed)!=='morgana')continue;
  let setup;try{setup=startFight(seed);}catch(e){if(check)throw e;candidates.push({seed,reason:String(e)});continue;}
  let {state,receiverId,chestHolderId}=setup;const initial=state,events=[],frames=[];let grantTick=null,firstPulse=null,deathTick=null,bracerTicks=[],previousStacks=0,previousPulse=0,invalid=false;
  const receiver=s=>s.combat.units.find(u=>u.id===receiverId);
  while(state.phase==='combat'){
   const r=stepMatch(state);state=r.state;events.push(...r.events);const u=receiver(state),tick=state.combat.tick;
   const grants=u.combatItemGrants??[],stacks=(u.triggerLedger?.runtimes??[]).filter(r=>r.source.definitionId==='TFT_Item_Artifact_SeekersArmguard').reduce((n,r)=>n+r.triggerCount,0);
   if(grants.length&&grantTick===null){if(grants.length!==1||grants[0].definitionId!=='archangel'){invalid=true;break;}grantTick=tick;}
   const pulse=u.mechanismState?.periodicTasks.find(t=>t.source.definitionId==='archangel')?.pulseOrdinal??0;
   if(pulse===1&&firstPulse===null)firstPulse=tick;
   if(stacks>previousStacks)bracerTicks.push(tick);
   if(!u.alive&&deathTick===null)deathTick=tick;
   frames.push({tick,alive:u.alive,stacks,pulse,holderAlive:state.combat.units.find(u=>u.id===chestHolderId).alive});
   previousStacks=stacks;if(u.alive)previousPulse=pulse;
  }
  const good=!invalid&&grantTick!==null&&firstPulse!==null&&bracerTicks.length===2&&bracerTicks[0]>firstPulse&&deathTick!==null&&previousPulse===3&&state.combat.tick===deathTick;
  candidates.push({seed,accepted:good,grantTick,firstPulse,bracerTicks,deathTick,lastLivingPulse:previousPulse});
  if(!check)console.log(JSON.stringify(candidates.at(-1)));
  if(!good){if(check)assert.fail('Recorded seed lost its original scenario obligations');continue;}
  chosen={seed,grantTick,firstPulse,bracerTicks,deathTick,terminalTick:state.combat.tick,checkpoints:[['before grant',grantTick-1],['grant tick',grantTick],['before first pulse',firstPulse-1],['first pulse',firstPulse],['first bracer stack',bracerTicks[0]],['repeated bracer stack',bracerTicks[1]],['before receiver death',deathTick-1],['after receiver death',deathTick]],initialSha256:sha(JSON.stringify(initial)),terminalSha256:sha(JSON.stringify(state)),eventsSha256:sha(JSON.stringify(events)),frames};
  console.log(JSON.stringify({seed,grantTick,firstPulse,bracerTicks,deathTick}));break;
 }
 if(!chosen)fs.writeFileSync('artifacts/v25-online-rules-recording/chest-search-rejected.json',JSON.stringify(candidates,null,2)+'\n');
 assert(chosen,'No authentic trial found in the bounded search');
 const text=JSON.stringify(chosen,null,2)+'\n';
 if(check)assert.equal(fs.readFileSync(output,'utf8'),text);else fs.writeFileSync(output,text);
 const sources=['scripts/record-chest-trial-v25.cjs','tests/fixtures/v25-online-rules-chest-trial.ts','tests/fixtures/b8-public-equipment.ts','tests/fixtures/m5/oracle.g2.cjs'];
 const audit={epoch:'v25-online-rules',reason:'seed554 Prismatic Prelude replaced Manaflow I and the v23 stage bans keep Manaflow I out of 2-1; search silver 2-1 seeds with the default pick, preserving Archangel grant, two bracer stacks, three pulses, death and full continuation assertions',sourceDigests:Object.fromEntries(sources.map(p=>[p,sha(fs.readFileSync(p))])),fixtureBytes:Buffer.byteLength(text),fixtureSha256:sha(text),seed:chosen.seed};
 const auditPath='docs/evidence/v25-online-rules/chest-trial-audit.json',auditText=JSON.stringify(audit,null,2)+'\n';
 if(check)assert.equal(fs.readFileSync(auditPath,'utf8'),auditText);else{fs.writeFileSync(auditPath,auditText);fs.writeFileSync('docs/evidence/v25-online-rules/chest-trial-search.json',JSON.stringify(candidates,null,2)+'\n');}
 }finally{await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
