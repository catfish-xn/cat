import * as api from '../../../src/simulation/match';
import { ITEM_DEFINITIONS } from '../../../src/simulation/content/items';
import { UNIT_DEFINITIONS } from '../../../src/simulation/units';
import { MATCH_RULES } from '../../../src/simulation/match-rules';
import { checkEquipmentPlacement } from '../../../src/simulation/equipment-policy';

/** Version the actual command recipe, independently of generated save bytes. */
export const HERALD_RAW_GENERATION_VERSION = 'g2-2-herald-public-commands-v3';
export const HERALD_RAW_CASES = [
  { name: 'ionic-spark', definitions: ['ionic-spark'] },
  { name: 'evenshroud', definitions: ['evenshroud'] },
  { name: 'ionic-spark--evenshroud', definitions: ['ionic-spark', 'evenshroud'] },
  { name: 'quicksilver', definitions: ['quicksilver'] },
  { name: 'edge-of-night', definitions: ['edge-of-night'] },
] as const;
export type HeraldCommandObserver = (before: api.MatchState, result: api.MatchCommandResult | api.MatchStep,
  operation: string, args: readonly unknown[]) => void;

function accepted(result: api.MatchCommandResult): api.MatchState {
  if (!result.ok) throw new Error(`Public neutral fixture: ${result.reason}`);
  return result.state;
}
function commandApi(observer?: HeraldCommandObserver): typeof api {
  if (!observer) return api;
  return new Proxy(api, { get(target, property) {
    const value = Reflect.get(target, property);
    if (typeof value !== 'function') return value;
    return (...args: unknown[]) => {
      const result = Reflect.apply(value, target, args) as api.MatchCommandResult | api.MatchStep;
      observer(args[0] as api.MatchState, result, String(property), args.slice(1));
      return result;
    };
  } });
}

/** Keep the legitimately acquired original Irelia as the single charge target.
 * The original synthetic Garen was only a durable target, not a Garen-stat oracle.
 * Public bench commands preserve all acquired heroes and permanent equipment. */
export function fieldHeraldTarget(initial: api.MatchState, observer?: HeraldCommandObserver): api.MatchState {
  const commands = commandApi(observer);
  let state = initial;
  for (const unit of state.preparation.units.filter(unit => unit.team === 'player' && unit.id !== 'unit-1' && unit.location.kind === 'board')) {
    const occupied = new Set(state.preparation.units.flatMap(unit => unit.location.kind === 'bench' ? [unit.location.slot] : []));
    const slot = Array.from({ length: state.preparation.benchSize }, (_, index) => index).find(index => !occupied.has(index));
    if (slot === undefined) throw new Error('No public bench slot for Herald fixture');
    state = accepted(commands.deployMatchUnit(state, unit.id, { kind: 'bench', slot }));
  }
  return accepted(commands.deployMatchUnit(state, 'unit-1', { kind: 'board', cell: { col: 3, row: 4 } }));
}

/** Raw command construction only: no import or call of restoreMatch/serializeMatch.
 * The supplied genuine unresolved 4-4 prefix is independently copied. Every
 * intervening battle and item acquisition remains the original public route. */
