/**
 * The single read-only mapping from authoritative CombatEvents to visual feedback specs,
 * shared by the live board (combat-fx.ts) and the replay canvas (replay-view.ts).
 * Numeric floats (damage/shield/heal amounts) are owned by the DOM feedback renderer;
 * specs here are shapes and short labels only. Pure: no Phaser, DOM or clock.
 * I3 (14.24 look): casts, effect triggers, growth and status changes draw no text; current statuses are icons on
 * the piece (status-icons.ts). Only the revive keeps a label.
 */
import type { HexCell } from '../simulation/board';
import type { ResolvedAbility } from '../simulation/ability-types';
import { asDisplayEvents, type DisplayCombat, type DisplayUnit, type SceneCombatEvent } from './combat-display';
import { displayUnitName } from '../rendering/display-names';
import { getHeroIdentity } from './hero-identity';
import { THEME, toNumber } from './theme';

const C = THEME.color;

export type FxSpec =
  | { kind: 'slash'; at: HexCell; from: HexCell; color: number; duration: number; sourceId: string }
  | { kind: 'bolt'; from: HexCell; to: HexCell; color: number; duration: number; travel: boolean; sourceId: string }
  /** `label` names the cast for debug/acceptance reads; the board draws only the rings. */
  | { kind: 'cast'; at: HexCell; targets: readonly HexCell[]; color: number; duration: number; label: string }
  | { kind: 'ring'; at: HexCell; color: number; radius: number; duration: number }
  | { kind: 'death'; at: HexCell; duration: number; unitId: string }
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
      if (source.attackRange <= 1) specs.push({ kind: 'slash', at: target.cell, from: source.cell, color, duration: 200, sourceId: source.id });
      else specs.push({ kind: 'bolt', from: source.cell, to: target.cell, color, duration: reduced ? 160 : 220, travel: !reduced, sourceId: source.id });
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
    } else if (event.type === 'growth') {
      const target = unit(event.unitId);
      if (target) specs.push({ kind: 'ring', at: target.cell, color: 0xffe39b, radius: 30, duration: 450 });
    } else if (event.type === 'targetChanged') {
      const target = unit(event.after);
      if (target) specs.push({ kind: 'target', unitId: target.id, team: target.team });
    } else if (event.type === 'packetDamage') {
      // replay2 has no per-tick aggregate: flash each hit unit once per batch.
      const id = event.targetId;
      if (!flashed.has(id)) { flashed.add(id); specs.push({ kind: 'flash', unitId: id }); }
    } else if (event.type === 'death') {
      const target = unit(event.unitId);
      if (target) specs.push({ kind: 'death', at: target.cell, duration: 600, unitId: target.id });
    } else if (event.type === 'unitRevived') {
      // The unit returns in place (same id); its token reappears from the end-of-tick alive flag.
      const target = unit(event.unitId);
      if (!target) continue;
      specs.push({ kind: 'ring', at: target.cell, color: 0xffd56e, radius: 34, duration: 700 });
      specs.push({ kind: 'label', at: target.cell, text: `复活 · 生命 ${event.hp}`, dy: 46, color: '#fff2c4', background: '#3a2c10', duration: 900 });
    }
  }
  return specs;
}
