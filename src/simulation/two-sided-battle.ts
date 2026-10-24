import { MAX_COMBAT_TICKS } from './combat-types';
import { drainSetup } from './setup-work';
import { createCombatReplayRecorder, type CombatReplay, type CombatReplayTick, type CombatViewState } from './combat-replay-view';
import { sampleD11CombatGold, validateD11BankSamples } from './d11-fill';
import { readsLiveGold } from './live-gold-readers';
import { type BattleTickInputSource, type BattleEquipmentInput } from './battle-input-log';
import { prepareBattleEquipment, installBattleEquipmentBatch, validateBattleEquipmentLog, type BattleEquipmentReceipt } from './battle-equipment';
import type { MatchState } from './match-types';
import type { CombatBankSample } from './combat-types';
import {projectItemSummons} from './g2-4b-summons';
import {countsG23SurvivorDamage} from './g2-3-summons';
import {g23BattleFacts} from './g2-3-settlement';
import { projectG23Summons } from './g2-3-summons';
import { DEFAULT_BOARD, type Team } from './board';
import { canonicalContent, canonicalContentSteps, digestContent } from './content';
import { createScopedContentFreezer, freezeContent, freezeContentSteps } from './content/freeze';
import { buildStrategySnapshotSteps } from './strategy-snapshot';
import { createCombatWithEvents, createCombatWithEventsSteps, stepCombat, type CombatState, type CombatStep } from './combat';
import { toLedgerEvents } from './combat-ledger';
import { effectKey } from './effects';
import { getMultiplayerRoundById } from './multiplayer-round';
import { validateSeed } from './rng';
import { selectPlayerBaseDamage } from './match-rules';
import type { CombatStrategyInputs } from './combat-input';
import type { EffectSource, SourcedEffect, StrategySnapshot } from './strategy-types';
import { restorePlayerBattleSnapshotSteps } from './two-sided-snapshot';
import {
  BattleValidationError, TWO_SIDED_BATTLE_VERSION, type PlayerBattleSnapshot, type BattleInput,
  type BattleIdMapping, type BattleIdentity, type BattleResult, type BattleSideResult, type SideProposal,
} from './two-sided-types';

