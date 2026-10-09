const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
(async()=>{const root=process.cwd(),source=fs.readFileSync(root+'/scripts/verify-m8-u3-dynamic.cjs','utf8');
 const {createServer}=await import(root+'/node_modules/vite/dist/node/index.js');const server=await createServer({root,server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]}});
 try{const api=await server.ssrLoadModule('/src/simulation/match.ts');
 const start=source.indexOf('        const accepted = result =>'),end=source.indexOf('        const scene = window.__U3_SCENE__;',start);assert(start>=0&&end>start);
 const setup=new Function('api','kind',source.slice(start,end)+'\nreturn state;');
 for(const kind of ['empty','tg','occupied','full','unique']){const state=setup(api,kind),players=state.preparation.units.filter(u=>u.team==='player');
  assert.equal(state.roundDefinitionId,'2-1');assert.equal(state.phase,'preparation');assert.equal(state.level,3);assert.equal(state.nextUnitSerial,4);assert.equal(players.length,3);
  assert.deepEqual(players.map(u=>[u.id,u.definitionId,u.location.cell]),[['unit-1','irelia',{col:1,row:4}],['unit-2','maddie',{col:3,row:4}],['unit-3','lux',{col:5,row:4}]]);
  assert.deepEqual(state.roundResults.map(r=>[r.roundId,r.incomeBreakdown.base,r.xpRequested]),[['1-2',2,2],['1-3',3,2],['1-4',5,0]]);
  console.log(JSON.stringify({kind,roundId:state.roundDefinitionId,phase:state.phase,level:state.level,gold:state.gold,players:players.map(u=>({id:u.id,definitionId:u.definitionId,cell:u.location.cell})),permanentItems:state.items.length,temporaryItems:state.temporaryEquipment.length,scope:'real domain commands from the exact U3 setup source; no Chromium/native input result'}));
 }
 const previous=execFileSync('git',['show','adf24b4ef6f5ec65b3abd59adc050ad2b6b82880:scripts/verify-m8-u3-dynamic.cjs'],{cwd:root,encoding:'utf8'});
 const anchor="    await check('drag-tg-holder'";assert.equal(source.slice(source.indexOf(anchor)),previous.slice(previous.indexOf(anchor)));
 console.log(JSON.stringify({originalNativeCheckBodiesUnchanged:true,checks:(source.match(/await check\('/g)||[]).length,sourceSha256:createHash('sha256').update(source).digest('hex')}));
 }finally{await server.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
