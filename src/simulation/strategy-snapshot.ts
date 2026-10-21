import { d14UnitBase } from './d14-anomalies/projection';
import { p3Program, p3ItemProgram } from './s13-p3-programs';
import { compileD11Augment, d11OpeningSeed, d11PriorKills } from './d11-fill';
import { D11_FILL_TIERS, type D11AugmentId } from './content/d11-fill';
import {projectVoidspawns,voidspawnStage} from './g2-4b-voidspawn';
import {appendMirrorSummons} from './g2-4b-summons';
import {g23JunkerEffects} from './g2-3-junker';
import { g23ExperimentEffects } from './g2-3-experiment';
import { g23SionTeam } from './g2-3-summons';
import { G23_SUMMON_POLICY } from './content/g2-3-summons';
import { ROUND_CATALOG } from './content/round-catalog';
import { g23ConversionProgramValues } from './g2-3-combat';
import { modifier,stat,trigger } from './content/item-programs';
import { g23FormStats } from './g2-3-forms';
import { g23AnomalyProgram, g23TraitProgram,g23ExperimentProgram } from './g2-3-programs';
import { compileAugmentEffect } from './augment-effects';
import { p2ItemDefinition, p2SupportDeclaration, p2AugmentProgram } from './s13-augments-p2-strategy';
import { g22Equipment, scrapConversions, g22TraitEffects } from './strategy-g2-2';
import { validateItemProgram, type BoundItemProgram, type ItemProgram } from './m8/item-program';
import {readCombatStrategyInputs,type CombatStrategyInputs } from './combat-input';
import type {
  Effect, ChoiceDefinition, ItemDefinition, SourcedEffect, StrategySnapshot, TraitDefinition,
} from './strategy-types';
import { UNIT_DEFINITIONS } from './units';
import { getUnitStats } from './unit-stats';
import { readRoundEnemyProjection } from './round-enemies';
import { hexDistance } from './board';
import { resolveAbility } from './combat-abilities';
import { deriveEffectiveTraits, projectEffectiveMembership, type TraitProjectionContext } from './traits/effective-membership';
import { makeSourcedEffects, resolveEffects } from './effects';
import { TRAIT_DEFINITIONS } from './content/traits';
import { ITEM_DEFINITIONS } from './content/g2-3-item-registry';
import { AUGMENT_DEFINITIONS } from './content/augments';
import { compileSupportGrants, type G24HeldItem } from './g2-4-support';
import { ANOMALY_DEFINITIONS } from './content/anomalies';

