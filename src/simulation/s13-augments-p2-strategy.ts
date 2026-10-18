/** Per-instance overrides and pure team predicates. Never mutate the ordinary item catalogue. */
import type { CombatStrategyInputs } from './combat-input';
import type { Effect, ItemDefinition } from './strategy-types';
import type { Unit } from './unit-types';
import type { ItemProgram } from './m8/item-program';
import type { G24SupportDeclaration } from './content/g2-4-support-items';
import { modifier } from './content/item-programs';
import { P2_ITEM_GRANTS, p2Values } from './content/s13-augments-p2';
import { UNIT_DEFINITIONS } from './units';
import type { CombatUnit } from './combat-types';
const has = (state: CombatStrategyInputs, id: string) => state.augments.some(a => a.definitionId === id);
const flat = (stat: 'maxHp' | 'abilityPower' | 'armor' | 'initialMana', amount: number): Effect => ({kind:'statFlat',stat,amount});
const speed = (bps: number): Effect => ({kind:'attackSpeedBps',bps});
const pct = (stat: 'attackDamage' | 'maxHp', bps: number): Effect => ({kind:'statPercentBps',stat,bps});

export function p2AugmentEffects(id: string, unit: Unit, board: readonly Unit[], state: CombatStrategyInputs): Effect[] {
  const v = p2Values(id), allies = board.filter(u => u.team === unit.team && !UNIT_DEFINITIONS[u.definitionId]?.summon);
  switch (id) {
    case 'crown-guarded': case 'not-today': return [{kind:'mechanic',mechanic:'s13P2ItemAugment',values:{enabled:1}}];
    case 'crownguard-spirit': return [flat('abilityPower',v.AP),flat('armor',v.Armor)];
    case 'shojin-spirit': return [pct('attackDamage',Math.round(v.AD*10000)),flat('initialMana',v.Mana)];
    case 'guardbreaker-spirit': return [speed(Math.round(v.AS*10000))];
    case 'all-for-one-ii': {
      const count = new Set(allies.filter(u=>UNIT_DEFINITIONS[u.definitionId].cost===v.Tier).map(u=>u.definitionId)).size;
      return [pct('maxHp',Math.round(v.PercHP*10000)*count),{kind:'mechanic',mechanic:'damageAmp',values:{bps:Math.round(v.DamageAmp*10000)*count}}];
    }
    case 'pair-of-fours': return UNIT_DEFINITIONS[unit.definitionId].cost===v.Tier && allies.filter(u=>UNIT_DEFINITIONS[u.definitionId].cost===v.Tier).length===v.NumCopies
      ? [flat('maxHp',v.Health),speed(Math.round(v.AttackSpeed*10000))] : [];
    case 'trifecta-ii': return [speed(Math.round(v.TeamAttackSpeed*10000)),...(UNIT_DEFINITIONS[unit.definitionId].cost===v.Tier?[{kind:'mechanic' as const,mechanic:'s13P2Augment',values:{enabled:1}}]:[])];
    case 'calculated-enhancement': return !UNIT_DEFINITIONS[unit.definitionId].summon && unit.location.kind==='board' && unit.location.cell.row>=state.preparation.board.deploymentZones.player.lastRow-1
      ? [{kind:'mechanic',mechanic:'s13P2Augment',values:{enabled:1}}] : [];
    default: return [];
  }
}
export function p2AugmentProgram(id: string): ItemProgram | null {
  return id==='guardbreaker-spirit'?{modifiers:[modifier('critChance',Math.round(p2Values(id).CritChance*10000),'bps')]}:null;
}
export function p2ItemDefinition(definition: ItemDefinition, state: CombatStrategyInputs): ItemDefinition {
  let result = definition;
  for (const id of ['sword-overflow','wand-overflow','belt-overflow']) if (has(state,id) && definition.id===P2_ITEM_GRANTS[id].id) {
    const v=p2Values(id), effect=id==='belt-overflow'?flat('maxHp',v.BonusHealth):speed(Math.round(v.BonusStat*10000));
    result={...result,effects:[...result.effects,effect]};
  }
  if (definition.id==='edge-of-night' && has(state,'not-today')) result={...result,effects:[...result.effects,speed(Math.round(p2Values('not-today').AS*100))]};
  if (definition.id==='crownguard' && has(state,'crown-guarded') && definition.combatProgram) {
    result={...result,combatProgram:p2CrownguardProgram(definition.combatProgram)};
  }
  return result;
}
function p2CrownguardProgram(program: ItemProgram): ItemProgram {
  const v=p2Values('crown-guarded');return {...program,effects:program.effects?.map(e=>e.kind==='grant-shield'
    ? {...e,amount:{...e.amount,maxHpBps:Math.round(e.amount.maxHpBps*(1+v.effectincrease))},durationTicks:e.durationTicks+v.DurationIncrease*20}:e)};
}
/** Treasure Chest instances gained mid-combat receive the same named-item overrides. */
export function p2GrantedItemProgram(unit:Partial<Pick<CombatUnit,'mechanics'>>,id:string,program:ItemProgram):ItemProgram {
  const enabled=(augment:string)=>unit.mechanics?.some(m=>m.mechanic==='s13P2ItemAugment'&&m.source.definitionId===augment);
  if(id==='crownguard'&&enabled('crown-guarded'))return p2CrownguardProgram(program);
  if(id==='edge-of-night'&&enabled('not-today'))return {...program,modifiers:[...program.modifiers??[],modifier('attackSpeed',Math.round(p2Values('not-today').AS*100),'bps')]};
  return program;
}
export function p2SupportDeclaration(definition: G24SupportDeclaration, itemId: string, state: CombatStrategyInputs): G24SupportDeclaration {
  if (itemId==='TFT_Item_ZekesHerald' && has(state,'flurry-of-blows')) return {...definition,auras:definition.auras.map(a=>({...a,program:{...a.program,modifiers:[...a.program?.modifiers??[],modifier('critChance',Math.round(p2Values('flurry-of-blows').CSBonus*10000),'bps')]}}))};
  if (itemId==='TFT4_Item_OrnnRanduinsSanctum' && has(state,'immovable-object')) return {...definition,auras:definition.auras.map(a=>({...a,radius:a.radius+1,effects:a.effects.map(e=>e.kind==='statFlat'?{...e,amount:Math.round(e.amount*(1+p2Values('immovable-object').effectincrease))}:e)}))};
  return definition;
}
