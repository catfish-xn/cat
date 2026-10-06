/**
 * The single read-only mapping from authoritative CombatEvents to visual feedback specs,
 * shared by the live board (combat-fx.ts) and the replay canvas (replay-view.ts).
 * Numeric floats (damage/shield/heal amounts) are owned by the DOM feedback renderer;
 * specs here are shapes and short labels only. Pure: no Phaser, DOM or clock.
 */
import type { CombatEvent, CombatState } from '../simulation/combat-types';
import type { HexCell } from '../simulation/board';
import { ITEM_DEFINITIONS } from '../simulation/content/items';
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import { AUGMENT_DEFINITIONS } from '../simulation/content/augments';
import { ANOMALY_DEFINITIONS } from '../simulation/content/anomalies';
import { displayUnitName } from '../rendering/display-names';
import { getHeroIdentity } from './hero-identity';
import { THEME, toNumber } from './theme';

const C = THEME.color;
const SOURCE_KIND: Readonly<Record<string, string>> = { ability: '技能', trait: '羁绊', item: '装备', augment: '强化', anomaly: '异常', enemyGrowth: '敌方成长' };
const sourceName = (kind: string, id: string) => {
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

/** Pure: same events + state + preference → same specs, for live and replay alike. */
export function planFx(events: readonly CombatEvent[], combat: CombatState, reduced: boolean): FxSpec[] {
  const specs: FxSpec[] = [];
  const unit = (id: string | null | undefined) => (id ? combat.units.find(value => value.id === id) : undefined);
  for (const event of events) {
    if (event.type === 'attack') {
      const source = unit(event.attackerId), target = unit(event.targetId);
      if (!source || !target) continue;
      const color = toNumber(source.team === 'player' ? C.ally : C.enemy);
      if (source.attackRange <= 1) specs.push({ kind: 'slash', at: target.cell, from: source.cell, color, duration: 200 });
      else specs.push({ kind: 'bolt', from: source.cell, to: target.cell, color, duration: reduced ? 160 : 220, travel: !reduced });
    } else if (event.type === 'cast') {
      const source = unit(event.sourceId);
      if (!source) continue;
      const ability = source.ability;
      const color = ability.kind === 's13' ? getHeroIdentity(ability.championId).colorNumber : ability.kind === 'selfShield' ? toNumber(C.shield) : ability.damageType === 'magic' ? 0xc5a0ff : 0xffc56e;
      const targets = event.targetIds.map(id => unit(id)).filter(target => target && target.id !== source.id).map(target => target!.cell);
      const label = ability.kind === 's13' ? `施法 · ${displayUnitName(ability.championId)}` : ability.kind === 'selfShield' ? '施法 · 护盾' : ability.damageType === 'magic' ? '施法 · 魔法' : '施法 · 物理';
      specs.push({ kind: 'cast', at: source.cell, targets, color, duration: 700, label });
    } else if (event.type === 'heal' && event.actual > 0) {
      const target = unit(event.unitId);
      if (target) specs.push({ kind: 'ring', at: target.cell, color: 0x7dff9e, radius: 31, duration: 450 });
    } else if (event.type === 'shieldLayerChanged' && event.reason === 'granted') {
      const target = unit(event.unitId);
      if (target) specs.push({ kind: 'ring', at: target.cell, color: toNumber(C.shield), radius: 33, duration: 450 });
    } else if (event.type === 'growth' || event.type === 'statusChanged') {
      const target = unit(event.unitId);
      if (!target) continue;
      const text = event.type === 'growth' ? `成长 +${event.amountBps / 100}%` : `效果${event.reason === 'applied' ? '生效' : '结束'}`;
      specs.push({ kind: 'label', at: target.cell, text, dy: -32, color: C.shield, background: '#14212c', duration: 600 });
    } else if (event.type === 'targetChanged') {
      const target = unit(event.after);
      if (target) specs.push({ kind: 'target', unitId: target.id, team: target.team });
    } else if (event.type === 'damage') {
      specs.push({ kind: 'flash', unitId: event.unitId });
    } else if (event.type === 'death') {
      const target = unit(event.unitId);
      if (target) specs.push({ kind: 'death', at: target.cell, duration: 600 });
    } else if (event.type === 'effectTriggered') {
      const owner = unit(event.source.ownerId);
      if (owner) specs.push({ kind: 'label', at: owner.cell, text: `${SOURCE_KIND[event.source.sourceKind] ?? '效果'} · ${sourceName(event.source.sourceKind, event.source.sourceDefinitionId)}`,
        dy: 46, color: '#ffe39b', background: '#1b2634', duration: 700 });
    }
  }
  return specs;
}
