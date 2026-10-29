import { AUGMENT_BATCH5_G1, LUCKY_GLOVES_CHAMPION_ROLES, LUCKY_GLOVES_RANGED_ROLES, LUCKY_GLOVES_ROLE_ITEMS } from './content/augment-pool-batch5-g1';
import { ITEM_DEFINITIONS } from './content/g2-3-item-registry';
import { G23_RADIANT_MAPPING } from './content/g2-3-special-item-runtime';
import { getUnitForm } from './seat-mechanics/forms';
import { initializeStreams, selectTemporaryPair, uniformIndex, type EquipmentPool, type EquipmentState, type RoundRollRequest } from './m8/equipment';
import type { EquipmentRoundRoll } from './m8/contracts';
import type { MatchState } from './match-types';
import type { ItemInstance } from './strategy-types';
import { nextRandom } from './rng';
import { canonicalContent } from './content';

type Context = Pick<MatchState,'augments'|'preparation'>;
type Selection = NonNullable<EquipmentRoundRoll['lucky']>;
const same = (a: unknown, b: unknown) => a === undefined || b === undefined ? a === b : canonicalContent(a) === canonicalContent(b);
const key = (r: Pick<EquipmentRoundRoll,'parentItemInstanceId'|'roundId'|'lucky'>) =>
  JSON.stringify([r.parentItemInstanceId,r.roundId,r.lucky?.choiceId,r.lucky?.holderId,r.lucky?.role,r.lucky?.radiant]);
const fail = (): never => { throw new RangeError('Invalid Lucky Gloves equipment authority'); };
const byApi = new Map(Object.values(ITEM_DEFINITIONS).map(d => [d.apiName,d.id]));

export function luckyGlovesSelection(state: Context, parent: ItemInstance): Selection | undefined {
  const owner = state.augments.find(a => Object.hasOwn(AUGMENT_BATCH5_G1,a.definitionId));
  if (!owner || parent.location.kind !== 'unit') return;
  const holderId = parent.location.unitId, unit = state.preparation.units.find(u => u.id === holderId);
  if (!unit || unit.team !== 'player' || !LUCKY_GLOVES_CHAMPION_ROLES[unit.definitionId]) return;
  const role = getUnitForm(unit,state.preparation.board) === 'ranged'
    ? LUCKY_GLOVES_RANGED_ROLES[unit.definitionId] ?? LUCKY_GLOVES_CHAMPION_ROLES[unit.definitionId]
    : LUCKY_GLOVES_CHAMPION_ROLES[unit.definitionId];
  return {choiceId:owner.choiceId,holderId,definitionId:unit.definitionId,role,radiant:parent.definitionId === 'TFT5_Item_ThiefsGlovesRadiant'};
}

/** Both draws are exact uniform rejection samples; eight recommendations, then the seven remaining items. */
export function selectLuckyGlovesPair(role: string, radiant: boolean, draw: () => number): readonly [string,string] {
  const pool = LUCKY_GLOVES_ROLE_ITEMS[role]?.map(api => byApi.get(api));
  if (!pool || pool.length !== 8 || pool.some(id => !id) || new Set(pool).size !== 8) return fail();
  const first = pool.splice(uniformIndex(pool.length,draw),1)[0]!;
  const second = pool[uniformIndex(pool.length,draw)]!;
  if (!radiant) return [first,second];
  const mapping: Readonly<Record<string,string>> = G23_RADIANT_MAPPING;
  if (!mapping[first] || !mapping[second]) return fail();
  return [mapping[first],mapping[second]];
}

/** Resolve a cached roll against the actual (possibly frozen) roster, never against a saved self-reported pool. */
export function equipmentRollFor(rolls: readonly EquipmentRoundRoll[], roundId: string, parent: ItemInstance, context: Context): EquipmentRoundRoll | undefined {
  const selection = luckyGlovesSelection(context,parent);
  return rolls.find(r => r.parentItemInstanceId === parent.id && r.roundId === roundId
    && (selection ? same(r.lucky,selection) : r.lucky === undefined));
}

