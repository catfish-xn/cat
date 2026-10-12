const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {gzipSync} = require('node:zlib');
const root = path.resolve(__dirname, '..');
(async () => {
  assert.match(process.version, /^v22\./);
  const api = await import(pathToFileURL(path.join(root, 'dist-server/index.mjs')).href);
  const sizes = [];
  for (const large of [false, true]) {
    const base = api.createMatch(42);
    const state = {...base, round:4, roundDefinitionId:'2-1', level:9,
      m8:{...base.m8,round:{roundId:'2-1',ordinal:4,stage:2,subround:1,kind:'pvp',isFinal:false,encounterId:null,displayName:'2-1'}},
      preparation:{...base.preparation, units:(large?['irelia','leona','tristana','maddie','lux','darius']:['maddie']).map((definitionId,i)=>({
        id:`unit-${i+1}`, definitionId, team:'player', starLevel:1, location:{kind:'board',cell:{col:i,row:i<2?4:7}}})),},
      items:large?[{id:'item-1',definitionId:'bloodthirster',location:{kind:'unit',unitId:'unit-1',slot:0}}]:[]};
    const battle = api.resolveTwoSidedBattle(api.compileBattle(api.snapshotForBattle(state,'A'),api.snapshotForBattle(state,'B'),42,{battleId:'replay'}),1201);
    const replay = api.toCombatReplay(battle);
    let view = replay.initial;
    for (const frame of replay.ticks) view = api.applyCombatReplayTick(view,frame);
    assert.deepStrictEqual(view,replay.terminal);
    assert.deepStrictEqual(replay.terminal,api.toCombatViewState(battle.terminal));
    const raw = [battle.initial];let combat = battle.initial;
    while (combat.status==='running') {combat=api.stepCombat(combat).state;raw.push(combat);}
    const full = Buffer.from(JSON.stringify(raw)), compact = Buffer.from(JSON.stringify(replay));
    assert(compact.length < full.length / 3);
    assert(!/rngState|rngDraws|strategy|tasks|battleSeed/.test(compact.toString()));
    sizes.push({fixture:large?'6v6':'1v1',ticks:battle.terminal.tick,fullBytes:full.length,replayBytes:compact.length,
      replayRatio:compact.length/full.length,fullGzipBytes:gzipSync(full).length,replayGzipBytes:gzipSync(compact).length});
    const before = JSON.stringify(state), projected = api.toPrivateSeatView(state);
    assert.deepStrictEqual(projected,api.toPrivateSeatView({...state,rngState:999,choiceRngState:888}));
    assert.equal(JSON.stringify(state),before);
  }
  const out = path.join(root,'artifacts/t5r-projections');fs.mkdirSync(out,{recursive:true});
  const report = {node:process.version,keyframeInterval:api.COMBAT_REPLAY_KEYFRAME_INTERVAL,sizes};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
