// Diagnostic only: one seed, existing public-command route driver, no state edits/grants.
const path=require('node:path');
const root=process.cwd();
(async()=>{const {createServer}=await import('vite');const server=await createServer({root,server:{middlewareMode:true,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'});
try{const api=await server.ssrLoadModule('/src/simulation/match.ts');const {readG23Progress}=await server.ssrLoadModule('/src/simulation/g2-3-state.ts');
// Diagnostic driver only: use actual public balances; the old M5 economic oracle does not include G23 rewards.
const Module=require('node:module'),fs=require('node:fs'),filename=path.join(root,'scripts/generate-m5-route.cjs');
const driver=new Module(filename,module);driver.filename=filename;driver.paths=Module._nodeModulePaths(path.dirname(filename));
const source=fs.readFileSync(filename,'utf8');if(!source.includes('ledger.apply(before,state,command,result.events);'))throw Error('driver changed');
driver._compile(source.replace('ledger.apply(before,state,command,result.events);','/* diagnostic: actual public-command balances drive purchases */'),filename);const route=driver.exports;
route.BUILDS['diagnostic-conqueror']={core:'ambessa',tank:'darius',units:['darius','draven','rell','swain','ambessa','mordekaiser','irelia','leona'],carry:['deathblade','shojin','gunblade'],early:'draven'};
const result=await route.run(api,{build:'diagnostic-conqueror',seed:42,onStep(before,result){if(before.phase==='combat'&&result.state.phase!=='combat'){const s=result.state,p=readG23Progress(s);console.log(JSON.stringify({round:s.roundDefinitionId,hp:s.playerHp,gold:s.gold,level:s.level,stacks:p.conquest.stacks,chests:p.conquest.chestsOpened,board:s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board').map(u=>[u.definitionId,u.starLevel]),newReceipts:s.seatMechanics.receipts.slice(before.seatMechanics.receipts.length),crowns:s.items.filter(i=>i.definitionId==='TFT_Item_ForceOfNature').length}));}}});
console.log(JSON.stringify({summary:result.summary,conquest:readG23Progress(result.final).conquest}));
}finally{await server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