export function buildRawHeraldEquipment(initial: api.MatchState, definitions: readonly string[],
  observer?: HeraldCommandObserver): api.MatchState {
  if (initial.roundDefinitionId !== '4-4' || initial.phase !== 'choice') throw new Error('Missing public 4-4 equipment prefix');
  const commands = commandApi(observer);
  let state: api.MatchState = structuredClone(initial);
  const required = definitions.flatMap(id => [...ITEM_DEFINITIONS[id].recipe!]);
  const inventory = () => state.items.filter(item => item.location.kind === 'inventory');
  function missingComponent(): string {
    const available = inventory().map(item => item.definitionId);
    for (const component of required) {
      const index = available.indexOf(component);
      if (index < 0) return component;
      available.splice(index, 1);
    }
    return 'sword';
  }
  while (state.roundDefinitionId !== '6-7') {
    while (state.phase === 'choice') {
      const choice = state.pendingChoice!;
      // Keep the original Hypervelocity holder/effect through the expanded41-entry pool.
      // Every search pays the normal public reroll cost; no fixture stats/resources are patched.
      if(choice.kind==='anomaly'&&choice.step==='offer'&&!choice.offers.includes('hypervelocity')&&state.gold>=1){
        state=accepted(commands.rerollAnomaly(state,choice.choiceId,choice.generation));
        continue;
      }
      state = accepted(choice.step === 'target'
        ? commands.selectAnomalyTarget(state, choice.choiceId, choice.generation, state.preparation.units.find(u => u.definitionId === 'kogmaw')!.id)
        : commands.selectChoice(state, choice.choiceId, choice.generation, choice.kind === 'component' ? missingComponent() : choice.kind==='anomaly'&&choice.offers.includes('hypervelocity')?'hypervelocity':choice.offers[0]));
    }
    if (state.phase === 'preparation') {
      while (state.level < 8 && state.gold >= 4) state = accepted(commands.buyXp(state));
      // The expanded augment pool changes this branch's army strength. Spend real
      // remaining gold on natural-shop copies of owned heroes; keep every battle,
      // source, receipt and ordinary bench/upgrade rule in the public route.
      for (;;) {
        const slot=state.shop.slots.findIndex(offer=>offer.status==='available'
          && UNIT_DEFINITIONS[offer.definitionId].cost<=state.gold
          && (offer.definitionId==='garen'||state.preparation.units.some(u=>u.team==='player'&&u.definitionId===offer.definitionId&&u.starLevel===1))
          && (state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench').length<state.preparation.benchSize
            ||state.preparation.units.filter(u=>u.team==='player'&&u.definitionId===offer.definitionId&&u.starLevel===1).length>=2));
        if(slot>=0){state=accepted(commands.buyUnit(state,slot,state.shop.generation));continue;}
        const reserve=Math.max(...state.preparation.units.filter(u=>u.team==='player').map(u=>UNIT_DEFINITIONS[u.definitionId].cost));
        if(state.gold<MATCH_RULES.rerollCost+reserve||state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench').length===state.preparation.benchSize)break;
        state=accepted(commands.rerollShop(state));
      }
      for (const unit of state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench')) {
        if (state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board').length >= state.level) break;
        const free = [{ col: 3, row: 4 }, { col: 5, row: 4 }, { col: 0, row: 4 }, { col: 6, row: 4 }, { col: 3, row: 7 }, ...Array.from({length:28},(_,i)=>({col:i%7,row:4+Math.floor(i/7)}))]
          .find(cell => !state.preparation.units.some(u => u.location.kind === 'board' && u.location.cell.col === cell.col && u.location.cell.row === cell.row));
        if (!free) throw new Error('No public deployment cell');
        state = accepted(commands.deployMatchUnit(state, unit.id, { kind: 'board', cell: free }));
      }
      // Preserve the exact components needed for the isolated Herald equipment;
      // use only genuine surplus components and inventory items to sustain the army.
      const reserved=new Set<string>(),available=[...inventory()];
      for(const component of required){const index=available.findIndex(i=>i.definitionId===component);if(index>=0)reserved.add(available.splice(index,1)[0].id);}
      for(;;){
        const spare=inventory().filter(i=>!reserved.has(i.id)&&ITEM_DEFINITIONS[i.definitionId]?.kind==='component');
        if(spare.length<2)break;
        state=accepted(commands.combineItems(state,spare[0].id,spare[1].id));
      }
      for(const item of inventory().filter(i=>ITEM_DEFINITIONS[i.definitionId]?.kind==='completed')){
        const holders=state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board');
        const placement=holders.flatMap(u=>[0,1,2].map(slot=>({unitId:u.id,slot}))).find(p=>checkEquipmentPlacement(state.items,item,p.unitId,p.slot).allowed);
        if(placement)state=accepted(commands.equipItem(state,item.id,placement.unitId,placement.slot));
      }
      state = accepted(commands.startMatchCombat(state));
      while (state.phase === 'combat') state = commands.stepMatch(state).state;
    }
    if (state.phase === 'choice') continue;
    if (state.phase !== 'settlement') throw new Error(`Equipment route stopped at ${state.roundDefinitionId}/${state.phase}`);
    state = accepted(commands.nextRound(state, state.round));
  }
  // The flexible T13 army may have used the original holder as its early tank.
  // Strip that real equipment with an earned one-use remover before this isolated target scenario.
  if(state.items.some(item=>item.location.kind==='unit'&&item.location.unitId==='unit-1')){
    const remover=state.consumables.find(tool=>tool.definitionId==='magnetic-remover')!;
    state=accepted(commands.useConsumable(state,remover.consumableId,{kind:'unit',unitId:'unit-1'}));
  }
  for (const [slot, definitionId] of definitions.entries()) {
    const available = [...inventory()];
    const inputs = ITEM_DEFINITIONS[definitionId].recipe!.map(component => {
      const index = available.findIndex(item => item.definitionId === component);
      if (index < 0) throw new Error(`Public route did not acquire ${component} for ${definitionId}`);
      return available.splice(index, 1)[0].id;
    });
    const combined = commands.combineItems(state, inputs[0], inputs[1]);
    state = accepted(combined);
    if (!combined.ok) throw new Error(combined.reason);
    const event = combined.events.find(event => event.type === 'itemCombined');
    if (!event || event.type !== 'itemCombined') throw new Error('Missing public item combination');
    state = accepted(commands.equipItem(state, event.itemId, 'unit-1', slot));
  }
  return fieldHeraldTarget(state, observer);
}