/** Append-only: selecting the augment after an ordinary roll or changing holder/form cannot rewrite frozen combat inputs.
 * Re-equipping or returning to an already rolled form reuses that cache and consumes no further RNG. */
export function generateLuckyGlovesRolls(state: MatchState, requests: readonly RoundRollRequest[], pool: EquipmentPool): EquipmentState {
  validateLuckyGlovesEquipment(state,pool);
  const pending = requests.flatMap(request => {
    const parent = state.items.find(i => i.id === request.parentItemInstanceId)!;
    if (equipmentRollFor(state.equipmentState.rolls,request.roundId,parent,state)) return [];
    const lucky = luckyGlovesSelection(state,parent);
    return [{...request,...(lucky ? {lucky} : {})}];
  }).sort((a,b) => a.parentItemInstanceId < b.parentItemInstanceId ? -1 : a.parentItemInstanceId > b.parentItemInstanceId ? 1 : 0);
  if (!pending.length) return state.equipmentState;
  let rng = {...state.equipmentState.equipment};
  const draw = () => { const next = nextRandom(rng.state); rng = {state:next.state,draws:rng.draws+1}; return next.word; };
  const additions = pending.map(r => {
    const rngDrawStart = rng.draws;
    const children = r.lucky ? selectLuckyGlovesPair(r.lucky.role,r.lucky.radiant,draw) : selectTemporaryPair(r.playerLevel,pool,draw);
    return {parentItemInstanceId:r.parentItemInstanceId,roundId:r.roundId,playerLevelSnapshot:r.playerLevel,
      poolVersion:r.lucky ? 'lucky-gloves-v1' as const : pool.version, ...(r.lucky ? {lucky:r.lucky} : {}),
      children,rngDrawStart,rngDrawEnd:rng.draws};
  });
  return {equipment:rng,rolls:[...state.equipmentState.rolls,...additions]};
}

/** Independently replay all ordinary and lucky draws from the original equipment stream. Online roster facts and the
 * complete candidate are additionally authenticated by augment-history-v1's independent server authority. */
export function validateLuckyGlovesEquipment(state: Readonly<MatchState>, pool: EquipmentPool): void {
  let rng = initializeStreams(state.seed).equipment;
  const seen = new Set<string>();
  const draw = () => { const next = nextRandom(rng.state); rng = {state:next.state,draws:rng.draws+1}; return next.word; };
  for (const r of state.equipmentState.rolls) {
    if (!Number.isSafeInteger(r.playerLevelSnapshot) || r.playerLevelSnapshot < 1 || r.rngDrawStart !== rng.draws
      || !r.parentItemInstanceId || !r.roundId || seen.has(key(r))) fail();
    seen.add(key(r));
    if (r.lucky) {
      const s = r.lucky, owner = state.augments.find(a => a.choiceId === s.choiceId && Object.hasOwn(AUGMENT_BATCH5_G1,a.definitionId));
      if (r.poolVersion !== 'lucky-gloves-v1' || !owner || !s.holderId || typeof s.radiant !== 'boolean'
        || !same(Object.keys(s).sort(),['choiceId','definitionId','holderId','radiant','role'])
        || ![LUCKY_GLOVES_CHAMPION_ROLES[s.definitionId],LUCKY_GLOVES_RANGED_ROLES[s.definitionId]].filter(Boolean).includes(s.role)) fail();
    } else if (r.poolVersion !== pool.version) fail();
    const expected = r.lucky ? selectLuckyGlovesPair(r.lucky.role,r.lucky.radiant,draw) : selectTemporaryPair(r.playerLevelSnapshot,pool,draw);
    if (!same(r.children,expected) || r.rngDrawEnd !== rng.draws) fail();
  }
  if (!same(state.equipmentState.equipment,rng)) fail();
}
