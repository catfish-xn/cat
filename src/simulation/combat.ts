import {projectItemSummons} from './g2-4b-summons';
import {getUnitForm} from './seat-mechanics/forms';
import {createItemRandomStreams} from './g2-4b-item-kernel';
import {initializeShroud,initializeZephyr} from './combat-g2-4b';
import {spawnCombatUnit} from './seat-mechanics/combat-events';
import {stampCombatStep} from './combat-effects';
import { projectG23Summons,isG23Summon } from './g2-3-summons';
import { g23FormStats } from './g2-3-forms';
import { shareGeneratedDeclaration } from './immutable-json';
import { freezeCombatDeclarations } from './combat-static';
import { recordNeutralReceipts } from './neutral-receipts';
import { COMPILED_NEUTRAL_ENCOUNTERS, readNeutralCombatUnit } from './neutral-encounter-compiler';
import { compileCombatInitialInputs } from './combat-initialization';
import type { StrategySnapshot } from './strategy-types';
import { initializeEffectRuntime } from './effects';
import { applyCombatStart } from './combat-effects';
import type { GameState } from './game';
import { getUnitStats } from './unit-stats';
import { resolveAbility } from './combat-abilities';
import { compareIds, eliminationResult, MAX_COMBAT_TICKS, type CombatEvent,type CombatState, type CombatStep, type CombatUnit } from './combat-types';
import { advanceCombatTick } from './combat-tick';
export * from './combat-types';

export type CombatStartFailure = 'missing-player' | 'missing-enemy' | 'missing-both';
/** Preparation gate only; terminal-state semantics of createCombat stay unchanged. */
export function validateCombatStart(preparation: GameState): CombatStartFailure | undefined {
  const deployed = preparation.units.filter(unit => unit.location.kind === 'board');
  const player = deployed.some(unit => unit.team === 'player');
  const enemy = deployed.some(unit => unit.team === 'enemy');
  if (!player && !enemy) return 'missing-both';
  if (!player) return 'missing-player';
  if (!enemy) return 'missing-enemy';
  return undefined;
}

