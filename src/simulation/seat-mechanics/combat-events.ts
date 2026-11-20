import { occupiesCell } from '../anomalies/availability';
import { contains, sameCell, type HexCell, type Team } from '../board';
import type { CombatEvent, CombatOrigin, CombatState, CombatUnit } from '../combat-types';
export interface SevikaCastVariant {
  readonly actionSeq:number;
  readonly move:'flamethrower'|'punch'|'chomp'|'jackpot';
  readonly channelTicks:number;
  /** High Roller's empowered roll, independent of augment ownership. */
  readonly enhanced:boolean;
  /** Applicable champion-specific augment IDs frozen by rules; empty when none are implemented. */
  readonly heroAugmentIds:readonly string[];
}

/**
 * G2-3 combat ledger events (MATCH_CONTRACT「G2-3 机制通用接口」). They join CombatEventData and M8CombatEvent; the engine stamps them
 * like any other event. unitSpawned/unitRemoved must accompany every change of CombatState.units membership.
 */
export type G23CombatEventData =
  /** A unit entered combat after tick 0 (Gangplank barrel, Silco monster, anomaly summons). source.ownerId = summoner. */
  | { readonly type: 'unitSpawned'; readonly tick: number; readonly unitId: string; readonly definitionId: string; readonly team: Team; readonly cell: HexCell; readonly source: CombatOrigin }
  /** A unit left CombatState.units (barrel detonated, summon expired). Death of an ordinary unit stays 'death'. */
  | { readonly type: 'unitRemoved'; readonly tick: number; readonly unitId: string; readonly reason: string }
  /** One rolled ability result, e.g. High Roller: outcome 'rocket' | 'shield' | 'gold' | 'triple', subOutcomes for triple. */
  | { readonly type: 'castOutcome'; readonly tick: number; readonly unitId: string; readonly abilityKey: string; readonly outcome: string; readonly subOutcomes: readonly string[]; readonly castVariant?:SevikaCastVariant }
  /** Sion bound (true) / broke free (false); reason e.g. 'combat-start' | 'casts' | 'hp-threshold'. */
  | { readonly type: 'bindingChanged'; readonly tick: number; readonly unitId: string; readonly bound: boolean; readonly reason: string }
  /** G2-4b Unstable Treasure Chest: unitId gained a temporary pool item for the rest of this combat. source = the chest's death trigger. */
  | { readonly type: 'combatItemGranted'; readonly tick: number; readonly unitId: string; readonly definitionId: string; readonly source: CombatOrigin }
  /**
   * Display only, no rule effect: a marker of an ability's moment for the renderer. 'powder-monkey-sent': Powder's monkey
   * sets off for its landing cell (cell), arriving at arrivalTick; 'powder-monkey-arrived': it reached that cell and explodes.
   */
  | { readonly type: 'abilityMarker'; readonly tick: number; readonly unitId: string; readonly marker: 'powder-monkey-sent' | 'powder-monkey-arrived'; readonly cell: HexCell; readonly arrivalTick: number }
  /**
   * Display only, no rule effect: holderId lifts targetId (carried true) or puts it down (carried false), for the renderer's
   * carry. Renni: lifted on her cast, put down when her stun's last pulse lands (a death of either ends it too: the renderer
   * also ends a carry on either one's death event).
   */
  | { readonly type: 'carryChanged'; readonly tick: number; readonly holderId: string; readonly targetId: string; readonly carried: boolean }
  /**
   * Display only, no rule effect (ranged attack landing): a ranged hero's attack sends a shot at targetId, landing on
   * arrivalTick; projectile 'flight' flies there, 'beam' is an instant beam (arrivalTick is the attack tick).
   */
  | { readonly type: 'attackLaunched'; readonly tick: number; readonly attackerId: string; readonly targetId: string; readonly arrivalTick: number; readonly projectile: 'flight' | 'beam' }
  /** Display only, no rule effect: a flying shot reached targetId; hit false when the target died in flight (the shot did nothing). */
  | { readonly type: 'attackLanded'; readonly tick: number; readonly attackerId: string; readonly targetId: string; readonly hit: boolean }
  /**
   * Display only, no rule effect (landing batch, 11-20): one projectile of a skill (skill names it; ordinal of count in the
   * cast actionSeq) leaves sourceId for targetId on this tick and lands on arrivalTick, where its effect settles.
   */
  | { readonly type: 'abilityProjectileLaunched'; readonly tick: number; readonly sourceId: string; readonly targetId: string; readonly arrivalTick: number; readonly skill: import('../ability-projectile').AbilityProjectileSkill; readonly ordinal: number; readonly actionSeq: number; readonly count: number }
  /** Display only, no rule effect: that projectile reached targetId; hit false when the target died in flight (nothing settles, no retarget). Comes before its damage. */
  | { readonly type: 'abilityProjectileLanded'; readonly tick: number; readonly sourceId: string; readonly targetId: string; readonly skill: import('../ability-projectile').AbilityProjectileSkill; readonly ordinal: number; readonly actionSeq: number; readonly count: number; readonly hit: boolean }
  /**
   * Display only, no rule effect: a timed ability effect of unitId is over, so the renderer can end its visuals.
   * 'leblanc-chain': the chain's duration ran out (targetIds = the chained units); 'twitch-volley': the empowered attacks are used up;
   * 'drmundo-heal': the ability's heal over time paid its last part; 'vander-brace': the cast's brace (its channel) ended;
   * 'swain-ascension': the demon form ran out (takedown extensions included).
   */
  | { readonly type: 'abilityEffectEnded'; readonly tick: number; readonly unitId: string; readonly effect: 'leblanc-chain' | 'twitch-volley' | 'drmundo-heal' | 'vander-brace' | 'swain-ascension'; readonly targetIds: readonly string[] };

