/* Cross-revision engine oracle; deliberately untimed and separate from measurements. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process'), { createHash } = require('node:crypto');
const arg = (name, fallback) => process.argv.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3) ?? fallback;
const root = path.resolve(__dirname,'..'), baseline = path.resolve(arg('baseline','/workspace/m8-node3-base'));
const out = path.resolve(arg('out',path.join(root,'artifacts/node3-equivalence')));
const sha = p => execFileSync('git',['rev-parse','HEAD'],{cwd:p,encoding:'utf8'}).trim();
const frozen = new WeakSet();
function freeze(x) { if (x && typeof x === 'object' && !frozen.has(x)) { frozen.add(x); for (const v of Object.values(x)) freeze(v); Object.freeze(x); } return x; }
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
(async()=>{
 const {createServer}=await import('vite'), servers=[];
 try {
  const entries=[];
  for(const r of [baseline,root]) {
   const server=await createServer({root:r,logLevel:'error',server:{middlewareMode:true,ws:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});servers.push(server);
   const fixture=require(path.join(r,'tests/fixtures/m8/pressure-9v9.cjs'));
   entries.push({fixture,m:await fixture.loadModules(server)});
  }
  assert.equal(hash(entries[0].fixture.SPEC),hash(entries[1].fixture.SPEC));
  const results=[];
  for(const variant of ['distinct','mirror']) for(let seed=1;seed<=30;seed++) {
   const initial=entries.map(e=>e.fixture.build(e.m,seed,variant).step);
   assert.deepStrictEqual(initial[1],initial[0]);
   let states=initial.map(x=>freeze(x.state)), ticks=0;
   const ledgers=initial.map(x=>[...x.events]);
   while(states[0].status!=='finished') {
    const next=entries.map((e,i)=>e.m.combat.stepCombat(states[i]));
    assert.deepStrictEqual(next[1],next[0],`${variant}/${seed}/tick${states[0].tick+1}: full state/events`);
    if([0,39,40,41].includes(states[0].tick)) {
     // Engine fixture is not a public Match: this is a JSON transport continuation,
     // not a claim that restoreMatch accepts synthetic economy/round provenance.
     for(let i=0;i<2;i++) assert.deepStrictEqual(entries[i].m.combat.stepCombat(JSON.parse(JSON.stringify(states[i]))),next[i]);
    }
    states=next.map(x=>freeze(x.state)); next.forEach((x,i)=>ledgers[i].push(...x.events));ticks++;
   }
   assert.deepStrictEqual(ledgers[1],ledgers[0]);
   for(let i=0;i<2;i++) assert.deepStrictEqual(entries[i].m.combat.stepCombat(states[i]),entries[i].m.combat.stepCombat(JSON.parse(JSON.stringify(states[i]))));
   results.push({variant,seed,ticks,events:ledgers[0].length,stateHash:hash(states[0]),eventHash:hash(ledgers[0]),result:states[0].result});
   console.log(`${variant}/${seed}: ${ticks} ticks, ${ledgers[0].length} events equal`);
  }
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({baseline:sha(baseline),candidate:sha(root),dirty:execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),specSha256:hash(entries[0].fixture.SPEC),passed:true,combats:results.length,ticks:results.reduce((n,x)=>n+x.ticks,0),frozenInput:true,fullStateAndLedger:true,jsonContinuationTicks:[0,39,40,41,'end'],results},null,2)+'\n');
 } finally {for(const s of servers)await s.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
