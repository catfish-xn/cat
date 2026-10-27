import { settleNoScoutGrowth } from './augment-pool-batch5-h3';
import { drainContestedGold } from './augment-pool-batch5-h6';
import { drainBatch5Inventory } from './augment-pool-batch5-s3a';
import { batch5S6cSettlementHealth, drainBatch5S6cGold } from './augment-pool-batch5-s6c';
import { MAX_SUPPORTED_PLAYER_HP } from './augment-pool-batch5-h7-health';
import { AUGMENT_BATCH4 } from './content/augment-pool-batch4';
import { drainBatch1Gifts } from './augment-pool-grants';
import { batch4B4xpSettlementXp, withBatch4B4xp } from './augment-pool-batch4-b4xp-progress';
import { openingEncounterId } from './opening-encounter';
import { MAX_COMBAT_TICKS } from './combat-types';
import { deferredRoundIncome } from './deferred-income';
import { commitOpeningEncounterHealth } from './opening-encounter';
import { melCanSave, commitMelSave } from './mel-save';
import { reconcileD14 } from './d14-runtime';
import { pruneForgePositions } from './forge-positions';
import type {TraitProjectionContext} from './traits/effective-membership';
import { forfeitUnclaimedOrbs, settleQueuedOrbClaims } from './orb-claim';
import type {UnitLootPolicy} from './loot-runtime';
import {mechanicGrantEvents,openG23Choice} from './g2-3-runtime';
import {commitG23Settlement} from './g2-3-settlement';
import {validateG23BattleFacts,type G23BattleFacts} from './g2-3-economy';
import {TACTICIANS_CROWN_ID} from './deployment-cap';
import {deriveTraits} from './trait-snapshot';
import { resolveDeferredUpgrades } from './deferred-upgrades';
import { canonicalContent } from './content';
import { resolveRoundEconomy } from './round-economy';
import { applyLevelUpHealth } from './augment-xp';
import { needsOpponentHp, drainSettlementGold } from './augment-settlement-gold';
import { MATCH_RULES } from './match-rules';
import { getMultiplayerRoundById } from './multiplayer-round';
import { FINAL_ROUND, getRoundSchedule } from './round-schedule';
import type { MatchState, MatchEvent, MatchFailure, PersistentGrowth, RoundResult } from './match-types';

export type MultiplayerFailure = MatchFailure | 'multiplayer-required' | 'invalid-seat' | 'invalid-receipt'
  | 'duplicate-settlement' | 'mirror-settlement' | 'already-settled' | 'seat-eliminated'
  | 'no-pending-choice' | 'invalid-loot' | 'shared-pool-required' | 'invalid-round' | 'already-claimed' | 'unknown-orb';
export type MultiplayerCommandResult = { readonly ok: true; readonly state: MatchState; readonly events: readonly MatchEvent[] }
  | { readonly ok: false; readonly state: MatchState; readonly reason: MultiplayerFailure };

export const ROUND_SETTLEMENT_VERSION = 'multiplayer-settlement-v1';
export interface MultiplayerProgress {
  readonly version: typeof ROUND_SETTLEMENT_VERSION;
  readonly seatId: string;
  readonly combatRosterLocked?: true;
  readonly status: 'active' | 'eliminated';
  readonly receipts: readonly RoundSettlementReceipt[];
  readonly forfeitedChoices: readonly string[];
}
/** Trusted server receipt; income is calculated from seat resources, never supplied by a client. */
export interface RoundSettlementReceipt {
  readonly g23Facts?:G23BattleFacts;
  /** Opponent's frozen battle-start health; present exactly when this seat owns Kingslayer for the round. */
  readonly opponentHp?:number;
  readonly version: typeof ROUND_SETTLEMENT_VERSION;
  readonly settlementId: string;
  readonly battleId: string;
  readonly seatId: string;
  readonly round: number;
  readonly roundId: string;
  readonly settlementEligible: boolean;
  readonly result: 'win' | 'loss' | 'draw';
  readonly damage: number;
  readonly baseDamage: number;
  readonly opposingSurvivors: number;
  readonly growth: readonly PersistentGrowth[];
  readonly combatTicks: number;
  readonly combatEventCount: number;
}
const fail = (state: MatchState, reason: MultiplayerFailure): MultiplayerCommandResult => ({ok:false,state,reason});
const integer = (n: unknown, min = 0): n is number => Number.isSafeInteger(n) && (n as number) >= min;
const id = (s: unknown): s is string => typeof s === 'string' && s.length > 0;