export interface CombatMembershipChange { readonly state: CombatState; readonly events: readonly CombatEvent[] }

/**
 * Appends a fully built unit (stats, ability, mechanics already resolved by the rule side) at the end of state.units and
 * returns its unitSpawned event for the current step's event list. The replay keeps state.units order, so always append.
 * Throws on a duplicate id or an occupied/out-of-board cell; never moves another unit.
 */
export function spawnCombatUnit(state: CombatState, unit: CombatUnit, source: CombatOrigin, tick: number): CombatMembershipChange {
  if (state.units.some(other => other.id === unit.id)||state.removedUnitIds?.includes(unit.id)) throw new RangeError(`Duplicate combat unit ${unit.id}`);
  if (!contains(state.board, unit.cell) || state.units.some(other => occupiesCell(other, tick) && sameCell(other.cell, unit.cell)))
    throw new RangeError(`Spawn cell unavailable for ${unit.id}`);
  return { state: { ...state, units: [...state.units, unit] }, events: [{ type: 'unitSpawned', tick, unitId: unit.id,
    definitionId: unit.definitionId, team: unit.team, cell: { col: unit.cell.col, row: unit.cell.row }, source: { ...source } }] };
}

/** Removes a unit from state.units and clears other units' targetId pointing at it. */
export function removeCombatUnit(state: CombatState, unitId: string, reason: string, tick: number): CombatMembershipChange {
  if (!state.units.some(unit => unit.id === unitId)) throw new RangeError(`Unknown combat unit ${unitId}`);
  const units = state.units.filter(unit => unit.id !== unitId).map(unit => {
    if (unit.targetId !== unitId) return unit;
    const copy = { ...unit, targetId: null }; delete copy.targetEngaged; delete copy.meleeApproach; return copy;
  });
  return { state: { ...state, units,removedUnitIds:[...state.removedUnitIds??[],unitId] }, events: [{ type: 'unitRemoved', tick, unitId, reason }] };
}

export function castOutcomeEvent(tick: number, unitId: string, abilityKey: string, outcome: string, subOutcomes: readonly string[] = []): CombatEvent {
  return { type: 'castOutcome', tick, unitId, abilityKey, outcome, subOutcomes: [...subOutcomes] };
}
export function bindingChangedEvent(tick: number, unitId: string, bound: boolean, reason: string): CombatEvent {
  return { type: 'bindingChanged', tick, unitId, bound, reason };
}