const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const localId = (seat: string, kind: string, id: string) => JSON.stringify(['t2', seat, kind, id]);
function* normalizedSteps(value: PlayerBattleSnapshot): Generator<void, PlayerBattleSnapshot, void> {
  const s = yield* restorePlayerBattleSnapshotSteps(value);
  return { ...s, units:[...s.units].sort((a,b)=>order(a.id,b.id)), items:[...s.items].sort((a,b)=>order(a.id,b.id)),
    temporaryEquipment:[...s.temporaryEquipment].sort((a,b)=>order(a.temporaryId,b.temporaryId)),
    augments:[...s.augments].sort((a,b)=>order(a.choiceId,b.choiceId)), persistentGrowth:[...s.persistentGrowth].sort((a,b)=>order(a.unitId,b.unitId)) };
}
function compileSide(s: PlayerBattleSnapshot, team: Team) {
  return drainSetup(compileSideSteps(s, team));
}
function* compileSideSteps(s: PlayerBattleSnapshot, team: Team) {
  const mapping: BattleIdMapping[] = [];
  const map = (kind: BattleIdMapping['kind'], originalId: string) => {
    const combatId = localId(s.seatId, kind, originalId);
    if (!mapping.some(entry => entry.combatId === combatId)) mapping.push({ seatId:s.seatId, kind, originalId, combatId });
    return combatId;
  };
  // Compile each side as its own player first: no fixed enemy projection, and back-row/buddy
  // effects use the owner's preparation coordinates before B is mirrored to the upper half.
  const preparation = { board:structuredClone(DEFAULT_BOARD), benchSize:9, units:s.units.map(unit => ({...unit,id:map('unit',unit.id)})) };
  const inputs: CombatStrategyInputs = {
    round:getMultiplayerRoundById(s.roundId).ordinal, preparation,
    ...(s.d14Combat?{d14Combat:{...s.d14Combat,unitId:map('unit',s.d14Combat.unitId)}}:{}),
    ...(s.itemSummonPositions?{itemSummonPositions:Object.fromEntries(Object.entries(s.itemSummonPositions).map(([id,cell])=>[map(id.startsWith('unit-')?'unit':'item',id),cell]))}:{}),...(s.bankGold===undefined?{}:{bankGold:s.bankGold}),playerHp:s.playerHp,g23:s.g23,priorPvpWins:s.priorPvpWins??0,
    items:s.items.map(item => ({...item,id:map('item',item.id),location:item.location.kind === 'unit'
      ? {...item.location,unitId:map('unit',item.location.unitId)} : item.location})),
    temporaryEquipment:s.temporaryEquipment.map(child => ({...child,temporaryId:map('temporary-item',child.temporaryId),
      parentItemInstanceId:map('item',child.parentItemInstanceId),holderId:map('unit',child.holderId)})),
    augments:s.augments.map(augment=>({...augment,choiceId:map('augment',augment.choiceId)})),
    anomalyBinding:s.anomalyBinding ? {...s.anomalyBinding,unitId:map('unit',s.anomalyBinding.unitId),choiceId:map('anomaly',s.anomalyBinding.choiceId)} : null,
    persistentGrowth:s.persistentGrowth.map(growth=>({...growth,unitId:map('unit',growth.unitId)})), augmentProgress:s.augmentProgress,
  };
  let compiled: StrategySnapshot;
  try { compiled = yield* buildStrategySnapshotSteps(inputs); }
  catch { throw new BattleValidationError('invalid-snapshot'); }
  // Trait instances also get a seat namespace (unit owners were already isolated).
  const source = (value: EffectSource): EffectSource => value.sourceKind === 'trait'
    ? {...value,sourceInstanceId:localId(s.seatId,'trait',value.sourceInstanceId)} : value;
  const sourced = (value: SourcedEffect): SourcedEffect => { const mapped = source(value.source); return {...value,source:mapped,key:effectKey(mapped)}; };
  return {
    mapping, inputs,
    units:projectItemSummons(projectG23Summons(preparation,undefined,inputs.itemSummonPositions),compiled).units.map(unit=>({...unit,team,location:unit.location.kind === 'board'
      ? {kind:'board' as const,cell:{col:unit.location.cell.col,row:team === 'player' ? unit.location.cell.row : DEFAULT_BOARD.rows - 1 - unit.location.cell.row}}
      : unit.location})),
    strategy:{ traits:compiled.traits.filter(trait=>trait.team === 'player').map(trait=>({...trait,team})),
      units:compiled.units.map(unit=>({...unit,...(unit.itemSummon?{itemSummon:{...unit.itemSummon,
        unit:{...unit.itemSummon.unit,team,location:unit.itemSummon.unit.location.kind==='board'?{kind:'board' as const,cell:{col:unit.itemSummon.unit.location.cell.col,row:team==='player'?unit.itemSummon.unit.location.cell.row:DEFAULT_BOARD.rows-1-unit.itemSummon.unit.location.cell.row}}:unit.itemSummon.unit.location},
        formCell:{col:unit.itemSummon.formCell.col,row:team==='player'?unit.itemSummon.formCell.row:DEFAULT_BOARD.rows-1-unit.itemSummon.formCell.row}}}:{}),sources:unit.sources.map(sourced),triggers:unit.triggers.map(trigger=>{
        const mapped=source(trigger.source); return {...trigger,source:mapped,key:effectKey(mapped)};
      }), mechanics:unit.mechanics?.map(mechanic=>mechanic.source.sourceKind === 'trait'
        ? {...mechanic,source:{...mechanic.source,instanceId:localId(s.seatId,'trait',mechanic.source.instanceId)}} : mechanic)})) },
  };
}

