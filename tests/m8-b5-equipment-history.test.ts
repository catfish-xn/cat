import { M8_VERSION } from '../src/simulation/m8/version';
import {ITEM_DEFINITIONS} from '../src/simulation/content/items';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMatch, startMatchCombat, stepMatch, buyUnit, sellUnit, rerollShop, deployMatchUnit, buyXp, combineItems, equipItem, nextRound } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import type { MatchState } from '../src/simulation/match-types';
import { initializeStreams, validateEquipmentState } from '../src/simulation/m8/equipment';
import { TEMPORARY_EQUIPMENT_POOL } from '../src/simulation/temporary-equipment';
import { BattleHistory, validateBattleCollection } from '../src/replay';
import { CompletedBattleHistory } from './fixtures/completed-battle-history';
import { installAugmentReplayCommandCache } from './fixtures/augment-replay-command-cache';
import { validateEnvelope } from '../src/persistence/format';
import type { SaveEnvelope } from '../src/m6/contracts';
import { installB1Offers } from './fixtures/b1-scripted-offers';
import { accepted, emptyBoard } from './match-helpers';
import { publicEquipmentPreparation, finishPublicEquipmentBattle, resolvePublicEquipmentChoices as choices } from './fixtures/b8-public-equipment';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

const AUGMENTS=['fractured-crystals'];
function start(equipped = true, history?: BattleHistory): MatchState {
  // v25 no longer naturally offers this card on seed 42. The suite scripts the
  // 2-1 draw only: once acquired, eligibility excludes it from all later draws.
  let state = publicEquipmentPreparation(['gloves', 'gloves'], { history, earliestRound:15, augmentPriorities:AUGMENTS });
  if(history){
    const shared=publicEquipmentPreparation(['gloves','gloves'],{earliestRound:15,augmentPriorities:AUGMENTS});
    expect(shared).toEqual(state); expect(shared).not.toBe(state);
  }
  // Fixture self-check under installB1Offers, not a natural-RNG assertion.
  expect(state.augments.filter(a=>a.definitionId==='fractured-crystals'))
    .toEqual([{definitionId:'fractured-crystals',choiceId:'round:2-1:augment',acquiredRound:4}]);
  const gloves = state.items.filter(item => item.definitionId === 'gloves');
  const parent = `item-${state.nextItemSerial}`;
  state = accepted(combineItems(state, gloves[0].id, gloves[1].id));
  if (equipped) state = accepted(equipItem(state, parent, 'unit-1', 0));
  return emptyBoard(state);
}
function settle(state: MatchState, history?: BattleHistory): MatchState {
  // Real shop purchases keep the historical XP/equipment route alive under G2-3.
  // Retain the original holder and its independent seed-42 equipment stream.
  const protectedDefinition=state.preparation.units.find(u=>u.id==='unit-1')!.definitionId;
  const targets=['darius','vander','maddie','zyra','rell'].filter(id=>id!==protectedDefinition);
  const roster=state.preparation.units.filter(u=>u.team==='player').sort((a,b)=>
    (b.starLevel-a.starLevel)||Number(b.id==='unit-1')-Number(a.id==='unit-1'));
  for(const unit of roster){
    if(state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board').length>=state.level)break;
    if(unit.location.kind!=='bench')continue;
    const ranged=['maddie','zyra','lux','powder'].includes(unit.definitionId);
    const cells=Array.from({length:28},(_,i)=>({col:[3,2,4,1,5,0,6][i%7],row:ranged?7-Math.floor(i/7):4+Math.floor(i/7)}));
    const cell=cells.find(c=>!state.preparation.units.some(u=>u.location.kind==='board'&&u.location.cell.col===c.col&&u.location.cell.row===c.row))!;
    state=accepted(deployMatchUnit(state,unit.id,{kind:'board',cell}));
  }
  // Deploy before buying: emptyBoard can fill all nine bench slots. Buying
  // first then aborts on bench-full and leaves the survival army at one star.
  if(state.roundDefinitionId >= '2-5'){
    const budget=state.gold-20;
    let spent=0;
    for(let n=0;n<40&&spent<budget&&state.gold>=5;n++){
      const slot=state.shop.slots.findIndex(o=>o.status==='available'&&targets.includes(o.definitionId)
        &&state.preparation.units.filter(u=>u.team==='player'&&u.definitionId===o.definitionId).reduce((sum,u)=>sum+3**(u.starLevel-1),0)<9);
      const before=state.gold;
      const result=slot<0?rerollShop(state):buyUnit(state,slot,state.shop.generation);
      if(!result.ok)break;state=result.state;spent+=before-state.gold;
    }
  }
  // New v17 drops are real surplus components. Spend them on the paid army,
  // retaining the original TG parent and every natural XP/roll boundary.
  for(const id of ['warmog','dragons-claw','shojin','gunblade','deathcap','rageblade','gargoyle','giant-slayer','infinity-edge','last-whisper','hand-of-justice']){
    const available=state.items.filter(i=>i.location.kind==='inventory'),chosen:string[]=[];
    for(const part of ITEM_DEFINITIONS[id].recipe!){const item=available.find(i=>i.definitionId===part&&!chosen.includes(i.id));if(item)chosen.push(item.id);}
    if(chosen.length===2)state=accepted(combineItems(state,chosen[0],chosen[1]));
  }
  for(const item of state.items.filter(i=>i.location.kind==='inventory')){
    if(item.definitionId==='thiefs-gloves')continue;
    let placed=false;
    for(const unit of state.preparation.units.filter(u=>u.team==='player'&&u.id!=='unit-1'&&u.location.kind==='board').sort((a,b)=>b.starLevel-a.starLevel)){
      for(let slot=0;slot<3;slot++){
        if(state.items.some(i=>i.location.kind==='unit'&&i.location.unitId===unit.id&&i.location.slot===slot))continue;
        const result=equipItem(state,item.id,unit.id,slot);if(result.ok){state=result.state;placed=true;break;}
      }
      if(placed)break;
    }
  }
  const done=choices(finishPublicEquipmentBattle(state, history));
  return done;
}
const progressionCache = new Map<boolean, MatchState>();
function historicalProgression(equipped = true, history?: BattleHistory): MatchState {
  if(!history&&progressionCache.has(equipped))return structuredClone(progressionCache.get(equipped)!);
  let state = start(equipped,history);
  while (state.round < getCatalogRoundById('4-5').ordinal) {
    if (state.phase === 'preparation') state = settle(state, history);
    expect(state.phase).toBe('settlement');
    while(state.m8.loot.direct.some(d=>d.status==='pending-capacity')){const extra=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench'&&u.id!=='unit-1')!;state=accepted(sellUnit(state,extra.id));}
    state = choices(accepted(nextRound(state, state.round)));
    while(state.preparation.units.filter(u=>u.team==='player').length>state.preparation.benchSize){
      const excess=state.preparation.units.filter(u=>u.team==='player'&&u.id!=='unit-1')
        .sort((a,b)=>a.starLevel-b.starLevel||a.id.localeCompare(b.id)).find(u=>!['darius','vander','maddie','zyra','rell'].includes(u.definitionId))
        ??state.preparation.units.filter(u=>u.team==='player'&&u.id!=='unit-1').sort((a,b)=>a.starLevel-b.starLevel)[0];
      state=accepted(sellUnit(state,excess.id));
    }
    if(state.phase==='preparation')state=emptyBoard(state);
  }
  // T11: 6 opening XP + 18 * 2 XP = 42; cumulative level-six cost is 40.
  expect([state.level, state.xp]).toEqual([6, 2]);
  while (state.level < 7) state = accepted(buyXp(state));
  progressionCache.set(equipped,structuredClone(state));
  return state;
}
function rejectWithoutRepair(raw: MatchState): void {
  const before = JSON.stringify(raw);
  expect(() => restoreMatch(raw)).toThrow(/equipment.*level/);
  expect(() => restoreMatch(before)).toThrow(/equipment.*level/);
  expect(() => serializeMatch(raw)).toThrow(/equipment.*level/);
  expect(JSON.stringify(raw)).toBe(before);
}
function mutableObjects(root: unknown): object[] {
  const seen = new Set<object>(), pending = [root], mutable: object[] = [];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    if (!Object.isFrozen(value)) mutable.push(value);
    pending.push(...Object.values(value));
  }
  return mutable;
}

describe('B5 audit R1: equipment roll level belongs to its round history', () => {
  let restoreOffers = () => {};
  let replayCache: ReturnType<typeof installAugmentReplayCommandCache>;
  // Keep the same pure draw policy for construction and every history replay.
  beforeAll(() => { restoreOffers = installB1Offers(AUGMENTS); replayCache = installAugmentReplayCommandCache(); });
  afterAll(() => { replayCache?.restore(); restoreOffers(); });
  const archiveHistory = new CompletedBattleHistory('b5-r1');
  let archivedState: MatchState;
  let independentlyReplayedState: MatchState;
  // Generate the public command/history fixture separately from its save assertions.
  // 临时、用户 10-20 批准：只因 CI 机器计时超时（断言都过），按约 2 倍放宽；断言不变。钩子 10 秒 → 20 秒（CI 上钩子超时 3 次）。
  beforeAll(() => { archivedState = historicalProgression(true, archiveHistory); }, 20_000);
  beforeAll(() => { historicalProgression(false); }, 20_000);
  beforeAll(() => {
    // Only independent restore replay may populate the cache. Equal serialized
    // live states can have different trace/preparation/acquisition side data.
    expect(replayCache.counts.recorded).toBe(0);
    const mutable = mutableObjects(archivedState);
    expect(restoreMatch(archivedState)).toEqual(archivedState);
    expect(replayCache.counts.hits).toBe(0);
    expect(replayCache.counts.recorded).toBeGreaterThan(0);
    expect(mutable.filter(Object.isFrozen)).toEqual([]);
    independentlyReplayedState = replayCache.lastReplayState!;
    replayCache.seal();
  }, 20_000);
  it('rejects a historical level5 roll forged as level7 with RNG-consistent two completed items', () => {
    const state = historicalProgression();
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    const raw = structuredClone(state);
    expect(state.roundResults[getCatalogRoundById('2-1').ordinal-1]).toMatchObject({ levelBefore: 3, levelAfter: 3 });
    expect(raw.equipmentState.rolls[0]).toMatchObject({ playerLevelSnapshot: 5, children: ['bramble-vest', 'cloak'] });
    Object.assign(raw.equipmentState.rolls[0], { playerLevelSnapshot: 7, children: ['bramble-vest', 'adaptive-helm'] });
    // Same independently known two words; replaying RNG alone cannot detect the false historical level.
    expect(() => validateEquipmentState(raw.equipmentState, TEMPORARY_EQUIPMENT_POOL, initializeStreams(42).equipment)).not.toThrow();
    expect(raw.equipmentState.equipment).toEqual(state.equipmentState.equipment);
    expect(raw.temporaryEquipment).toEqual(state.temporaryEquipment);
    rejectWithoutRepair(raw);
  });
  it.each([['settled supply round', '4-4'], ['unsettled current round', '4-5']])(
    'rejects a roll below the previous settlement level in a %s', (_label, roundId) => {
      const state = historicalProgression();
      expect(restoreMatch(serializeMatch(state))).toEqual(state);
      const raw = structuredClone(state), roll = raw.equipmentState.rolls.find(r => r.roundId === roundId)!;
      expect(raw.roundResults[getCatalogRoundById('4-3').ordinal-1]).toMatchObject({ levelBefore: 5, levelAfter: 6 });
      expect(roll.playerLevelSnapshot).toBe(6);
      Object.assign(roll, { playerLevelSnapshot: 5 }); // Same low-level pool, unchanged pair/words.
      expect(() => validateEquipmentState(raw.equipmentState, TEMPORARY_EQUIPMENT_POOL, initializeStreams(42).equipment)).not.toThrow();
      rejectWithoutRepair(raw);
    });
  it('rejects a roll above even the T12 post-settlement levelAfter bound', () => {
    const state = historicalProgression();
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    const raw = structuredClone(state);
    expect(raw.roundResults[getCatalogRoundById('3-6').ordinal-1]).toMatchObject({ levelBefore: 5, levelAfter: 5 });
    Object.assign(raw.equipmentState.rolls.find(r => r.roundId === '3-6')!, { playerLevelSnapshot: 6 });
    expect(() => validateEquipmentState(raw.equipmentState, TEMPORARY_EQUIPMENT_POOL, initializeStreams(42).equipment)).not.toThrow();
    rejectWithoutRepair(raw);
  });
  it('preserves a legal pre-F roll through current, settled and historical save/restore', () => {
    let state = historicalProgression();
    const roll = structuredClone(state.equipmentState.rolls.find(r => r.roundId === '4-5')!);
    expect(roll.playerLevelSnapshot).toBe(6); expect(state.level).toBe(7);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    state = settle(state);
    expect(state.roundResults[getCatalogRoundById('4-5').ordinal-1]).toMatchObject({ levelBefore: 7, levelAfter: 7 });
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    state = accepted(nextRound(state, state.round)); // 4-6 opens the real anomaly choice.
    expect(state.equipmentState.rolls.find(r => r.roundId === '4-5')).toEqual(roll);
    expect(state.equipmentState.rolls.at(-1)?.playerLevelSnapshot).toBe(7);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
  });
  it('allows the first equip after same-round F at the upper bound, not only the starting level', () => {
    let state = historicalProgression(false);
    expect(state.equipmentState.rolls).toEqual([]);
    state = accepted(equipItem(state, state.items.find(item => item.definitionId === 'thiefs-gloves')!.id, 'unit-1', 0));
    expect(state.roundResults[getCatalogRoundById('4-4').ordinal-1].levelAfter).toBe(6);
    expect(state.equipmentState.rolls[0]).toMatchObject({ roundId: '4-5', playerLevelSnapshot: 7 });
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    state = settle(state);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
  });
  it('validates round economy before consulting its level bounds for equipment', () => {
    const state = historicalProgression();
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    const raw = structuredClone(state);
    Object.assign(raw.roundResults[getCatalogRoundById('2-1').ordinal-1], { levelAfter: 4 });
    expect(() => restoreMatch(raw)).toThrow(/history XP/);
  });
  describe('archived save envelope', () => {
    let envelope: SaveEnvelope;
    beforeAll(async () => {
      envelope = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
        runId: 'b5-r1', createdAt: '2026-10-09T00:00:00.000Z', match: structuredClone(archivedState),
        battles: archiveHistory.completedRecords, currentBattle: null };
      // Fully validate the shared control before exercising the forged copy.
      replayCache.resetBattleCounts();
      const priorHits = replayCache.counts.hits;
      const mutable = mutableObjects(envelope.match);
      await expect(validateEnvelope(envelope, validateBattleCollection)).resolves.toEqual(envelope);
      expect(mutable.filter(Object.isFrozen)).toEqual([]);
      // Memoization is confined to augment proof reconstruction. Every archived
      // battle still starts and executes every original replay tick here.
      expect(replayCache.counts.battleStarts).toBe(envelope.battles.length);
      expect(replayCache.counts.battleTicks).toBe(envelope.battles.reduce((ticks, battle) => ticks + battle.endTick, 0));
      expect(replayCache.counts.hits).toBeGreaterThan(priorHits);
    }, 20_000);
    it('rejects the forged historical level through full save-envelope validation without changing archived battles', async () => {
      expect(envelope.battles.map(battle => battle.context.roundDefinitionId))
        .toEqual(['1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-5', '2-6', '2-7', '3-1', '3-2', '3-3', '3-5', '3-6', '3-7', '4-1', '4-2', '4-3']);
      expect(envelope.battles.slice(0, 3).every(battle => battle.endTick > 0 && battle.events.length > 0)).toBe(true);
      expect(envelope.battles.find(b=>b.context.roundDefinitionId==='3-5')!.context.equipmentState.rolls[0].playerLevelSnapshot).toBe(5);
      const raw = structuredClone(envelope);
      Object.assign(raw.match.equipmentState.rolls[0], { playerLevelSnapshot: 7, children: ['bramble-vest', 'adaptive-helm'] });
      const before = JSON.stringify(raw);
      await expect(validateEnvelope(raw, validateBattleCollection)).rejects.toThrow(/equipment.*level/);
      expect(JSON.stringify(raw)).toBe(before);
    });
  });
  it.each(['origin', 'command', 'facts'] as const)('rejects a forged augment proof %s after warming shared replay prefixes', field => {
    const raw = structuredClone(archivedState), history = raw.augmentHistory!;
    if (history.proof.kind !== 'solo') throw new Error('Expected a solo fixture proof');
    if (field === 'origin') Object.assign(history.proof.origin, { gold: history.proof.origin.gold + 1 });
    else if (field === 'command') {
      // A suffix command must select another branch, even after the authentic
      // origin and every earlier command have been replayed and cached.
      const command = [...history.proof.commands].reverse().find(command => command.name === 'buyXp')!;
      Object.assign(command, { name: 'rerollShop' });
    } else Object.assign(history, { facts: history.facts.slice(0, -1) });
    const before = JSON.stringify(raw);
    const failure = () => {
      try { restoreMatch(raw); return null; }
      catch (error) { if (!(error instanceof Error)) throw error; return error.message; }
    };
    const priorHits = replayCache.counts.hits;
    const priorMisses = replayCache.counts.misses;
    const priorExecutions = replayCache.counts.executions;
    const cachedFailure = failure();
    expect(cachedFailure).not.toBeNull();
    expect(cachedFailure).toBe('Invalid augment history: replayed facts/state mismatch');
    if (field !== 'origin') expect(replayCache.counts.hits).toBeGreaterThan(priorHits);
    const replayed = replayCache.lastReplayState!;
    if (field === 'origin') {
      expect(replayCache.counts.hits).toBe(priorHits);
      expect(replayCache.counts.misses).toBeGreaterThan(priorMisses);
      expect(replayCache.counts.executions - priorExecutions).toBe(history.proof.commands.reduce((n, c) => n + c.count, 0));
      expect(replayed.augmentHistory!.proof).toEqual(history.proof);
      expect(replayed.gold).toBeGreaterThan(archivedState.gold);
    } else if (field === 'command') {
      expect(replayCache.counts.misses - priorMisses).toBe(1);
      expect(replayCache.counts.executions - priorExecutions).toBe(1);
      expect(replayed.augmentHistory!.proof).toEqual(history.proof);
      expect(replayed.gold).toBe(archivedState.gold + 2); // Reroll costs 2; the replaced XP purchase costs 4.
      expect(replayed.shop.generation).toBe(archivedState.shop.generation + 1);
    } else {
      expect(replayCache.counts.misses).toBe(priorMisses);
      expect(replayCache.counts.executions).toBe(priorExecutions);
      expect(replayed).toEqual(archivedState);
      expect(replayed).toBe(independentlyReplayedState); // Preserve every WeakMap association on recall.
      expect(replayed.augmentHistory!.facts).toHaveLength(history.facts.length + 1);
    }
    expect(JSON.stringify(raw)).toBe(before);
  });
});

it('completed fixture batching preserves every record byte and rejects live-prefix use',()=>{
 const ordinary=new BattleHistory('batch-control'),batched=new CompletedBattleHistory('batch-control');
 let state=createMatch(42);
 const observe=(result:ReturnType<typeof stepMatch>)=>{
  const change={before:state,after:result.state,events:result.events.filter(e=>e.domain==='combat'),reason:'tick' as const};
  ordinary.observe(change);batched.observe(change);state=result.state;
 };
 const start=startMatchCombat(state);if(!start.ok)throw Error(start.reason);observe(start);
 expect(()=>batched.capturePrefix()).toThrow('no live prefix');
 while(state.phase==='combat')observe(stepMatch(state));
 expect(batched.completedRecords).toHaveLength(1);
 expect(JSON.stringify(batched.completedRecords)).toBe(JSON.stringify(ordinary.completedRecords));
 expect(batched.completedRecords[0].events.length).toBeGreaterThan(0);
});