/** Creates an isolated board-only battle. Preparation is never a combat write target. */
function snapshotCombat(preparationState: GameState, strategy?: StrategySnapshot, combatId = 'standalone', rngState = 42): CombatStep {
  preparationState=projectItemSummons(projectG23Summons(preparationState),strategy);
  let units: CombatUnit[] = preparationState.units.flatMap(unit => {
    if (unit.location.kind !== 'board') return [];
    const resolved = strategy?.units.find(entry => entry.unitId === unit.id);
    if (strategy && !resolved) throw new Error(`Missing strategy unit: ${unit.id}`);
    const formCell=resolved?.itemSummon?.formCell??unit.location.cell;
    const formUnit={...unit,location:{kind:'board' as const,cell:formCell}};
    const stats = resolved?.stats ?? getUnitStats(unit.definitionId, unit.starLevel);
    const ability = resolved ? structuredClone(resolved.ability) : resolveAbility(stats.abilityId, unit.starLevel);
    const neutral = stats.unitKind === 'neutral' ? readNeutralCombatUnit(unit.id) : undefined;
    if (stats.unitKind === 'neutral' && (!neutral || neutral.definitionId !== unit.definitionId || neutral.encounterId !== unit.encounterId || unit.team !== 'enemy')) throw new RangeError('Invalid neutral combat identity');
    return [{ ...(neutral?.companionDefinitions ? {companionDefinitions:structuredClone(neutral.companionDefinitions)} : {}),
      ...(neutral?.attackCone ? {attackCone:structuredClone(neutral.attackCone)} : {}), ...compileCombatInitialInputs(unit.id, stats, ability, resolved), ...(unit.encounterId ? { encounterId: unit.encounterId } : {}), id: unit.id, definitionId: unit.definitionId, team: unit.team, starLevel: unit.starLevel,
      ...(getUnitForm(formUnit,preparationState.board)?{form:getUnitForm(formUnit,preparationState.board)!}:{}),
      ...(resolved?.itemSummon?{itemSummon:structuredClone(resolved.itemSummon),startingCell:{...unit.location.cell}}:{}),cell: { ...unit.location.cell },
      ...(resolved?.mechanics?.some(m=>m.mechanic==='g24SpectralCutlass')?{startingCell:{...unit.location.cell}}:{}),
      ...(resolved?.openingItemBankGold===undefined?{}:{openingItemBankGold:resolved.openingItemBankGold,currentItemBankGold:resolved.openingItemBankGold}),
      ...(resolved?.mechanics?.some(m=>m.mechanic==='g24Mogul')?{itemMogulHits:[]}:{}),
      ...(resolved?.mechanics?.some(m=>m.mechanic==='g24DeathsDefiance')?{deferredItemDamage:[]}:{}),
      attackDamage: stats.attack, attackRange: stats.attackRange,
      attackIntervalTicks: stats.attackIntervalTicks, cooldownTicks: 0, moveCooldownTicks: 0,
      armor: stats.armor, magicResist: stats.magicResist,
      shield: 0, shieldExpiresAtTick: null, ability,
      ...(resolved ? { sources: structuredClone(resolved.sources), triggers: structuredClone(resolved.triggers), effectRuntime: initializeEffectRuntime(resolved.triggers) } : {}),
      ...(ability.kind === 's13' ? { attackDamageBase: resolved?.attackDamageBase ?? stats.attack, attackDamagePercentBps: resolved?.attackDamagePercentBps ?? 0,
        baseAttackSpeedBps: stats.baseAttackSpeedBps ?? Math.floor(200000 / stats.attackIntervalTicks),
        attackSpeedBonusBps: stats.attackSpeedBonusBps ?? 0,
        maxHpBasis: { base: g23FormStats(unit.definitionId, unit.starLevel,unit.team,formCell.row).health,
          flat: (resolved?.sources ?? []).reduce((n, e) => n + (e.effect.kind === 'statFlat' && e.effect.stat === 'maxHp' ? e.effect.amount : 0), 0),
          bps: (resolved?.sources ?? []).reduce((n, e) => n + (e.effect.kind === 'statPercentBps' && e.effect.stat === 'maxHp' ? e.effect.bps : 0), 0), bonusBps: 0 },
        mechanics: structuredClone(resolved?.mechanics ?? []), shieldLayers: [], statuses: [], tasks: [],
        runtime: { attackCount: 0, castCount: 0, attackSpeedBps: 0, abilityPowerFlat: 0, rangeBonus: 0,
          nextAttackMagic: 0, nextAttackPhysical: 0, permanentAdBps: 0, buddyTriggered: false } } : {}),
      alive: true, targetId: null }];
  }).sort(compareIds);
  if(units.some(u=>u.mechanics?.some(m=>m.mechanic==='g24Shroud')))units=initializeShroud(units);
  if(units.some(u=>u.mechanics?.some(m=>m.mechanic==='g24Zephyr')))units=initializeZephyr(units,preparationState.board);
  units.forEach(unit => freezeCombatDeclarations(unit, false, true));
  const result = eliminationResult(units);
  let state:CombatState={
    board: { ...preparationState.board, deploymentZones: {
      player: { ...preparationState.board.deploymentZones.player },
      enemy: { ...preparationState.board.deploymentZones.enemy },
    } },
    ...(strategy ? { strategy: shareGeneratedDeclaration(structuredClone(strategy)), combatId, nextEventSeq: 0, startEffectsApplied: false } : {}),
    ...(units.some(u=>u.unitKind==='neutral') ? {...(strategy ? {neutralReceipts:{deaths:[],controls:[]}} : {}),openingDefinitions:structuredClone(COMPILED_NEUTRAL_ENCOUNTERS.flatMap(e=>e.openingDefinitions).filter(d=>units.some(u=>u.id===d.source.ownerId)))} : {}),
    ...(units.some(u=>u.mechanics?.some(m=>['g24Fishbones','g24Collector','g24Gambler','g24Mogul'].includes(m.mechanic)))?{itemRandomStreams:createItemRandomStreams(rngState)}:{}),
    ...(units.some(u=>u.mechanics?.some(m=>['g24Collector','g24Gambler','g24Mogul'].includes(m.mechanic)))?{itemGoldReceipts:[]}:{}),
    rngState, rngDraws: 0, nextActionSeq: 0, units, tick: 0, maxTicks: MAX_COMBAT_TICKS,
    status: result === null ? 'running' : 'finished', result,
  };
  const summons=state.units.filter(u=>isG23Summon(u)||u.itemSummon);
  state={...state,units:state.units.filter(u=>!isG23Summon(u)&&!u.itemSummon)};
  const events:CombatEvent[]=[];
  for(const unit of summons){
    const ownerId=unit.itemSummon?.ownerId??unit.id.replace(/:g23-(sion|forge)$/, '');
    const spawned=spawnCombatUnit(state,unit,unit.itemSummon?{ownerId,sourceKind:'item',definitionId:unit.itemSummon.kind==='mirror'?'TFT9_Item_OrnnTrickstersGlass':'TFT5_Item_ZzRotPortalRadiant',instanceId:unit.itemSummon.itemInstanceId,effectIndex:0}:{ownerId,sourceKind:'trait',definitionId:unit.definitionId==='g23-sion'?'black-rose':'junker-king',instanceId:unit.id,effectIndex:0},0);
    state=spawned.state;events.push(...spawned.events);
    if(unit.definitionId==='g23-sion')events.push({type:'bindingChanged',tick:0,unitId:unit.id,bound:true,reason:'combat-start'});
  }
  if(state.units.some(u=>u.itemSummon))state={...state,units:[...state.units].sort(compareIds)};
  return stampCombatStep(state,events);
}
export function createCombat(preparationState: GameState): CombatState { return snapshotCombat(preparationState).state; }
export function createCombatWithEvents(preparation: GameState, strategy: StrategySnapshot, combatId: string, rngState = 42): CombatStep {
  const spawned=snapshotCombat(preparation,strategy,combatId,rngState);
  const start=applyCombatStart(spawned.state);
  const started={state:start.state,events:[...spawned.events,...start.events]};
  for (const unit of started.state.units) if (unit.mechanismDefinitions)
    Object.assign(unit, { mechanismDefinitions: shareGeneratedDeclaration(structuredClone(unit.mechanismDefinitions)) });
  return started;
}
export function stepCombat(state: CombatState): CombatStep {
  if (state.status === 'finished') return { state, events: [] };
  return recordNeutralReceipts(advanceCombatTick(state));
}