/** The optional identity is required for production scheduling; the default is diagnostic only. */
export function compileBattle(a: PlayerBattleSnapshot, b: PlayerBattleSnapshot, battleSeed: number, identity?: BattleIdentity): BattleInput {
  return drainSetup(compileBattleSteps(a, b, battleSeed, identity));
}
export function* compileBattleSteps(a: PlayerBattleSnapshot, b: PlayerBattleSnapshot, battleSeed: number, identity?: BattleIdentity): Generator<void, BattleInput, void> {
  const left = yield* normalizedSteps(a);
  yield;
  const right = yield* normalizedSteps(b);
  yield;
  if (left.seatId === right.seatId) throw new BattleValidationError('seat-collision');
  if (left.roundId !== right.roundId) throw new BattleValidationError('round-mismatch');
  if (getMultiplayerRoundById(left.roundId).kind !== 'pvp') throw new BattleValidationError('round-kind');
  try { validateSeed(battleSeed); } catch { throw new BattleValidationError('invalid-seed'); }
  const battleId = identity === undefined ? `diagnostic:${digestContent({a:left,b:right,battleSeed})}` : identity?.battleId;
  if (typeof battleId !== 'string' || battleId.length === 0) throw new BattleValidationError('invalid-battle-id');
  const mirrorOfSeatId = identity?.mirrorOfSeatId ?? null;
  if (mirrorOfSeatId !== null && mirrorOfSeatId !== right.seatId) throw new BattleValidationError('invalid-mirror');
  const x = yield* compileSideSteps(left,'player');
  yield;
  const y = yield* compileSideSteps(right,'enemy');
  yield;
  // Restored snapshots are detached and deeply frozen; compilation owns every
  // new record. Re-cloning this entire derived graph would only copy owned data.
  return yield* freezeContentSteps({ version:TWO_SIDED_BATTLE_VERSION,battleId,battleSeed,mirrorOfSeatId,a:left,b:right,
    mapping:[...x.mapping,...y.mapping].sort((a,b)=>order(a.combatId,b.combatId)),
    preparation:{board:DEFAULT_BOARD,benchSize:9,units:[...x.units,...y.units]},
    strategy:{traits:[...x.strategy.traits,...y.strategy.traits],units:[...x.strategy.units,...y.strategy.units]},
  });
}

/** Recompile descriptors and compare every derived field; never disable Match restore checks. */
export function restoreBattleInput(input: unknown): BattleInput {
  return drainSetup(restoreBattleInputSteps(input));
}
export function* restoreBattleInputSteps(input: unknown): Generator<void, BattleInput, void> {
  try {
    const value = (typeof input === 'string' ? JSON.parse(input) : input) as BattleInput;
    yield* canonicalContentSteps(value);
    yield;
    if (value?.version !== TWO_SIDED_BATTLE_VERSION) throw new BattleValidationError('battle-input');
    const expected = yield* compileBattleSteps(value.a,value.b,value.battleSeed,{battleId:value.battleId,mirrorOfSeatId:value.mirrorOfSeatId ?? undefined});
    const actualText = yield* canonicalContentSteps(value);
    yield;
    if (actualText !== (yield* canonicalContentSteps(expected))) throw new BattleValidationError('battle-input');
    return expected;
  } catch (error) {
    if (error instanceof BattleValidationError) throw error;
    throw new BattleValidationError('battle-input');
  }
}

/** Use this overload or the bounded resolver whenever the full tick-zero ledger is needed. */
export function startTwoSidedCombatWithEvents(input: BattleInput): CombatStep {
  const checked = restoreBattleInput(input);
  return createCombatWithEvents(checked.preparation,checked.strategy,checked.battleId,checked.battleSeed);
}
export function startTwoSidedCombat(input: BattleInput): CombatState {
  return startTwoSidedCombatWithEvents(input).state;
}

