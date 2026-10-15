// Run identical first-overtime input on the actual old and new implementations.
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function main(){
 const oldRoot=process.argv[2];assert(oldRoot,'Supply a read-only T13 worktree (99d9eff)');
 const {createServer}=await import('vite');const servers=[];
 try{
 const reports=[];
 for(const root of [oldRoot,process.cwd()]){
  const server=await createServer({root,configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'});servers.push(server);
  const api=await server.ssrLoadModule('/src/server-entry/index.ts'),h=await server.ssrLoadModule('/tests/t5r-helpers.ts');
  const base=h.finalSettlement();const a=h.accepted(api.advanceMultiplayerRound({...base,preparation:{...base.preparation,units:[]}},base.round));const b={...a,multiplayer:{...a.multiplayer,seatId:'B'}};
  const battle=api.resolveTwoSidedBattle(api.compileBattle(api.snapshotForBattle(a,'A'),api.snapshotForBattle(b,'B'),42,{battleId:'p3-first-overtime'}),1201),p=api.proposeSettlement(battle);
  const ended=h.settle(a,battle,p.a);
  reports.push({contentDigest:a.contentDigest,roundId:a.roundDefinitionId,combatEventsSha256:sha(battle.events),terminalSha256:sha(battle.terminal),proposal:p.a,record:ended.roundResults.at(-1),rng:{before:[a.rngState,a.rewardRngState,a.choiceRngState],after:[ended.rngState,ended.rewardRngState,ended.choiceRngState]}});
 }
 const [old,current]=reports;assert.equal(old.roundId,'overtime-1');assert.equal(old.proposal.baseDamage,12);assert.equal(current.proposal.baseDamage,17);
 assert.equal(old.combatEventsSha256,current.combatEventsSha256);assert.equal(old.terminalSha256,current.terminalSha256);assert.deepEqual(old.rng,current.rng);
 assert.deepEqual({...old.proposal,baseDamage:17,damage:17},current.proposal);
 assert.deepEqual({...old.record,baseDamage:17,playerDamage:17,hpLost:17,hpAfter:83},current.record);
 const evidence={oldCommit:'99d9eff',command:'node scripts/record-p3p4p5-overtime.cjs <read-only-T13-worktree>',firstGameplayDifference:'overtime-1 proposal.baseDamage 12→17; damage 12→17; settlement HP 88→83. Same tick0 empty-v-empty draw, combat events, terminal, income, XP, shops and RNG.',old,current};
 fs.mkdirSync('docs/evidence/p3p4p5',{recursive:true});fs.writeFileSync('docs/evidence/p3p4p5/overtime-first-difference.json',JSON.stringify(evidence,null,2)+'\n');console.log(evidence.firstGameplayDifference);
 }finally{for(const s of servers)await s.close();}
}main().catch(e=>{console.error(e);process.exitCode=1;});