/** Overtime ordinals lie past the catalog (after 6-7); they count as the stage after the last catalog stage. */
function strategyStage(ordinal: number): number {
  return ROUND_CATALOG.find(r => r.ordinal === ordinal)?.stage ?? Math.max(...ROUND_CATALOG.map(r => r.stage)) + 1;
}
/** G2-4b stage-scaled artifacts bind one concrete program per snapshot; combat never sees the table. */
function stageProgram(program: ItemProgram, round: number): ItemProgram {
  const { byStage, ...rest } = structuredClone(program); if (!byStage) return rest;
  const flat = byStage.flat[Math.min(strategyStage(round), byStage.flat.length) - 1];
  return { ...rest, triggers: (rest.triggers ?? []).map(t => ({ ...t, effects: t.effects.map(e => e.kind === 'damage' ? { ...e, amount: { ...e.amount, flat } } : e) })) };
}
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
export function buildStrategySnapshot(state: CombatStrategyInputs, catalog: StrategyCatalog = DEFAULT_CATALOG, context?: TraitProjectionContext): StrategySnapshot {
  state=readCombatStrategyInputs(state);
  if(context&&context.round!==state.round)throw new RangeError('Trait projection round mismatch');
  const projection=projectEffectiveMembership(state.preparation,context,catalog.traits,[...state.items,
    ...(state.preparation.units.some(u=>u.team==='enemy')?readRoundEnemyProjection(state.round).items:[]).map(i=>({id:'enemy:'+i.unitId+':'+i.slot,definitionId:i.definitionId,location:{kind:'unit' as const,unitId:i.unitId,slot:i.slot}}))]);
  state={...state,preparation:projection.preparation};
  const openingTraits=[...deriveEffectiveTraits(projection,'player',catalog.traits),...deriveEffectiveTraits(projection,'enemy',catalog.traits)];
  const voidspawn=projectVoidspawns(state,openingTraits);
  state={...state,preparation:voidspawn.preparation};
  const projected={...projection,preparation:state.preparation};
  const traits = [...deriveEffectiveTraits(projected,'player',catalog.traits),...deriveEffectiveTraits(projected,'enemy',catalog.traits)];
  const boardUnits = state.preparation.units.filter(unit => unit.location.kind === 'board')
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const equipment = g22Equipment(state), conversions = scrapConversions(boardUnits, traits, equipment, catalog.items);
  // G2-4b: support items act on their holder's board neighbours, so every holder's items are known before any unit compiles.
  // Same item sources the per-unit loop binds below: player items/temporary equipment, and the round's enemy items.
  const onBoard = (team: 'player' | 'enemy') => new Set(boardUnits.filter(u => u.team === team).map(u => u.id)), players = onBoard('player'), enemyIds = onBoard('enemy');
  const held = new Map<string, G24HeldItem[]>(), hold = (unitId: string, definitionId: string, instanceId: string) =>
    held.set(unitId, [...held.get(unitId) ?? [], { definition: lookup(catalog.items, conversions.get(instanceId) ?? definitionId), instanceId }]);
  for (const item of state.items) if (item.location.kind === 'unit' && players.has(item.location.unitId)) hold(item.location.unitId, item.definitionId, item.id);
  for (const child of state.temporaryEquipment) if (players.has(child.holderId)) hold(child.holderId, child.definitionId, child.temporaryId);
  if (enemyIds.size) for (const item of readRoundEnemyProjection(state.round).items) if (enemyIds.has(item.unitId)) hold(item.unitId, item.definitionId, `enemy:${state.round}:${item.unitId}:${item.slot}`);
  const supportGrants = compileSupportGrants(boardUnits.flatMap(u => u.location.kind === 'board' ? [{ id: u.id, team: u.team, cell: u.location.cell }] : []),
    held, strategyStage(state.round),(holder,item,declaration)=>holder.team==='player'?p2SupportDeclaration(declaration,item.definition.id,state):declaration);

  const shrouds=equipment.flatMap(item=>{
    const definition=catalog.items[item.definitionId];
    const effect=definition?.effects.find(e=>e.kind==='mechanic'&&(e.mechanic==='g24Shroud'||e.mechanic==='g24Zephyr'));
    const owner=effect?boardUnits.find(other=>other.id===item.unitId):undefined;
    return owner&&effect?.kind==='mechanic'?[{item,owner,effect}]:[];
  });
  const d11=new Map(state.augments.filter(a=>Object.hasOwn(D11_FILL_TIERS,a.definitionId)).map(a=>[a.choiceId,
    compileD11Augment(a.definitionId as D11AugmentId,boardUnits,state.playerHp??100,d11OpeningSeed(state.g23?.seed??0,state.round,a.choiceId))]));
  const units = boardUnits.map(unit => {
    const itemSummon=voidspawn.origins.find(o=>o.unit.id===unit.id);
    const sources: SourcedEffect[] = [];
    if(itemSummon){
      const stage=voidspawnStage(state.round);
      sources.push(...makeSourcedEffects(unit.id,'ability','g24-voidspawn-ability',unit.id+':stage',[
        {kind:'statFlat',stat:'maxHp',amount:stage.health-1000},{kind:'statFlat',stat:'attackDamage',amount:stage.attack-80}]));
    }
    const itemPrograms: BoundItemProgram[] = [];
    for(const {item,owner,effect} of shrouds) if(owner.team===unit.team)
      sources.push(...makeSourcedEffects(unit.id,'item',item.definitionId,item.id+(effect.mechanic==='g24Shroud'?':team-health':':team-speed'),[
        effect.mechanic==='g24Shroud'?{kind:'statFlat',stat:'maxHp',amount:effect.values.allyHealth}
          :{kind:'attackSpeedBps',bps:effect.values.allyAttackSpeedBps}]));
    const bindItem = (definition: ItemDefinition, instanceId: string, parentItemInstanceId: string | null = null) => {
      if (!definition.combatProgram) return;
      validateItemProgram(definition.combatProgram);
      itemPrograms.push({ source: {ownerId:unit.id,sourceKind:'item',definitionId:definition.id,instanceId,effectIndex:(definition.effects.length+1)*1024,parentItemInstanceId},program:p3ItemProgram(definition.id,stageProgram(definition.combatProgram,state.round),unit.team==='player'?state.augments.map(a=>a.definitionId):[],strategyStage(state.round))});
    };
    // G2-4b: isolation is read from the frozen board placement, as Bulky Buddies reads adjacency.
    const isolated = !boardUnits.some(other => other.team === unit.team && other.id !== unit.id && other.location.kind === 'board' && unit.location.kind === 'board' && hexDistance(other.location.cell, unit.location.cell) === 1);
    const itemEffects = (definition: ItemDefinition): readonly Effect[] => isolated && definition.isolatedEffects ? [...definition.effects, ...definition.isolatedEffects] : definition.effects;
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
        const definition = p2ItemDefinition(lookup(catalog.items, conversions.get(item.id) ?? item.definitionId),state);
        sources.push(...makeSourcedEffects(unit.id, 'item', definition.id, item.id, itemEffects(definition)));
        bindItem(definition, item.id);
      }
      for (const child of state.temporaryEquipment.filter(item => item.holderId === unit.id)) {
        const definition = p2ItemDefinition(lookup(catalog.items, conversions.get(child.temporaryId) ?? child.definitionId),state);
        sources.push(...makeSourcedEffects(unit.id, 'item', definition.id, child.temporaryId, itemEffects(definition), child.parentItemInstanceId));
        bindItem(definition, child.temporaryId, child.parentItemInstanceId);
      }
      for (const augment of state.augments) {
        const definition = lookup(catalog.augments, augment.definitionId);
        const grant=d11.get(augment.choiceId)?.grants.find(g=>g.unitId===unit.id);
        if(grant){
          sources.push(...makeSourcedEffects(unit.id,'augment',augment.definitionId,augment.choiceId,grant.effects));
          if(Object.keys(grant.program).length)itemPrograms.push({source:{ownerId:unit.id,sourceKind:'augment',definitionId:augment.definitionId,instanceId:augment.choiceId,effectIndex:65536,parentItemInstanceId:null},program:grant.program});
          continue;
        }
        const program=p2AugmentProgram(augment.definitionId);
        if(program)itemPrograms.push({source:{ownerId:unit.id,sourceKind:'augment',definitionId:augment.definitionId,instanceId:augment.choiceId,effectIndex:65536,parentItemInstanceId:null},program});
        sources.push(...makeSourcedEffects(unit.id, 'augment', augment.definitionId, augment.choiceId, definition.effects.flatMap<Effect>(effect => compileAugmentEffect(effect,state,unit,augment,boardUnits,traits)).flatMap<Effect>(effect => {
          if (effect.kind !== 'mechanic') return [effect];
          if (effect.mechanic === 'investment') return state.augments.find(a=>catalog.augments[a.definitionId]?.effects.some(e=>e.kind==='mechanic'&&e.mechanic==='investment'))?.choiceId === augment.choiceId ? [{ kind: 'statFlat' as const, stat: 'maxHp' as const, amount: state.augmentProgress.investmentHp }] : [];
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
        const effects:readonly Effect[]=binding.definitionId==='avarice-incarnate'||binding.definitionId==='headhunter'
          ?[{kind:'mechanic',mechanic:'d11Anomaly',values:{enabled:1,priorKills:binding.definitionId==='headhunter'?d11PriorKills(state.g23,binding.boundRound):0}}]:definition.effects;
        sources.push(...makeSourcedEffects(unit.id, 'anomaly', binding.definitionId, binding.choiceId, effects));
      }
    } else {
      for (const item of readRoundEnemyProjection(state.round).items.filter(item => item.unitId === unit.id)) {
        const definition = lookup(catalog.items, conversions.get(`enemy:${state.round}:${unit.id}:${item.slot}`) ?? item.definitionId);
        sources.push(...makeSourcedEffects(unit.id, 'item', definition.id, `enemy:${state.round}:${unit.id}:${item.slot}`, itemEffects(definition)));
        bindItem(definition, `enemy:${state.round}:${unit.id}:${item.slot}`);
      }
    }
    for (const grant of supportGrants.get(unit.id) ?? []) {
      sources.push(...makeSourcedEffects(unit.id, 'item', grant.definitionId, grant.instanceId, grant.effects));
      if (grant.program) { validateItemProgram(grant.program); itemPrograms.push({ source: { ownerId: unit.id, sourceKind: 'item', definitionId: grant.definitionId, instanceId: grant.instanceId, effectIndex: (grant.effects.length + 1) * 1024, parentItemInstanceId: null }, program: structuredClone(grant.program) }); }
    }
    if(unit.definitionId==='rumble'&&unit.team==='player')sources.push(...makeSourcedEffects(unit.id,'trait','junker-king',unit.id+':junker',(unit.definitionId==='rumble'?g23JunkerEffects(state,unit.id):[])));
    sources.push(...makeSourcedEffects(unit.id,'trait','experiment',unit.id+':laboratory',g23ExperimentEffects(state,unit,traits)));
    if(unit.definitionId==='g23-sion'){
      const rose=g23SionTeam(state.preparation,unit.team,traits,state.d14Combat?.phase==='promoted'?state.d14Combat.unitId:undefined),stage=strategyStage(state.round),index=Math.max(0,Math.min(4,stage-2));
      const stages=rose.tier>=5?G23_SUMMON_POLICY.sion.tier5StageBps:rose.tier===4?G23_SUMMON_POLICY.sion.tier4StageBps:G23_SUMMON_POLICY.sion.tier3StageBps;
      const bps=Math.floor(stages[index]*(10000+rose.stars*1500)/10000)-10000;
      sources.push(...makeSourcedEffects(unit.id,'trait','black-rose',unit.id,[{kind:'statFlat',stat:'maxHp',amount:Math.max(0,Math.floor(1000*bps/10000))},{kind:'mechanic',mechanic:'g23Sion',values:{tier:rose.tier}}]));
    }
    const growth = state.persistentGrowth.find(entry => entry.unitId === unit.id);
    if (growth) sources.push(...makeSourcedEffects(unit.id, 'ability', 'tristana-ability', `persistent:${unit.id}`, [{ kind: 'statPercentBps', stat: 'attackDamage', bps: growth.attackDamageBps }]));
    const anomaly=state.anomalyBinding?.unitId===unit.id?state.anomalyBinding.definitionId:null;
    const bonus=anomaly==='freestyling'?Math.round(traits.filter(t=>t.team===unit.team&&t.tier>0&&lookup(catalog.traits,t.traitId).tiers[0].threshold>1).length*450)
      :anomaly==='force-of-friendship'?boardUnits.filter(x=>x.team===unit.team).reduce((n,x)=>n+((state.d14Combat?.unitId===x.id&&state.d14Combat.phase==='promoted')?400:x.starLevel===3?800:x.starLevel*100),0)
      :anomaly==='comeback-story'?Math.floor((100-(state.playerHp??100))/10)*500:0;
    if(bonus&&state.anomalyBinding)sources.push(...makeSourcedEffects(unit.id,'anomaly',anomaly!,state.anomalyBinding.choiceId+':scaling',[{kind:'mechanic',mechanic:'damageAmp',values:{bps:bonus}}]));
    const base = unit.location.kind==='board'?g23FormStats(unit.definitionId, unit.starLevel,unit.team,unit.location.cell.row):getUnitStats(unit.definitionId,unit.starLevel);
    const promoted=state.d14Combat?.unitId===unit.id&&state.d14Combat.phase==='promoted';
    if(state.d14Combat?.unitId===unit.id&&state.d14Combat.phase==='returned')sources.push(...makeSourcedEffects(unit.id,'anomaly','into-the-unknown',state.anomalyBinding!.choiceId+':return',[{kind:'statPercentBps',stat:'attackDamage',bps:5000},{kind:'statFlat',stat:'abilityPower',amount:50}]));
    const certified=promoted?d14UnitBase(unit,true):null;
    let resolved = resolveEffects(certified?.base??base, certified?.ability??resolveAbility(base.abilityId, unit.starLevel), sources);
    const family = (resolved.mechanics ?? []).find(m => m.mechanic === 'family');
    if (family) {
      const maxMana = Math.floor(resolved.stats.maxMana * (10000 - family.values.manaReductionBps) / 10000);
      resolved = { ...resolved, stats: { ...resolved.stats, maxMana, initialMana: Math.min(resolved.stats.initialMana, maxMana) } };
    }
    for(const m of resolved.mechanics ?? []) {
      const program=m.mechanic==='s13P3'?p3Program(m.source.definitionId,strategyStage(state.round)):m.mechanic==='g23Junker'?{modifiers:m.values.titan?[modifier('damageReduction',9000,'bps')]:[]}:m.mechanic==='g23Experiment'?g23ExperimentProgram(m.values):m.mechanic==='g23Trait'?g23TraitProgram(m.source.definitionId,m.values.tier,resolved.stats.maxMana):m.mechanic==='g23Anomaly'?g23AnomalyProgram(m.source.definitionId,resolved.stats.maxMana):null;
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
    const gambler=mechanics.find(m=>m.mechanic==='g24Gambler'),avarice=anomaly==='avarice-incarnate';
    if((gambler||avarice)&&(!Number.isSafeInteger(state.bankGold)||state.bankGold!<0))throw new RangeError('Missing authoritative combat bank');
    return { unitId: unit.id, ...resolved, ...(promoted?{effectiveStarLevel:4 as const}:{}), ...(itemSummon?{itemSummon}:{}),mechanics,...(gambler||avarice?{openingItemBankGold:avarice?state.bankGold!:Math.min(gambler!.values.goldLimit,state.bankGold!)}:{}), ...(itemPrograms.length ? {itemPrograms} : {}) };
  });
  return appendMirrorSummons(state.preparation,{ traits, units });
}