export interface BattleLiveGoldReader {
  readonly seatId: string;
  readonly team: Team;
  readonly readsLiveGold: boolean;
}
/** Trusted snapshots or a compiled input. B is always frozen in a mirror battle. */
export function readBattleLiveGoldReaders(input: Pick<BattleInput, 'a' | 'b' | 'mirrorOfSeatId'>): readonly BattleLiveGoldReader[] {
  const reads = (side: PlayerBattleSnapshot) => readsLiveGold(side.anomalyBinding, side.units
    .filter(u => u.team === 'player' && u.location.kind === 'board').map(u => u.id));
  return [
    { seatId: input.a.seatId, team: 'player', readsLiveGold: reads(input.a) },
    { seatId: input.b.seatId, team: 'enemy', readsLiveGold: input.mirrorOfSeatId === null && reads(input.b) },
  ];
}
function sideResult(seatId: string, mapping: readonly BattleIdMapping[], terminal: CombatState, initial: CombatState, isMirror = false): BattleSideResult {
  const units = mapping.filter(entry=>entry.kind === 'unit' && entry.seatId === seatId).map(entry=>{
    const origin=initial.units.find(unit=>unit.id===entry.combatId);
    if(!origin||origin.itemSummon)throw new BattleValidationError('invalid-result');
    const unit=terminal.units.find(unit=>unit.id === entry.combatId);
    const split=terminal.trenchSplits?.find(split=>split.ownerId===entry.combatId);
    if(!unit&&(!split||!terminal.removedUnitIds?.includes(entry.combatId)))throw new BattleValidationError('invalid-result');
    if(unit&&split)throw new BattleValidationError('invalid-result');
    return {originalId:entry.originalId,unit,growth:unit?.runtime?.permanentAdBps??split?.permanentAdBps??0};
  }).sort((a,b)=>order(a.originalId,b.originalId));
  return { seatId, survivors:units.flatMap(({originalId,unit})=>unit&&countsG23SurvivorDamage(unit)?[{unitId:originalId,definitionId:unit.definitionId,starLevel:unit.starLevel,hp:unit.hp}]:[]),
    growth:isMirror ? [] : units.filter(({growth})=>growth>0).map(({originalId,growth})=>({unitId:originalId,attackDamageBps:growth})),
  };
}

/** BattleResult remains a trusted-rules-output API. For dynamic rosters, verify
 * every terminal field and event against that result's original tick-zero state;
 * the validated BattleInput boundary remains startTwoSidedBattle above. */
function validateDynamicResult(result:BattleResult):void {
  try { validateBattleEquipmentLog(result.inputLog, result.terminal.equipmentReceipts, result.terminal.tick); }
  catch { throw new BattleValidationError('battle-input-invalid'); }
  if (result.initial.equipmentReceipts || result.initial.pendingEquipment || result.terminal.pendingEquipment
    || result.terminal.units.some(u => u.equipment) && !result.inputLog?.length) throw new BattleValidationError('battle-input-invalid');
  validateD11BankSamples(result.bankSamples,result.terminal.tick);
  const enabled=!!result.inputLog?.length || result.initial.strategy?.units.some(u=>u.mechanics?.some(m=>m.mechanic==='g24Trench'||m.mechanic==='s13Anomaly'||m.mechanic==='d11Anomaly'));
  if(result.bankSamples?.some(s=>s.team==='enemy'&&result.mirrorOfSeatId!==null||!result.initial.units.some(u=>u.team===s.team&&u.mechanics?.some(m=>m.mechanic==='d11Anomaly'&&m.source.definitionId==='avarice-incarnate'))))throw new BattleValidationError('invalid-result');
  if(!enabled){
    if(result.terminal.trenchSplits!==undefined||result.terminal.units.some(u=>u.itemSummon?.kind==='trench'))throw new BattleValidationError('invalid-result');
    return;
  }
  if(result.initial.tick!==0||result.initial.trenchSplits!==undefined||result.initial.units.some(u=>u.itemSummon?.kind==='trench')
    ||!Number.isSafeInteger(result.terminal.tick)||result.terminal.tick<0||result.terminal.tick>MAX_COMBAT_TICKS)throw new BattleValidationError('invalid-result');
  let expected=structuredClone(result.initial);
  let bankCursor=0;
  // Tick-zero events already belong to the trusted initial state; authenticate
  // all subsequently generated ledger events, including dynamic identities.
  const events=[];
  while(expected.tick<result.terminal.tick&&expected.status==='running'){
    while(result.bankSamples?.[bankCursor]?.tick===expected.tick){
      const sample=result.bankSamples[bankCursor++],sampled=sampleD11CombatGold(expected,sample.team,sample.liveGold);
      if(sampled===expected)throw new BattleValidationError('invalid-result');
      expected=sampled;
    }
    expected=installBattleEquipmentBatch(expected, result.terminal.equipmentReceipts?.filter(r => r.input.effectiveTick === expected.tick + 1) ?? []);
    const next=stepCombat(expected);expected=next.state;events.push(...toLedgerEvents(next.events));
  }
  if(canonicalContent(expected)!==canonicalContent(result.terminal)
    ||canonicalContent(events)!==canonicalContent(result.events.slice(result.initial.nextEventSeq??0)))throw new BattleValidationError('invalid-result');
}

