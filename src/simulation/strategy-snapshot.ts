import {g23JunkerEffects} from './g2-3-junker';
import { g23ExperimentEffects } from './g2-3-experiment';
import { projectG23Summons,g23SionTeam } from './g2-3-summons';
import { G23_SUMMON_POLICY } from './content/g2-3-summons';
import { getCatalogRoundByOrdinal } from './round-selectors';
import { g23ConversionProgramValues } from './g2-3-combat';
import { modifier,stat,trigger } from './content/item-programs';
import { g23FormStats } from './g2-3-forms';
import { g23AnomalyProgram, g23TraitProgram,g23ExperimentProgram } from './g2-3-programs';
import { compileAugmentEffect } from './augment-effects';
import { g22Equipment, scrapConversions, g22TraitEffects } from './strategy-g2-2';
import { validateItemProgram, type BoundItemProgram } from './m8/item-program';
import {readCombatStrategyInputs,type CombatStrategyInputs } from './combat-input';
import type {
  Effect, ChoiceDefinition, ItemDefinition, SourcedEffect, StrategySnapshot, TraitDefinition,
} from './strategy-types';
import { UNIT_DEFINITIONS } from './units';
import { getUnitStats } from './unit-stats';
import { readRoundEnemyProjection } from './round-enemies';
import { hexDistance } from './board';
import { resolveAbility } from './combat-abilities';
import { deriveTraits } from './trait-snapshot';
import { makeSourcedEffects, resolveEffects } from './effects';
import { TRAIT_DEFINITIONS } from './content/traits';
import { ITEM_DEFINITIONS } from './content/g2-3-item-registry';
import { AUGMENT_DEFINITIONS } from './content/augments';
import { compileSupportGrants, type G24HeldItem } from './g2-4-support';
import { ANOMALY_DEFINITIONS } from './content/anomalies';

export interface StrategyCatalog {
  readonly traits: Readonly<Record<string, TraitDefinition>>;
  readonly items: Readonly<Record<string, ItemDefinition>>;
  readonly augments: Readonly<Record<string, ChoiceDefinition>>;
  readonly anomalies: Readonly<Record<string, ChoiceDefinition>>;
}
const DEFAULT_CATALOG: StrategyCatalog = {
  traits: TRAIT_DEFINITIONS, items: ITEM_DEFINITIONS, augments: AUGMENT_DEFINITIONS, anomalies: ANOMALY_DEFINITIONS,
};
function lookup<T>(catalog: Readonly<Record<string, T>>, id: string): T {
  if (!Object.hasOwn(catalog, id)) throw new RangeError(`Unknown strategy definition: ${id}`);
  return catalog[id];
}

/** The only strategy compilation boundary. Combat receives JSON numbers and provenance,
 * with no links to Match or content records and no board/bench decisions left for the tick.
 */