/** Opt in explicitly. Offline state shapes and command semantics stay unchanged. */
export function enableMultiplayerSettlement(state: MatchState, seatId: string): MultiplayerCommandResult {
  if (!id(seatId)) return fail(state,'invalid-seat');
  if (state.multiplayer) return state.multiplayer.seatId === seatId
    ? {ok:true,state,events:[]} : fail(state,'invalid-seat');
  if (state.phase === 'gameOver' || state.phase === 'combat' || state.playerHp <= 0) return fail(state,'wrong-phase');
  return {ok:true,state:{...state,multiplayer:{version:ROUND_SETTLEMENT_VERSION,seatId,status:'active',receipts:[],forfeitedChoices:[]}},events:[]};
}

/** One seat's atomic commit. The room stages all successful results before publishing any seat. */
export function applyRoundSettlement(state: MatchState, input: unknown,unitLootPolicy?:UnitLootPolicy,traitContext?:TraitProjectionContext): MultiplayerCommandResult {
  if (!state.multiplayer || state.multiplayer.version !== ROUND_SETTLEMENT_VERSION) return fail(state,'multiplayer-required');
  const multiplayer = state.multiplayer;
  try {
    canonicalContent(input);
    if (!input || typeof input !== 'object' || Array.isArray(input)) return fail(state,'invalid-receipt');
    const r = input as RoundSettlementReceipt;
    // Dedupe before phase/round checks: a retry remains inert after advancing or elimination.
    if (id(r.settlementId) && state.multiplayer.receipts.some(old => old.settlementId === r.settlementId)) return fail(state,'duplicate-settlement');
    if (!integer(r.round,1) || !id(r.roundId)) return fail(state,'invalid-receipt');
    if (r.round !== state.round || r.roundId !== state.roundDefinitionId) return fail(state,'stale-round');
    if (r.settlementEligible === false) return fail(state,'mirror-settlement');
    if (r.version !== ROUND_SETTLEMENT_VERSION || !id(r.settlementId) || !id(r.battleId)
      || r.seatId !== state.multiplayer.seatId || r.settlementEligible !== true
      || !['win','loss','draw'].includes(r.result) || !integer(r.damage) || !integer(r.baseDamage)
      || !integer(r.opposingSurvivors) || r.opposingSurvivors > MATCH_RULES.maxLevel || !integer(r.combatTicks) || r.combatTicks > MAX_COMBAT_TICKS
      || !integer(r.combatEventCount,1) || !Array.isArray(r.growth)) return fail(state,'invalid-receipt');
    if (state.multiplayer.status === 'eliminated') return fail(state,'seat-eliminated');
    if (state.roundResults.some(old => old.round === r.round)
      || state.multiplayer.receipts.some(old => old.battleId === r.battleId)) return fail(state,'already-settled');
    if (state.phase !== 'preparation' || state.pendingChoice !== null || state.combat !== null) return fail(state,'wrong-phase');
    if (!state.preparation.units.some(unit => unit.team === 'player')
      && state.round <= FINAL_ROUND && getRoundSchedule(state.round).some(event => event.kind === 'anomaly'
        && !state.scheduleReceipts.some(old => old.eventId === event.id)
        && !multiplayer.forfeitedChoices.includes(event.id))) return fail(state,'wrong-phase');
    const round = getMultiplayerRoundById(r.roundId);
    if (round.ordinal !== r.round || round.kind !== 'pvp') return fail(state,'invalid-receipt');
    if(traitContext&&traitContext.round!==state.round)return fail(state,'invalid-receipt');
    if(openingEncounterId(state)==='warwicks-hunger'&&!r.g23Facts?.openingDeaths)return fail(state,'invalid-receipt');
    if(r.g23Facts){
      if(r.g23Facts.openingDeaths?.some(d=>d.eventSeq>=r.combatEventCount))return fail(state,'invalid-receipt');
      validateG23BattleFacts(r.g23Facts);const facts=r.g23Facts,traits=deriveTraits(state.preparation,'player',undefined,traitContext,state.items);
      // A locked roster's trusted resolver receipt refers to the frozen battle, while
      // this latest live seat permits equipment edits. Recounting its emblems would
      // reject removals/reforges or grant a newly equipped emblem retroactively.
      // Unlocked callers and explicit projections retain the exact tier check.
      const frozenTiers=multiplayer.combatRosterLocked===true&&traitContext===undefined;
      if(facts.family&&(facts.family.stage!==round.stage||!frozenTiers&&facts.family.eligible!==((traits.find(t=>t.traitId==='family')?.tier??0)>=5)))return fail(state,'invalid-receipt');
      if(facts.battleId!==r.battleId||facts.round!==r.round||facts.roundKind!=='pvp'||facts.result!==r.result
       ||!frozenTiers&&(facts.conquerorTier!==(traits.find(t=>t.traitId==='conqueror')?.tier??0)||facts.chemBaronTier!==(traits.find(t=>t.traitId==='chem-baron')?.tier??0))
       // Equipment stays editable under a locked roster, so the frozen crown count is bounded by crowns owned (never destroyed).
       // This checks ownership only, not opening equipment eligibility; the trusted battle resolver supplies that evidence.
       ||(facts.crowns??0)>state.items.filter(i=>i.definitionId===TACTICIANS_CROWN_ID).length)return fail(state,'invalid-receipt');
      const hunter=state.anomalyBinding?.definitionId==='headhunter'?state.anomalyBinding:null;
      if(facts.d11Headhunter&&(!hunter||facts.round<hunter.boundRound
        ||facts.d11Headhunter.holderId!==JSON.stringify(['t2',multiplayer.seatId,'unit',hunter.unitId])
        ||facts.d11Headhunter.kills.some(k=>k.eventSeq>=r.combatEventCount)))return fail(state,'invalid-receipt');
      if(hunter&&state.preparation.units.some(u=>u.id===hunter.unitId&&u.location.kind==='board')&&!facts.d11Headhunter)return fail(state,'invalid-receipt');
    }
    else if(state.anomalyBinding?.definitionId==='headhunter'&&state.preparation.units.some(u=>u.id===state.anomalyBinding!.unitId&&u.location.kind==='board'))return fail(state,'invalid-receipt');
    // Require contiguous history, including already-settled PvE/supply nodes.
    if (state.roundResults.length !== state.round - 1
      || state.roundResults.some((record,index) => record.round !== index + 1)) return fail(state,'unsettled-round');
    const result = r.result === 'win' ? 'playerWin' : r.result === 'loss' ? 'enemyWin' : 'draw';
    const economyInput = {result,gold:state.gold,streak:state.streak,
      level:state.level,xp:state.xp,hp:state.playerHp,enemySurvivors:r.opposingSurvivors} as const;
    const plan = withBatch4B4xp(state,resolveRoundEconomy({augments:state.augments,roundId:r.roundId,...economyInput}),batch4B4xpSettlementXp(state));
    // Damage is forwarded verbatim, but reject mismatched/edited proposals at the rules boundary.
    if (r.baseDamage !== plan.baseDamage || r.damage !== plan.playerDamage) return fail(state,'invalid-receipt');
    const growth = new Map(state.persistentGrowth.map(g => [g.unitId,g.attackDamageBps]));
    const seen = new Set<string>();
    for (const delta of r.growth) {
      const unit = state.preparation.units.find(u => u.id === delta?.unitId);
      if (!unit || unit.team !== 'player' || unit.location.kind !== 'board' || unit.definitionId !== 'tristana'
        || seen.has(delta.unitId) || !integer(delta.attackDamageBps,125) || delta.attackDamageBps % 125 !== 0
        || Object.keys(delta).some(key => key !== 'unitId' && key !== 'attackDamageBps')) return fail(state,'invalid-receipt');
      seen.add(delta.unitId);
      const next = (growth.get(delta.unitId) ?? 0) + delta.attackDamageBps;
      if (!integer(next)) return fail(state,'invalid-receipt');
      growth.set(delta.unitId,next);
    }
    const fields = ['version','settlementId','battleId','seatId','round','roundId','settlementEligible','result','damage',
      'baseDamage','opposingSurvivors','growth','combatTicks','combatEventCount'];
    if(r.g23Facts)fields.push('g23Facts');
    if(r.opponentHp!==undefined)fields.push('opponentHp');
    if((r.opponentHp!==undefined)!==needsOpponentHp(state.augments,r.round)||r.opponentHp!==undefined&&(!integer(r.opponentHp)||r.opponentHp>MAX_SUPPORTED_PLAYER_HP)) return fail(state,'invalid-receipt');
    if (Object.keys(r).length !== fields.length || Object.keys(r).some(key => !fields.includes(key))) return fail(state,'invalid-receipt');
    const saved=melCanSave(state,r.g23Facts,Math.max(0,state.playerHp-r.damage)),hpAfter=saved?1:Math.max(0,state.playerHp-r.damage);
    const record: RoundResult = {
      round:r.round,roundId:r.roundId,settlementId:r.settlementId,roundKind:'pvp',result,
      combatTicks:r.combatTicks,combatEventCount:r.combatEventCount,income:plan.income,incomeBreakdown:plan.incomeBreakdown,
      interestBasis:plan.interestBasis,streakBefore:state.streak,streakAfter:plan.streakAfter,
      mechanicReceiptPrefixLength:state.seatMechanics?.receipts.length??0,goldBefore:state.gold,goldAfter:plan.goldAfter,xpRequested:plan.progression.xpRequested,xpAwarded:plan.progression.xpApplied,
      levelBefore:state.level,levelAfter:plan.progression.level,xpBefore:state.xp,xpAfter:plan.progression.xp,
      hpBefore:state.playerHp,hpAfter,baseDamage:r.baseDamage,survivingEnemyCount:r.opposingSurvivors,
      playerDamage:r.damage,hpLost:state.playerHp-hpAfter,
    };
    const augmentProgress = {
      pumpingRounds:state.augmentProgress.pumpingRounds+(state.augments.some(a=>a.definitionId==='pumping-up-i')?1:0),
      investmentHp:state.augmentProgress.investmentHp,
    };
    if (!Object.values(augmentProgress).every(n=>integer(n)) || !integer(state.nextMatchEventSeq+1)) return fail(state,'invalid-receipt');
    const {combatRosterLocked: _combatRosterLocked, ...unlockedMultiplayer} = state.multiplayer;
    const next: MatchState = {...state,phase:'settlement',combat:null,combatInputBasis:null,outcome:null,
      gold:plan.goldAfter-deferredRoundIncome(plan),playerHp:hpAfter,level:plan.progression.level,xp:plan.progression.xp,streak:plan.streakAfter,
      persistentGrowth:[...growth].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([unitId,attackDamageBps])=>({unitId,attackDamageBps})),
      augmentProgress:{...augmentProgress,...(state.augmentProgress.forming?{forming:state.augmentProgress.forming}:{}),...(state.augmentProgress.magicRoll?{magicRoll:state.augmentProgress.magicRoll}:{})},roundResults:[...state.roundResults,record],nextMatchEventSeq:state.nextMatchEventSeq+1,
      multiplayer:{...unlockedMultiplayer,status:hpAfter===0?'eliminated':'active',receipts:[...state.multiplayer.receipts,structuredClone(r)]}};
    const hookEvents:MatchEvent[]=[];
    // Kingslayer pays from the receipt itself, so a settlement without battle facts still gets its gold.
    let settled=drainSettlementGold(r.g23Facts?commitG23Settlement(next,r.g23Facts,unitLootPolicy,hookEvents):next);
    const contested=drainContestedGold(settled);hookEvents.push(...mechanicGrantEvents(settled,contested));settled=contested;
    if(!r.g23Facts&&state.augments.some(a=>AUGMENT_BATCH4[a.definitionId]||a.definitionId==='a-change-of-fate')){
      const gifted=drainBatch1Gifts(settled,unitLootPolicy);hookEvents.push(...mechanicGrantEvents(settled,gifted));settled=gifted;
    }
    if(saved)settled=commitMelSave(settled,r.battleId,hookEvents);
    settled=applyLevelUpHealth(state,commitOpeningEncounterHealth(settled,hookEvents));
    if (state.m8.round.kind === 'pvp') settled = settleNoScoutGrowth(settled,r.battleId);
    settled={...settled,playerHp:batch5S6cSettlementHealth(settled,r.round,settled.playerHp)};
    const beforeS6cGold=settled;settled=drainBatch5S6cGold(settled);
    hookEvents.push(...mechanicGrantEvents(beforeS6cGold,settled));
    const merged = resolveDeferredUpgrades(settled);
    const rewarded=merged.state.augments.some(a=>a.definitionId==='glorious-evolution') ? drainBatch1Gifts(merged.state,unitLootPolicy) : merged.state;
    const d14State=pruneForgePositions(reconcileD14(rewarded,hookEvents));
    const forfeited=hpAfter===0?forfeitUnclaimedOrbs(d14State):settleQueuedOrbClaims(d14State,unitLootPolicy);
    const inventory=drainBatch5Inventory(forfeited.state);hookEvents.push(...mechanicGrantEvents(forfeited.state,inventory));
    const opened=openG23Choice(inventory);
    const extra=[...hookEvents,...merged.events,...mechanicGrantEvents(state,rewarded),...forfeited.events,...opened.events];
    const events: MatchEvent[] = [{type:'roundSettled',round:r.round,domain:'match',eventSeq:state.nextMatchEventSeq},
      ...extra.map((event,index) => ('tick' in event?event:{...event,domain:'match' as const,eventSeq:next.nextMatchEventSeq+index}))];
    return {ok:true,state:{...opened.state,nextMatchEventSeq:next.nextMatchEventSeq+extra.length},events};
  } catch { return fail(state,'invalid-receipt'); }
}