export interface BattleReplayOptions {
  readonly captureReplay?: boolean;
  /** Authenticated inputs for this boundary, in seq order; queueEquipment stages their sources. */
  readonly beforeTick?: BattleTickInputSource;
}
export interface BattleReplayStep {
  readonly frame: CombatReplayTick | null;
  readonly result: BattleResult | null;
}
export interface BattleReplayTask extends BattleTask {
  readonly initial: CombatViewState;
  readonly initialFrame: CombatReplayTick;
  /** Exactly one new tick; null frame after completion (including tick-zero finish). */
  advanceTick(): BattleReplayStep;
  replay(): CombatReplay | null;
}

export interface BattleTask {
  /** Stage a successful Match equip; atomic with the server's asset transaction. */
  queueEquipment(input: BattleEquipmentInput, equipped: MatchState): void;
  /** Server-owned economy only. Samples apply before the next tick, never to a completed result. */
  sampleBankGold(seatId:string,liveGold:number):boolean;
  advance(maxTicks: number): BattleResult | null;
}

// Only exact, immutable results whose entire JSON graph was checked below can
// reuse that work. Clones, spreads and external results keep full validation.
const checkedResults = new WeakMap<BattleResult, ReturnType<typeof createScopedContentFreezer>>();

/** In-memory continuation. A slice budget never changes the Combat's own tick limit. */
export function startTwoSidedBattle(input: BattleInput, options: BattleReplayOptions & { readonly captureReplay: true }): BattleReplayTask;
export function startTwoSidedBattle(input: BattleInput): BattleTask;
export function startTwoSidedBattle(input: BattleInput, options: BattleReplayOptions): BattleTask | BattleReplayTask;
export function startTwoSidedBattle(input: BattleInput, options?: BattleReplayOptions): BattleTask | BattleReplayTask {
  return drainSetup(startTwoSidedBattleSteps(input, options ?? {}));
}
export function startTwoSidedBattleSteps(input: BattleInput, options: BattleReplayOptions & { readonly captureReplay: true }): Generator<void, BattleReplayTask, void>;
export function startTwoSidedBattleSteps(input: BattleInput): Generator<void, BattleTask, void>;
export function startTwoSidedBattleSteps(input: BattleInput, options: BattleReplayOptions): Generator<void, BattleTask | BattleReplayTask, void>;
export function* startTwoSidedBattleSteps(input: BattleInput, options?: BattleReplayOptions): Generator<void, BattleTask | BattleReplayTask, void> {
  const checked = yield* restoreBattleInputSteps(input);
  yield;
  const start = yield* createCombatWithEventsSteps(checked.preparation,checked.strategy,checked.battleId,checked.battleSeed);
  yield;
  const freezeBattle = createScopedContentFreezer();
  freezeBattle(start.state);
  yield* canonicalContentSteps(start.state);
  yield;
  const events: BattleResult['events'][number][] = [];
  const appendEvents = (step: CombatStep) => {
    for (const event of toLedgerEvents(step.events)) {
      freezeBattle(event);
      canonicalContent(event);
      events.push(event);
    }
  };
  appendEvents(start);
  yield;
  const recorder = options?.captureReplay ? createCombatReplayRecorder(start.state, events) : undefined;
  yield;
  let replay: CombatReplay | null = null;
  let terminal = start.state;
  const bankSamples:CombatBankSample[]=[];
  const readers = readBattleLiveGoldReaders(checked);
  let latestFrame: CombatReplayTick | null = null;
  let result: BattleResult | null = null;
  const pending: BattleEquipmentReceipt[] = [];
  const equipmentInputs = new Map<string, CombatStrategyInputs>();
  const install = () => {
    const requested = options?.beforeTick?.(terminal.tick + 1);
    const due = pending.filter(r => r.input.effectiveTick === terminal.tick + 1);
    if (requested !== undefined && (!Array.isArray(requested) || canonicalContent(requested) !== canonicalContent(due.map(r => r.input)))) throw new BattleValidationError('battle-input-invalid');
    const next = installBattleEquipmentBatch(terminal, due);
    terminal = next;
    pending.splice(0, due.length);
  };
  const task: BattleTask = { queueEquipment(input, equipped) {
    if (result || terminal.status !== 'running' || input.effectiveTick !== terminal.tick + 1
      || input.seatId !== checked.a.seatId && (input.seatId !== checked.b.seatId || checked.mirrorOfSeatId !== null)
      || input.seq <= (pending.at(-1)?.input.seq ?? terminal.equipmentReceipts?.at(-1)?.input.seq ?? 0)) throw new BattleValidationError('battle-input-invalid');
    const team = input.seatId === checked.a.seatId ? 'player' : 'enemy';
    const receipt = prepareBattleEquipment(equipmentInputs.get(input.seatId) ?? compileSide(team === 'player' ? checked.a : checked.b, team).inputs, input, equipped, team, checked.battleSeed, true);
    // Validate the complete same-tick prefix before accepting assets. This scratch
    // install has no events, random draws or writes to the running task.
    installBattleEquipmentBatch(terminal, [...pending, receipt]);
    pending.push(receipt); equipmentInputs.set(input.seatId, receipt.after);
  }, sampleBankGold(seatId,liveGold){
    if(result||terminal.status!=='running')throw new BattleValidationError('wrong-phase');
    if(!Number.isSafeInteger(liveGold)||liveGold<0||bankSamples.length>=100000||seatId!==checked.a.seatId&&seatId!==checked.b.seatId)throw new BattleValidationError('invalid-bank-sample');
    if(!readers.find(reader=>reader.seatId===seatId)!.readsLiveGold)return false;
    const team=seatId===checked.a.seatId?'player':'enemy';
    const sampled=sampleD11CombatGold(terminal,team,liveGold);
    if(sampled===terminal)return false;
    bankSamples.push({tick:terminal.tick,team,liveGold});terminal=sampled;
    return true;
  },advance(maxTicks) {
    if (!Number.isSafeInteger(maxTicks) || maxTicks < 1) throw new BattleValidationError('invalid-budget');
    if (result) return result;
    let steps = 0;
    if (recorder) {
      while (terminal.status === 'running' && steps < maxTicks) {
        install();
        const next = stepCombat(terminal);
        latestFrame = recorder.record(terminal, next);
        terminal = next.state; appendEvents(next); steps++;
      }
    } else {
      // The default hot loop skips replay work; the input seam still runs before each tick.
      while (terminal.status === 'running' && steps < maxTicks) {
        install();
        const next = stepCombat(terminal); terminal = next.state; appendEvents(next); steps++;
      }
    }
    if (terminal.status !== 'finished') return null;
    freezeBattle(events);
    const candidate: BattleResult = freezeBattle({version:TWO_SIDED_BATTLE_VERSION,battleId:checked.battleId,roundId:checked.a.roundId,battleSeed:checked.battleSeed,mirrorOfSeatId:checked.mirrorOfSeatId,
      winnerSeatId:terminal.result === 'draw' ? null : terminal.result === 'playerWin' ? checked.a.seatId : checked.b.seatId,
      a:sideResult(checked.a.seatId,checked.mapping,terminal,start.state), b:sideResult(checked.b.seatId,checked.mapping,terminal,start.state,checked.mirrorOfSeatId !== null),
      mapping:checked.mapping,initial:start.state,terminal,events,...(terminal.equipmentReceipts?.length ? {inputLog:terminal.equipmentReceipts.map(r=>r.input)} : {}),...(bankSamples.length?{bankSamples}:{} )});
    // Initial and each ledger element were fully checked and frozen before
    // scheduling pauses. Check every remaining field now, without regenerating
    // a whole-battle string. Array ordering and all settlement checks stay below.
    canonicalContent({...candidate,initial:null,events:[]});
    const candidateReplay = recorder ? recorder.finish(terminal) : null;
    // Publish only after validation and replay finalization both succeed.
    result = candidate;
    replay = candidateReplay;
    checkedResults.set(result, freezeBattle);
    return result;
  } };
  return recorder ? Object.assign(task, {
    initial: recorder.initial, initialFrame: recorder.initialFrame,
    advanceTick() {
      latestFrame = null;
      const completed = task.advance(1);
      return { frame: latestFrame, result: completed };
    },
    replay: () => replay,
  }) : task;
}

