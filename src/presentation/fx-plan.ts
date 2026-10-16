/**
 * The single read-only mapping from authoritative CombatEvents to visual feedback specs,
 * shared by the live board (combat-fx.ts) and the replay canvas (replay-view.ts).
 * Numeric floats (damage/shield/heal amounts) are owned by the DOM feedback renderer;
 * specs here are shapes and short labels only. Pure: no Phaser, DOM or clock.
 */
import type { HexCell } from '../simulation/board';
import type { ResolvedAbility } from '../simulation/ability-types';
import { asDisplayEvents, type DisplayCombat, type DisplayUnit, type SceneCombatEvent } from './combat-display';
import { ITEM_DEFINITIONS } from '../simulation/content/items';
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import { AUGMENT_DEFINITIONS } from '../simulation/content/augments';
import { augmentDisplayName } from './augment-display';
import { ANOMALY_DEFINITIONS } from '../simulation/content/anomalies';
import { displayUnitName } from '../rendering/display-names';
import { getHeroIdentity, traitDisplayName } from './hero-identity';
import { anomalyDisplayName, itemDisplayName } from './g23-display';
import { THEME, toNumber } from './theme';

const C = THEME.color;
const SOURCE_KIND: Readonly<Record<string, string>> = { ability: '技能', trait: '羁绊', item: '装备', augment: '强化', anomaly: '异常', enemyGrowth: '敌方成长' };
const sourceName = (kind: string, id: string) => {
  if (kind === 'augment' && AUGMENT_DEFINITIONS[id]) return augmentDisplayName(id);
  if (kind === 'item' && ITEM_DEFINITIONS[id]) return itemDisplayName(id);
  if (kind === 'trait' && TRAIT_DEFINITIONS[id]) return traitDisplayName(id);
  if (kind === 'anomaly' && ANOMALY_DEFINITIONS[id]) return anomalyDisplayName(id);
  const catalog = kind === 'item' ? ITEM_DEFINITIONS : kind === 'trait' ? TRAIT_DEFINITIONS : kind === 'augment' ? AUGMENT_DEFINITIONS : kind === 'anomaly' ? ANOMALY_DEFINITIONS : null;
  return (catalog?.[id] as { name?: string } | undefined)?.name ?? displayUnitName(id);
};

export type FxSpec =
  | { kind: 'slash'; at: HexCell; from: HexCell; color: number; duration: number }
  | { kind: 'bolt'; from: HexCell; to: HexCell; color: number; duration: number; travel: boolean }
  | { kind: 'cast'; at: HexCell; targets: readonly HexCell[]; color: number; duration: number; label: string }
  | { kind: 'ring'; at: HexCell; color: number; radius: number; duration: number }
  | { kind: 'death'; at: HexCell; duration: number }
  | { kind: 'label'; at: HexCell; text: string; dy: number; color: string; background: string; duration: number }
  | { kind: 'flash'; unitId: string }
  | { kind: 'target'; unitId: string; team: 'player' | 'enemy' };

/** Cast color and label: the engine ability when the local runtime is drawn, else the champion's identity (online view). */
function castLook(source: DisplayUnit): { color: number; label: string } {
  const ability = (source as DisplayUnit & { readonly ability?: ResolvedAbility }).ability;
  if (!ability) return { color: getHeroIdentity(source.definitionId).colorNumber, label: `施法 · ${displayUnitName(source.definitionId)}` };
  return {
    color: ability.kind === 's13' ? getHeroIdentity(ability.championId).colorNumber : ability.kind === 'selfShield' ? toNumber(C.shield) : ability.damageType === 'magic' ? 0xc5a0ff : 0xffc56e,
    label: ability.kind === 's13' ? `施法 · ${displayUnitName(ability.championId)}` : ability.kind === 'selfShield' ? '施法 · 护盾' : ability.damageType === 'magic' ? '施法 · 魔法' : '施法 · 物理',
  };
}

/**
 * Pure: same events + state + preference → same specs, for live, online replay and saved replay alike.
 * Accepts the local ledger or the §14.2 wire events (both read through the same display whitelist) and a
 * CombatViewState or engine CombatState; `unitUpdated` carries values, not animations, and draws nothing.
 */
export function planFx(events: readonly SceneCombatEvent[], combat: DisplayCombat, reduced: boolean): FxSpec[] {
  const specs: FxSpec[] = [];
  const flashed = new Set<string>();
  const unit = (id: string | null | undefined) => (id ? combat.units.find(value => value.id === id) : undefined);
  for (const event of asDisplayEvents(events)) {
    if (event.type === 'attack') {
      const source = unit(event.attackerId), target = unit(event.targetId);
      if (!source || !target) continue;
      const color = toNumber(source.team === 'player' ? C.ally : C.enemy);
      if (source.attackRange <= 1) specs.push({ kind: 'slash', at: target.cell, from: source.cell, color, duration: 200 });
      else specs.push({ kind: 'bolt', from: source.cell, to: target.cell, color, duration: reduced ? 160 : 220, travel: !reduced });
    } else if (event.type === 'cast') {
      const source = unit(event.sourceId);
      if (!source) continue;
      const { color, label } = castLook(source);
      const targets = event.targetIds.map(id => unit(id)).filter(target => target && target.id !== source.id).map(target => target!.cell);
      specs.push({ kind: 'cast', at: source.cell, targets, color, duration: 700, label });
    } else if (event.type === 'heal' && event.actual > 0) {
      const target = unit(event.targetId);
      if (target) specs.push({ kind: 'ring', at: target.cell, color: 0x7dff9e, radius: 31, duration: 450 });
    } else if (event.type === 'shieldLayerChanged' && event.reason === 'granted') {
      const target = unit(event.targetId);
      if (target) specs.push({ kind: 'ring', at: target.cell, color: toNumber(C.shield), radius: 33, duration: 450 });
    } else if (event.type === 'growth' || event.type === 'statusChanged') {
      const target = unit(event.type === 'growth' ? event.unitId : event.targetId);
      if (!target) continue;
      const text = event.type === 'growth' ? `成长 +${event.amountBps / 100}%` : `效果${event.reason === 'applied' ? '生效' : '结束'}`;
      specs.push({ kind: 'label', at: target.cell, text, dy: 46, color: C.shield, background: '#14212c', duration: 600 });
    } else if (event.type === 'targetChanged') {
      const target = unit(event.after);
      if (target) specs.push({ kind: 'target', unitId: target.id, team: target.team });
    } else if (event.type === 'packetDamage') {
      // replay2 has no per-tick aggregate: flash each hit unit once per batch.
      const id = event.targetId;
      if (!flashed.has(id)) { flashed.add(id); specs.push({ kind: 'flash', unitId: id }); }
    } else if (event.type === 'death') {
      const target = unit(event.unitId);
      if (target) specs.push({ kind: 'death', at: target.cell, duration: 600 });
    } else if (event.type === 'effectTriggered') {
      const owner = unit(event.ownerId);
      if (owner) specs.push({ kind: 'label', at: owner.cell, text: `${SOURCE_KIND[event.sourceKind] ?? '效果'} · ${sourceName(event.sourceKind, event.sourceDefinitionId)}`,
        dy: 46, color: '#ffe39b', background: '#1b2634', duration: 700 });
    }
  }
  return specs;
}