export function buildStrategySnapshot(state: CombatStrategyInputs, catalog: StrategyCatalog = DEFAULT_CATALOG): StrategySnapshot {
  state=readCombatStrategyInputs(state);
  state={...state,preparation:projectG23Summons(state.preparation)};
  const traits = [...deriveTraits(state.preparation, 'player', catalog.traits), ...deriveTraits(state.preparation, 'enemy', catalog.traits)];
  const boardUnits = state.preparation.units.filter(unit => unit.location.kind === 'board')
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const equipment = g22Equipment(state), conversions = scrapConversions(boardUnits, traits, equipment, catalog.items);
  // G2-4b: support items act on their holder's board neighbours, so every holder's items are known before any unit compiles.
  const held = new Map<string, G24HeldItem[]>(), hold = (unitId: string, definitionId: string, instanceId: string) =>
    held.set(unitId, [...held.get(unitId) ?? [], { definition: lookup(catalog.items, conversions.get(instanceId) ?? definitionId), instanceId }]);
  for (const item of state.items) if (item.location.kind === 'unit') hold(item.location.unitId, item.definitionId, item.id);
  for (const child of state.temporaryEquipment) hold(child.holderId, child.definitionId, child.temporaryId);
  for (const item of readRoundEnemyProjection(state.round).items) hold(item.unitId, item.definitionId, `enemy:${state.round}:${item.unitId}:${item.slot}`);
  const supportGrants = compileSupportGrants(boardUnits.flatMap(u => u.location.kind === 'board' ? [{ id: u.id, team: u.team, cell: u.location.cell }] : []),
    held, getCatalogRoundByOrdinal(state.round).stage);
  const units = boardUnits.map(unit => {
    const sources: SourcedEffect[] = [];
    const itemPrograms: BoundItemProgram[] = [];
    const bindItem = (definition: ItemDefinition, instanceId: string, parentItemInstanceId: string | null = null) => {
      if (!definition.combatProgram) return;
      validateItemProgram(definition.combatProgram);
      itemPrograms.push({ source: {ownerId:unit.id,sourceKind:'item',definitionId:definition.id,instanceId,effectIndex:(definition.effects.length+1)*1024,parentItemInstanceId},program:structuredClone(definition.combatProgram)});
    };
    for (const trait of traits) {
      if (trait.team !== unit.team || trait.tier === 0 || !trait.targetUnitIds.includes(unit.id)) continue;
      const definition = lookup(catalog.traits, trait.traitId);
      const tier = definition.tiers.find(candidate => candidate.threshold === trait.tier);
      if (!tier) throw new RangeError(`Unknown trait tier: ${trait.traitId}/${trait.tier}`);
      sources.push(...makeSourcedEffects(unit.id, 'trait', trait.traitId, `${trait.team}:${trait.tier}`, g22TraitEffects(state, unit, trait, tier, boardUnits, equipment, conversions, catalog.items)));
    }
    if (unit.team === 'player') {
      for (const item of state.items) {
        if (item.location.kind !== 'unit' || item.location.unitId !== unit.id) continue;
        const definition = lookup(catalog.items, conversions.get(item.id) ?? item.definitionId);
        sources.push(...makeSourcedEffects(unit.id, 'item', definition.id, item.id, definition.effects));
        bindItem(definition, item.id);
      }
      for (const child of state.temporaryEquipment.filter(item => item.holderId === unit.id)) {
        const definition = lookup(catalog.items, conversions.get(child.temporaryId) ?? child.definitionId);
        sources.push(...makeSourcedEffects(unit.id, 'item', definition.id, child.temporaryId, definition.effects, child.parentItemInstanceId));
        bindItem(definition, child.temporaryId, child.parentItemInstanceId);
      }
      for (const augment of state.augments) {
        const definition = lookup(catalog.augments, augment.definitionId);
        sources.push(...makeSourcedEffects(unit.id, 'augment', augment.definitionId, augment.choiceId, definition.effects.flatMap<Effect>(effect => compileAugmentEffect(effect,state,unit,augment,boardUnits,traits)).flatMap<Effect>(effect => {
          if (effect.kind !== 'mechanic') return [effect];
          if (effect.mechanic === 'investment') return [{ kind: 'statFlat' as const, stat: 'maxHp' as const, amount: state.augmentProgress.investmentHp }];
          if (effect.values.backRowOnly && unit.location.kind === 'board' && unit.location.cell.row !== state.preparation.board.deploymentZones.player.lastRow) return [];
          if (effect.mechanic === 'bulkyBuddies') {
            const adjacent = boardUnits.filter(other => other.team === unit.team && other.id !== unit.id && other.location.kind === 'board' && unit.location.kind === 'board' && hexDistance(other.location.cell, unit.location.cell) === 1);
            return adjacent.length === 1 ? [{ kind: 'statFlat' as const, stat: 'maxHp' as const, amount: effect.values.health }, effect] : [];
          }
          return [effect];
        })));
      }
      const binding = state.anomalyBinding;
      if (binding?.unitId === unit.id) {
        const definition = lookup(catalog.anomalies, binding.definitionId);
        sources.push(...makeSourcedEffects(unit.id, 'anomaly', binding.definitionId, binding.choiceId, definition.effects));
      }
    } else {
      for (const item of readRoundEnemyProjection(state.round).items.filter(item => item.unitId === unit.id)) {
        const definition = lookup(catalog.items, conversions.get(`enemy:${state.round}:${unit.id}:${item.slot}`) ?? item.definitionId);
        sources.push(...makeSourcedEffects(unit.id, 'item', definition.id, `enemy:${state.round}:${unit.id}:${item.slot}`, definition.effects));
        bindItem(definition, `enemy:${state.round}:${unit.id}:${item.slot}`);
      }
    }
    for (const grant of supportGrants.get(unit.id) ?? []) {
      sources.push(...makeSourcedEffects(unit.id, 'item', grant.definitionId, grant.instanceId, grant.effects));
      if (grant.program) { validateItemProgram(grant.program); itemPrograms.push({ source: { ownerId: unit.id, sourceKind: 'item', definitionId: grant.definitionId, instanceId: grant.instanceId, effectIndex: (grant.effects.length + 1) * 1024, parentItemInstanceId: null }, program: structuredClone(grant.program) }); }
    }
    if(unit.definitionId==='rumble'&&unit.team==='player')sources.push(...makeSourcedEffects(unit.id,'trait','junker-king',unit.id+':junker',(unit.definitionId==='rumble'?g23JunkerEffects(state,unit.id):[])));
    sources.push(...makeSourcedEffects(unit.id,'trait','experiment',unit.id+':laboratory',g23ExperimentEffects(state,unit)));
    if(unit.definitionId==='g23-sion'){
      const rose=g23SionTeam(state.preparation,unit.team),stage=getCatalogRoundByOrdinal(state.round).stage,index=Math.max(0,Math.min(4,stage-2));
      const stages=rose.tier>=5?G23_SUMMON_POLICY.sion.tier5StageBps:rose.tier===4?G23_SUMMON_POLICY.sion.tier4StageBps:G23_SUMMON_POLICY.sion.tier3StageBps;
      const bps=Math.floor(stages[index]*(10000+rose.stars*1500)/10000)-10000;
      sources.push(...makeSourcedEffects(unit.id,'trait','black-rose',unit.id,[{kind:'statFlat',stat:'maxHp',amount:Math.max(0,Math.floor(1000*bps/10000))},{kind:'mechanic',mechanic:'g23Sion',values:{tier:rose.tier}}]));
    }
    const growth = state.persistentGrowth.find(entry => entry.unitId === unit.id);
    if (growth) sources.push(...makeSourcedEffects(unit.id, 'ability', 'tristana-ability', `persistent:${unit.id}`, [{ kind: 'statPercentBps', stat: 'attackDamage', bps: growth.attackDamageBps }]));
    const anomaly=state.anomalyBinding?.unitId===unit.id?state.anomalyBinding.definitionId:null;
    const bonus=anomaly==='freestyling'?Math.round(traits.filter(t=>t.team===unit.team&&t.tier>0&&lookup(catalog.traits,t.traitId).tiers[0].threshold>1).length*450)
      :anomaly==='force-of-friendship'?boardUnits.filter(x=>x.team===unit.team).reduce((n,x)=>n+(x.starLevel===3?800:x.starLevel*100),0)
      :anomaly==='comeback-story'?Math.floor((100-(state.playerHp??100))/10)*500:0;
    if(bonus&&state.anomalyBinding)sources.push(...makeSourcedEffects(unit.id,'anomaly',anomaly!,state.anomalyBinding.choiceId+':scaling',[{kind:'mechanic',mechanic:'damageAmp',values:{bps:bonus}}]));
    const base = unit.location.kind==='board'?g23FormStats(unit.definitionId, unit.starLevel,unit.team,unit.location.cell.row):getUnitStats(unit.definitionId,unit.starLevel);
    let resolved = resolveEffects(base, resolveAbility(base.abilityId, unit.starLevel), sources);
    const family = (resolved.mechanics ?? []).find(m => m.mechanic === 'family');
    if (family) {
      const maxMana = Math.floor(resolved.stats.maxMana * (10000 - family.values.manaReductionBps) / 10000);
      resolved = { ...resolved, stats: { ...resolved.stats, maxMana, initialMana: Math.min(resolved.stats.initialMana, maxMana) } };
    }
    for(const m of resolved.mechanics ?? []) {
      const program=m.mechanic==='g23Junker'?{modifiers:m.values.titan?[modifier('damageReduction',9000,'bps')]:[]}:m.mechanic==='g23Experiment'?g23ExperimentProgram(m.values):m.mechanic==='g23Trait'?g23TraitProgram(m.source.definitionId,m.values.tier,resolved.stats.maxMana):m.mechanic==='g23Anomaly'?g23AnomalyProgram(m.source.definitionId,resolved.stats.maxMana):null;
      if(m.mechanic==='g23Anomaly'){
        const conversion=g23ConversionProgramValues(m.source.definitionId,resolved.stats.armor,resolved.stats.magicResist);
        if(conversion)itemPrograms.push({source:{...m.source,parentItemInstanceId:null},program:{modifiers:[modifier(conversion.stat,conversion.amount)]}});
        if(['power-absorption','energy-absorption'].includes(m.source.definitionId))for(const ally of boardUnits.filter(x=>x.id!==unit.id&&x.team===unit.team))
          itemPrograms.push({source:{...m.source,instanceId:JSON.stringify([m.source.instanceId,'absorb',ally.id]),parentItemInstanceId:null},program:{triggers:[trigger({id:'absorb',event:'counter-updated',effects:[stat({...modifier(m.source.definitionId==='power-absorption'?'attackDamage':'abilityPower',0),value:{kind:'counter',counterId:'g23Absorb',perCount:1}})]})]}});
      }
      if(program&&Object.keys(program).length){validateItemProgram(program);itemPrograms.push({source:{...m.source,parentItemInstanceId:null},program});}
    }
    const mechanics = (resolved.mechanics ?? []).map(mechanic => {
      if (mechanic.mechanic !== 'bulkyBuddies') return mechanic;
      const buddy = boardUnits.find(other => other.team === unit.team && other.id !== unit.id && other.location.kind === 'board' && unit.location.kind === 'board' && hexDistance(other.location.cell, unit.location.cell) === 1);
      return { ...mechanic, targetId: buddy!.id };
    });
    if (unit.definitionId === 'vander') mechanics.push({ source: {ownerId:unit.id,sourceKind:'ability',definitionId:'vander-ability',instanceId:unit.id,effectIndex:0},mechanic:'lowCostAllies',values:{count:boardUnits.filter(other=>other.team===unit.team && UNIT_DEFINITIONS[other.definitionId].cost<=2).length}});
    return { unitId: unit.id, ...resolved, mechanics, ...(itemPrograms.length ? {itemPrograms} : {}) };
  });
  return { traits, units };
}
