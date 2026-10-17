/** G2-4b Unstable Treasure Chest pool (user 2026-10-17, option A "完整原版"): the 35 ordinary completed items except
 * Thief's Gloves, in apiName order. Each entry is the item compiled into a mid-combat payload: its strategy-boundary stats
 * become program modifiers, health and starting mana are applied once when the item is gained, and the legacy mechanic
 * tags are rewritten into the equivalent declarative programs (G24-CHEST-04). Conventions: docs/evidence/g2-4/SUPPORT_ITEMS.md. */
import type { Effect } from '../strategy-types';
import type { ItemProgram } from '../m8/item-program';
import type { Effect as ProgramEffect, StatModifier } from '../m8/contracts';
import { ITEM_DEFINITIONS } from './items';
import { amount, modifier, periodic, trigger } from './item-programs';
import { freezeContent } from './freeze';

export interface G24CombatItemPayload {
  readonly definitionId: string;
  /** Strategy maxHp effects, applied to the receiver's health basis when the item is gained. */
  readonly maxHpFlat: number; readonly maxHpBps: number;
  /** Strategy starting mana, granted once when the item is gained (G24-CHEST-03). */
  readonly initialMana: number;
  readonly program: ItemProgram;
}

/** Stacking program growth must leave the add-stacks runtime fast path (cap null) that legacy mechanics own. */
const STACK_CAP = 100000;
const growth = (stat: StatModifier['stat'], n: number, unit: StatModifier['unit']): ProgramEffect =>
  ({ kind: 'modify-stat', modifier: modifier(stat, n, unit), activation: 'immediate', duration: { kind: 'combat' }, stackPolicy: { kind: 'add-stacks', cap: STACK_CAP } });

function payload(id: string): G24CombatItemPayload {
  const item = ITEM_DEFINITIONS[id], base = item.combatProgram ?? {};
  const modifiers: StatModifier[] = [], triggers = [...base.triggers ?? []], periodics = [...base.periodic ?? []], vamps = [...base.vamp ?? []];
  let maxHpFlat = 0, maxHpBps = 0, initialMana = 0;
  for (const effect of item.effects as readonly Effect[]) {
    if (effect.kind === 'statFlat' && effect.stat === 'maxHp') maxHpFlat += effect.amount;
    else if (effect.kind === 'statPercentBps' && effect.stat === 'maxHp') maxHpBps += effect.bps;
    else if (effect.kind === 'statFlat' && effect.stat === 'initialMana') initialMana += effect.amount;
    else if (effect.kind === 'statFlat' && (effect.stat === 'abilityPower' || effect.stat === 'armor' || effect.stat === 'magicResist' || effect.stat === 'attackDamage')) modifiers.push(modifier(effect.stat, effect.amount));
    else if (effect.kind === 'statPercentBps' && effect.stat === 'attackDamage') modifiers.push(modifier('attackDamage', effect.bps, 'bps'));
    else if (effect.kind === 'attackSpeedBps') modifiers.push(modifier('attackSpeed', effect.bps, 'bps'));
    else if (effect.kind === 'mechanic') {
      const v = effect.values;
      // G24-CHEST-04: the same declarations compileMechanismDefinitions builds from these tags at combat start.
      switch (effect.mechanic) {
        case 'rageblade': triggers.push(trigger({ id: 'rageblade', event: 'attack-completed', stackPolicy: { kind: 'add-stacks', cap: STACK_CAP }, effects: [growth('attackSpeed', v.attackSpeedBps, 'bps')] })); break;
        case 'damageAmp': modifiers.push(modifier('damageAmp', v.bps, 'bps')); break;
        case 'extraAttackMana': triggers.push(trigger({ id: 'shojin', event: 'attack-completed', effects: [{ kind: 'grant-mana', amount: v.amount, reason: 'attack', bypassLock: 'none' }] })); break;
        case 'archangel': periodics.push(periodic(v.periodTicks, [growth('abilityPower', v.abilityPower, 'flat')])); break;
        case 'dragonClaw': periodics.push(periodic(v.periodTicks, [{ kind: 'heal', amount: amount({ maxHpBps: v.healMaxHpBps, sample: 'each-pulse' }) }])); break;
        case 'gargoyle': for (const stat of ['armor', 'magicResist'] as const) modifiers.push({ ...modifier(stat, 0), value: { kind: 'unit-count', perUnit: v.resistPerEnemy, population: 'alive-enemies-targeting-holder', sample: 'current', distinctBy: 'unitId' } }); break;
        case 'gunblade': vamps.push({ modifier: modifier('omnivamp', v.selfHealBps, 'bps'), allyBps: v.allyHealBps, allyCondition: { kind: 'always' } }); break;
        default: throw new RangeError(`Unconverted chest pool mechanic ${effect.mechanic}`);
      }
    } else throw new RangeError(`Unconverted chest pool effect ${effect.kind}`);
  }
  const effects = (base.effects ?? []).filter(e => e.kind !== 'temporary-equipment');
  const program: ItemProgram = { ...(modifiers.length || base.modifiers ? { modifiers: [...modifiers, ...base.modifiers ?? []] } : {}), ...(effects.length ? { effects } : {}),
    ...(triggers.length ? { triggers } : {}), ...(base.survival ? { survival: base.survival } : {}), ...(periodics.length ? { periodic: periodics } : {}), ...(vamps.length ? { vamp: vamps } : {}) };
  return { definitionId: id, maxHpFlat, maxHpBps, initialMana, program };
}

/** G24-CHEST-01: ordinary completed items, Thief's Gloves excluded (its round-roll children cannot exist mid-combat). Only the
 * base catalogue (content/items.ts) is read: G2-3 special items, support items and artifacts live in the extended registry
 * and never enter the pool. A completed item added to the base catalogue changes the pool and the content digest. */
export const G24_CHEST_POOL: readonly G24CombatItemPayload[] = freezeContent(Object.values(ITEM_DEFINITIONS)
  .filter(item => item.kind === 'completed' && item.id !== 'thiefs-gloves')
  .sort((a, b) => a.apiName! < b.apiName! ? -1 : a.apiName! > b.apiName! ? 1 : 0).map(item => payload(item.id)));
export const G24_CHEST_PAYLOADS: Readonly<Record<string, G24CombatItemPayload>> = freezeContent(Object.fromEntries(G24_CHEST_POOL.map(p => [p.definitionId, p])));