/** Compatibility: exhausting the total budget remains a fault, never a draw. */
export function resolveTwoSidedBattle(input: BattleInput, maxSteps: number): BattleResult {
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1) throw new BattleValidationError('invalid-budget');
  const result = startTwoSidedBattle(input).advance(maxSteps);
  if (!result) throw new BattleValidationError('step-limit-exceeded');
  return result;
}

/** Trusted rules output only. No Match mutation, HP clamp, income, receipt or elimination. */
export function proposeSettlement(result: BattleResult): { readonly a: SideProposal; readonly b: SideProposal } {
  try {
    const freezeResult = checkedResults.get(result);
    if (!freezeResult) canonicalContent(result);
    if (!freezeResult) validateDynamicResult(result);
    const stage = getMultiplayerRoundById(result.roundId);
    const expectedWinner = result.terminal.result === 'draw' ? null : result.terminal.result === 'playerWin' ? result.a.seatId : result.b.seatId;
    if (result.version !== TWO_SIDED_BATTLE_VERSION || stage.kind !== 'pvp' || result.a.seatId === result.b.seatId
      || (result.mirrorOfSeatId !== null && result.mirrorOfSeatId !== result.b.seatId)
      || result.terminal.status !== 'finished' || !result.terminal.result || result.terminal.combatId !== result.battleId
      || result.winnerSeatId !== expectedWinner || result.events.length !== result.terminal.nextEventSeq
      || result.events.some((event,index)=>event.combatId !== result.battleId || event.eventSeq !== index)
      || canonicalContent(result.a) !== canonicalContent(sideResult(result.a.seatId,result.mapping,result.terminal,result.initial))
      || canonicalContent(result.b) !== canonicalContent(sideResult(result.b.seatId,result.mapping,result.terminal,result.initial,result.mirrorOfSeatId !== null))) throw new BattleValidationError('invalid-result');
    const baseDamage = selectPlayerBaseDamage(stage.stage, stage.kind, result.roundId);
    if (baseDamage === undefined) throw new BattleValidationError('invalid-result');
    const side = (own: BattleSideResult, opponent: BattleSideResult): SideProposal => ({
      battleId:result.battleId,roundId:result.roundId,seatId:own.seatId,
      settlementEligible:own.seatId !== result.mirrorOfSeatId,
      result:result.winnerSeatId === null ? 'draw' : result.winnerSeatId === own.seatId ? 'win' : 'loss',
      baseDamage,opposingSurvivors:opponent.survivors.length,
      // Same frozen PvP rule as economy.ts: winner 0; otherwise stage base + opposing survivors.
      damage:own.seatId === result.mirrorOfSeatId || result.winnerSeatId === own.seatId ? 0 : baseDamage + opponent.survivors.length,
      growth:own.growth,events:result.events,...(own.seatId===result.mirrorOfSeatId?{}:{g23Facts:g23BattleFacts(result.terminal,own.seatId===result.a.seatId?'player':'enemy',stage.ordinal,'pvp',result.initial.units)}),
    });
    return (freezeResult ?? freezeContent)({a:side(result.a,result.b),b:side(result.b,result.a)});
  } catch (error) {
    if (error instanceof BattleValidationError) throw error;
    throw new BattleValidationError('invalid-result');
  }
}
