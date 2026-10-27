import { d14UnitBase } from './d14-anomalies/projection';
import { moonlightSelection } from './augment-pool-batch5-s11a';
import { drainSetup } from './setup-work';
import { bindV20Teamups, v20MembershipSources } from './v20-teamups';
import { familyReunionParticipants, familyCombatBase } from './family-reunion';
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
  Effect, ChoiceDefinition, ItemDefinition, SourcedEffect, StrategySnapshot, TraitDefinition, TraitSnapshot,
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
import { ENFORCER_CONFISCATION_POLICY } from './content/enforcer-confiscation';
import type { Team } from './board';

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
export function buildStrategySnapshot(state: CombatStrategyInputs, catalog: StrategyCatalog = DEFAULT_CATALOG, context?: TraitProjectionContext, equipmentBasis?: StrategySnapshot, confiscated?: readonly Team[]): StrategySnapshot {
  return drainSetup(buildStrategySnapshotSteps(state, catalog, context, equipmentBasis, confiscated));
}
/** Enforcer 10 ({9edd4912}=1) on the other side confiscates this team's items for the whole combat. */
export function enforcerConfiscates(traits: readonly TraitSnapshot[], victim: Team): boolean {
  return traits.some(t => t.team !== victim && t.traitId === 'enforcer' && t.tier >= ENFORCER_CONFISCATION_POLICY.fromTier);
}
/** `confiscated` adds teams whose opposing Enforcer 10 is compiled elsewhere (two-sided sides, battle-time equipment). */
export function* buildStrategySnapshotSteps(state: CombatStrategyInputs, catalog: StrategyCatalog = DEFAULT_CATALOG, context?: TraitProjectionContext, equipmentBasis?: StrategySnapshot, confiscated: readonly Team[] = []): Generator<void, StrategySnapshot, void> {
  state=readCombatStrategyInputs(state);
  if(context&&context.round!==state.round)throw new RangeError('Trait projection round mismatch');
  const sisterAugment=state.augments.find(a=>a.definitionId==='sisters');
  const sisterUnits=state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board'&&['jinx','vi'].includes(u.definitionId));
  const sisterSources=sisterAugment&&new Set(sisterUnits.map(u=>u.definitionId)).size===2?sisterUnits.map(u=>({kind:'add-trait' as const,sourceId:sisterAugment.choiceId+':sisters:'+u.id,unitId:u.id,traitId:'sisters',activeFromRound:state.round,expiresBeforeRound:state.round+1})):[];
  const teamups=bindV20Teamups(state), teamupSources=v20MembershipSources(state,teamups);
  const traitContext=sisterSources.length||teamupSources.length?{round:state.round,sources:[...(context?.sources??[]),...sisterSources,...teamupSources]}:context;
  const projection=projectEffectiveMembership(state.preparation,traitContext,catalog.traits,[...state.items,
    ...(state.preparation.units.some(u=>u.team==='enemy')?readRoundEnemyProjection(state.round).items:[]).map(i=>({id:'enemy:'+i.unitId+':'+i.slot,definitionId:i.definitionId,location:{kind:'unit' as const,unitId:i.unitId,slot:i.slot}}))]);
  state={...state,preparation:projection.preparation};
  const openingTraits=[...deriveEffectiveTraits(projection,'player',catalog.traits),...deriveEffectiveTraits(projection,'enemy',catalog.traits)];
  // P enforcer-confiscation-v1: confiscate first, from the combat projection only; emblems (membership already
  // projected above) and non-champion holders keep their items. The permanent item ledger is never touched.
  const victims = new Set<Team>([...confiscated, ...(['player', 'enemy'] as const).filter(team => enforcerConfiscates(equipmentBasis?.traits ?? openingTraits, team))]);
  const keeps = (holderId: string, definitionId: string) => {
    const holder = state.preparation.units.find(u => u.id === holderId), unit = holder && UNIT_DEFINITIONS[holder.definitionId];
    return !holder || !victims.has(holder.team) || !!catalog.items[definitionId]?.emblemTrait || !unit || !!unit.summon || unit.unitKind === 'neutral';
  };
  const enemyItems = (state.preparation.units.some(u => u.team === 'enemy') ? readRoundEnemyProjection(state.round).items : []).filter(i => keeps(i.unitId, i.definitionId));
  if (victims.size) state = { ...state, items: state.items.filter(i => i.location.kind !== 'unit' || keeps(i.location.unitId, i.definitionId)),
    temporaryEquipment: state.temporaryEquipment.filter(i => keeps(i.holderId, i.definitionId)) };
  const voidspawn=projectVoidspawns(state,openingTraits);
  state={...state,preparation:voidspawn.preparation};
  const projected={...projection,preparation:state.preparation};
  const traits = equipmentBasis?.traits ?? [...deriveEffectiveTraits(projected,'player',catalog.traits),...deriveEffectiveTraits(projected,'enemy',catalog.traits)];
  const reunion=new Set([...familyReunionParticipants(state,'player'),...familyReunionParticipants(state,'enemy')]);
  const boardUnits = state.preparation.units.filter(unit => unit.location.kind === 'board')
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const openingStars=new Map(boardUnits.map(u=>[u.id,reunion.has(u.id)?Math.min(4,(state.d14Combat?.unitId===u.id&&state.d14Combat.phase==='promoted'?4:u.starLevel)+(teamups.get('menaces')?.[0]===u.id?0:1)):(state.d14Combat?.unitId===u.id&&state.d14Combat.phase==='promoted'?4:u.starLevel)]));
  const moonlight=moonlightSelection(boardUnits,state.augments,state.round,state.g23?.seed??0,openingStars);
  const equipment = g22Equipment(state, enemyItems), conversions = scrapConversions(boardUnits, traits, equipment, catalog.items, { seed: state.g23?.seed ?? 0, round: state.round });
  // G2-4b: support items act on their holder's board neighbours, so every holder's items are known before any unit compiles.
  // Same item sources the per-unit loop binds below: player items/temporary equipment, and the round's enemy items.
  const onBoard = (team: 'player' | 'enemy') => new Set(boardUnits.filter(u => u.team === team).map(u => u.id)), players = onBoard('player'), enemyIds = onBoard('enemy');
  const held = new Map<string, G24HeldItem[]>(), hold = (unitId: string, definitionId: string, instanceId: string) =>
    held.set(unitId, [...held.get(unitId) ?? [], { definition: lookup(catalog.items, conversions.get(instanceId) ?? definitionId), instanceId }]);
  for (const item of state.items) if (item.location.kind === 'unit' && players.has(item.location.unitId)) hold(item.location.unitId, item.definitionId, item.id);
  for (const child of state.temporaryEquipment) if (players.has(child.holderId)) hold(child.holderId, child.definitionId, child.temporaryId);
  if (enemyIds.size) for (const item of enemyItems) if (enemyIds.has(item.unitId)) hold(item.unitId, item.definitionId, `enemy:${state.round}:${item.unitId}:${item.slot}`);
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
  yield;
  const compileUnit = (unit: typeof boardUnits[number]) => {
    // P (2026-10-24): a placed Hextech Forge carries its Jayce's saved cell, so the combat constructor lays it out the same way.
    const forgeOwner = unit.definitionId === 'g23-forge' ? unit.id.slice(0, -':g23-forge'.length) : undefined;
    const summonCell = forgeOwner && state.itemSummonPositions && Object.hasOwn(state.itemSummonPositions, forgeOwner) ? state.itemSummonPositions[forgeOwner] : undefined;
    const suppressFamily=teamups.get('menaces')?.[0]===unit.id;
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
    const itemEffects = (definition: ItemDefinition): readonly Effect[] => (isolated && definition.isolatedEffects ? [...definition.effects, ...definition.isolatedEffects] : definition.effects).map(effect=>
      effect.kind==='mechanic'&&effect.mechanic==='v19Chainblade'?{...effect,values:{...effect.values,pvp:!ROUND_CATALOG.find(r=>r.ordinal===state.round)||ROUND_CATALOG.find(r=>r.ordinal===state.round)?.kind==='pvp'?1:0}}:effect);
    for (const trait of traits) {
      if (trait.traitId==='family'&&suppressFamily)continue;
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
          if (effect.values.backRowOnly && unit.location.kind === 'board' && unit.location.cell.row < state.preparation.board.deploymentZones.player.lastRow - 1) return [];
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
      for (const item of enemyItems.filter(item => item.unitId === unit.id)) {
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
      const sion=G23_SUMMON_POLICY.sion,bps=Math.floor(stages[index]*(10000+rose.stars*sion.starHealthBps)/10000)-10000;
      const resists=rose.tier>=7?sion.resistsByTier[7]:rose.tier>=5?sion.resistsByTier[5]:rose.tier===4?sion.resistsByTier[4]:sion.resistsByTier[3];
      sources.push(...makeSourcedEffects(unit.id,'trait','black-rose',unit.id,[{kind:'statFlat',stat:'maxHp',amount:Math.max(0,Math.floor(sion.base.baseStats.health*bps/10000))},
        {kind:'statPercentBps',stat:'attackDamage',bps:rose.stars*sion.starAttackBps},{kind:'statFlat',stat:'armor',amount:resists},{kind:'statFlat',stat:'magicResist',amount:resists},
        {kind:'mechanic',mechanic:'g23Sion',values:{tier:rose.tier}}]));
    }
    const growth = state.persistentGrowth.find(entry => entry.unitId === unit.id);
    if (growth) sources.push(...makeSourcedEffects(unit.id, 'ability', 'tristana-ability', `persistent:${unit.id}`, [{ kind: 'statPercentBps', stat: 'attackDamage', bps: growth.attackDamageBps }]));
    const anomaly=state.anomalyBinding?.unitId===unit.id?state.anomalyBinding.definitionId:null;
    const bonus=anomaly==='freestyling'?Math.round(traits.filter(t=>t.team===unit.team&&t.tier>0&&lookup(catalog.traits,t.traitId).tiers[0].threshold>1).length*450)
      :anomaly==='force-of-friendship'?boardUnits.filter(x=>x.team===unit.team).reduce((n,x)=>n+((state.d14Combat?.unitId===x.id&&state.d14Combat.phase==='promoted')?400:x.starLevel===3?800:x.starLevel*100),0)
      :anomaly==='comeback-story'?Math.floor((100-(state.playerHp??100))/10)*500:0;
    if(bonus&&state.anomalyBinding)sources.push(...makeSourcedEffects(unit.id,'anomaly',anomaly!,state.anomalyBinding.choiceId+':scaling',[{kind:'mechanic',mechanic:'damageAmp',values:{bps:bonus}}]));
    if(unit.definitionId==='mel'&&state.g23?.mel?.savedBattleId)sources.push(...makeSourcedEffects(unit.id,'trait','banished-mage',unit.id,[{kind:'mechanic',mechanic:'damageAmp',values:{bps:1000}}]));
    const base = unit.location.kind==='board'?g23FormStats(unit.definitionId, unit.starLevel,unit.team,unit.location.cell.row):getUnitStats(unit.definitionId,unit.starLevel);
    const promoted=state.d14Combat?.unitId===unit.id&&state.d14Combat.phase==='promoted';
    if(state.d14Combat?.unitId===unit.id&&state.d14Combat.phase==='returned')sources.push(...makeSourcedEffects(unit.id,'anomaly','into-the-unknown',state.anomalyBinding!.choiceId+':return',[{kind:'statPercentBps',stat:'attackDamage',bps:5000},{kind:'statFlat',stat:'abilityPower',amount:50}]));
    // Keep the death-linked reunion membership even when Menaces suppresses the extra star.
    const frozen = equipmentBasis?.units.find(u => u.unitId === unit.id);
    const reunionStar=frozen?frozen.familyReunion?.combatStarLevel:reunion.has(unit.id)?Math.min(4,(promoted?4:unit.starLevel)+(suppressFamily?0:1)) as 1|2|3|4:undefined;
    const frozenBonus=frozen?.sources.find(s=>s.source.sourceKind==='augment'&&['moonlight','greater-moonlight'].includes(s.source.sourceDefinitionId)&&s.source.sourceInstanceId.endsWith(':bonus')&&s.effect.kind==='statPercentBps');
    const moon=frozen?(frozenBonus?{star:frozen.effectiveStarLevel as 3|4,definitionId:frozenBonus.source.sourceDefinitionId,choiceId:frozenBonus.source.sourceInstanceId.slice(0,-6),adBps:frozenBonus.effect.kind==='statPercentBps'?frozenBonus.effect.bps:0,ap:frozenBonus.source.sourceDefinitionId==='moonlight'?25:5}:undefined):moonlight.get(unit.id);
    if(moon)sources.push(...makeSourcedEffects(unit.id,'augment',moon.definitionId,moon.choiceId+':bonus',[{kind:'statPercentBps',stat:'attackDamage',bps:moon.adBps},{kind:'statFlat',stat:'abilityPower',amount:moon.ap}]));
    const combatStar=moon?.star??reunionStar??(promoted?4:undefined);
    const certified=moon?.star===4?d14UnitBase({...unit,starLevel:3},true):moon?familyCombatBase(unit,moon.star):reunionStar?familyCombatBase(unit,reunionStar):promoted?d14UnitBase(unit,true):null;
    // During battle only item declarations change. Membership, tier effects and all
    // other opening bonuses stay frozen; use the same numerical compiler below.
    if (frozen) sources.splice(0, sources.length, ...frozen.sources.filter(s => s.source.sourceKind !== 'item' && !(s.source.sourceKind==='augment'&&s.source.sourceDefinitionId==='coronation')),
      ...sources.filter(s => s.source.sourceKind === 'item'||s.source.sourceKind==='augment'&&s.source.sourceDefinitionId==='coronation'));
    let resolved = resolveEffects(certified?.base??base, certified?.ability??resolveAbility(base.abilityId, unit.starLevel), sources);
    // Batch-3 hero augments: the strongest copy's ability costs ManaReduction less mana and Vladimir gains range.
    const hero = (resolved.mechanics ?? []).find(m => m.mechanic === 'heroCarryLive');
    if (hero && (hero.values.manaReduction || hero.values.rangeBonus)) {
      const maxMana = Math.max(1, resolved.stats.maxMana - hero.values.manaReduction);
      resolved = { ...resolved, stats: { ...resolved.stats, maxMana, initialMana: Math.min(resolved.stats.initialMana, maxMana), attackRange: resolved.stats.attackRange + hero.values.rangeBonus } };
    }
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
    for(const [id,partners] of teamups)if(partners.includes(unit.id)){
      const m=mechanics.find(m=>m.mechanic==='v20Teamup'&&m.source.definitionId===id);
      if(m)mechanics[mechanics.indexOf(m)]={...m,targetId:partners.find(p=>p!==unit.id)!};
    }
    if (unit.definitionId === 'vander') mechanics.push({ source: {ownerId:unit.id,sourceKind:'ability',definitionId:'vander-ability',instanceId:unit.id,effectIndex:0},mechanic:'lowCostAllies',values:{count:boardUnits.filter(other=>other.team===unit.team && UNIT_DEFINITIONS[other.definitionId].cost<=2).length}});
    const gambler=mechanics.find(m=>m.mechanic==='g24Gambler'),avarice=anomaly==='avarice-incarnate';
    if((gambler||avarice)&&(!Number.isSafeInteger(state.bankGold)||state.bankGold!<0))throw new RangeError('Missing authoritative combat bank');
    return { unitId: unit.id, ...resolved, ...(reunionStar?{effectiveStarLevel:combatStar!,familyReunion:frozen?.familyReunion??{originalStarLevel:unit.starLevel,combatStarLevel:combatStar!,unboostedStarLevel:moon?.star??(promoted?4 as const:unit.starLevel)}}:combatStar?{effectiveStarLevel:combatStar}:{}), ...(itemSummon?{itemSummon}:{}),...(summonCell?{summonCell:{col:summonCell.col,row:summonCell.row}}:{}),mechanics,...(gambler||avarice?{openingItemBankGold:avarice?state.bankGold!:Math.min(gambler!.values.goldLimit,state.bankGold!)}:{}), ...(itemPrograms.length ? {itemPrograms} : {}) };
  };
  const units: ReturnType<typeof compileUnit>[] = [];
  for (const unit of boardUnits) { units.push(compileUnit(unit)); yield; }
  return appendMirrorSummons(state.preparation,{ traits, units });
}
