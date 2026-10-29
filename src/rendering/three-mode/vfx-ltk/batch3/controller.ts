import type { Object3D } from 'three';
import type { BoardFrame } from '../../../board-feed';
import type { DisplayCombatEvent } from '../../../../presentation/combat-display';
import type { ModelLease } from '../../../../rendering3d';
import type { createLtkRuntime, VfxUnit } from '../runtime';
import { isBatch3 } from './index';
import { createSummonProxies } from './proxies';
import { SionAnimation } from './sion';
import type { ActionOutput } from '../../../../rendering3d/animation-state';
export interface Batch3Unit extends VfxUnit { definitionId: string; form: 'front' | 'back'; starLevel: number; team: string }
type Runtime = ReturnType<typeof createLtkRuntime>;
/** Effect keys are public nine-field tuples; use their source identity, never
 * interpret another caster's item/ally shield as this champion's ability. */
export function ownAbilityShield(key: string, target: string): boolean {
  try { const t: unknown = JSON.parse(key); return Array.isArray(t) && t.length === 9 && t[1] === target && t[2] === 'ability' && t[7] === target; }
  catch { return false; }
}
/** Only consumes published facts. Timers limit drawings; they never resolve gameplay. */
export function createBatch3Vfx(runtime: Runtime, scene: Object3D, find: (id: string) => Batch3Unit | undefined,
  options: { load?: (id: string) => Promise<ModelLease>; reduced?: () => boolean } = {}) {
  const proxies = createSummonProxies(scene, find, options.load);
  const loops = new Map<string, { owner: string; source: string; champion: string; variant: string; next: number }>();
  const shields = new Map<string, Set<string>>(), unbound = new Set<string>(), last = new Map<string, number>();
  const cohorts = new Map<string, { ids: string[]; index: number; castTick: number }[]>();
  const reviving = new Set<string>();
  const poses = new Map<string, SionAnimation>();
  const ended = new Map<string, number>();
  const sionPose = (id: string) => { let pose = poses.get(id); if (!pose) poses.set(id, pose = new SionAnimation()); return pose; };
  let clock = 0;
  const allowed = () => !options.reduced?.();
  const play = (id: string, variant: string, targets: readonly string[] = [], group?: string) => {
    const unit = find(id); return !!unit && allowed() && runtime.playVariant(unit.definitionId, variant, id, targets, group);
  };
  const stop = (key: string) => { runtime.stopGroup(key); loops.delete(key); };
  const loop = (id: string, variant: string) => {
    const unit = find(id); if (!unit || !allowed()) return;
    const key = `${id}:${variant}`; if (loops.has(key)) return;
    loops.set(key, { owner: id, source: id, champion: unit.definitionId, variant, next: clock });
  };
  const stopUnit = (id: string) => {
    for (const [key, held] of loops) if (held.owner === id) stop(key);
    shields.delete(id); last.delete(id); ended.delete(id); cohorts.delete(id); reviving.delete(id); proxies.stopUnit(id);
  };
  return {
    find: proxies.find,
    animation(id: string, output: ActionOutput): ActionOutput { return find(id)?.definitionId === 'g23-sion' ? sionPose(id).map(output, clock) : output; },
    cast(id: string, targets: readonly string[]): boolean | undefined {
      const unit = find(id); if (!unit || !isBatch3(unit.definitionId)) return undefined;
      if (unit.definitionId === 'elise' || unit.definitionId === 'swain') return play(id, `${unit.definitionId}-${unit.form}`, targets);
      // Rell's receipt starts with its own shield. Offensive hits use only the
      // actual enemy recipients, while the shield is driven independently below.
      const enemies = targets.filter(t => find(t)?.team !== unit.team && find(t)?.alive);
      if (unit.definitionId === 'rell') return enemies.length ? play(id, 'rell', enemies) : false;
      return play(id, unit.definitionId, targets);
    },
    event(event: DisplayCombatEvent, current: boolean) {
      if (event.type === 'death' || event.type === 'unitRemoved' || event.type === 'unitLeft') { stopUnit(event.unitId); return; }
      if (event.type === 'bindingChanged') {
        if (find(event.unitId)?.definitionId === 'g23-sion') sionPose(event.unitId).bind(event.bound, clock, current);
        if (event.bound) unbound.delete(event.unitId); else unbound.add(event.unitId);
        stop(`${event.unitId}:g23-sion-bound`);
        if (current && !event.bound) play(event.unitId, 'g23-sion-unbind');
      }
      if (event.type === 'unitRevived' && find(event.unitId)?.definitionId === 'g23-sion') { sionPose(event.unitId).revive(); if (current) reviving.add(event.unitId); }
      if (event.type === 'shieldLayerChanged') {
        const unit = find(event.targetId);
        if (unit && ['rell', 'loris', 'g23-sion'].includes(unit.definitionId) && ownAbilityShield(event.key, event.targetId)) {
          let keys = shields.get(event.targetId); if (!keys) shields.set(event.targetId, keys = new Set());
          if (event.remaining > 0 && ['granted', 'absorbed', 'decayed'].includes(event.reason)) keys.add(event.key); else keys.delete(event.key);
          if (keys.size && current) loop(event.targetId, `${unit.definitionId}-shield`);
          else if (!keys.size) stop(`${event.targetId}:${unit.definitionId}-shield`);
          if (unit.definitionId === 'loris' && event.reason === 'expired') ended.set(event.targetId, event.tick);
        }
      }
      if (event.type === 'cast') {
        const unit = find(event.sourceId); if (!unit || !isBatch3(unit.definitionId)) return;
        if (current && allowed()) {
          if (unit.definitionId === 'swain' && unit.form === 'front') { loop(event.sourceId, 'swain-ascension'); last.set(event.sourceId, clock); }
          if (unit.definitionId === 'illaoi') loop(event.sourceId, 'illaoi-channel');
          if (unit.definitionId === 'silco') {
            const ids = proxies.spawn(event.sourceId, 'v20-silco-minion', unit.starLevel >= 3 ? 8 : 4, 12, event.targetIds[0]);
            // A cohort shares its spawn/buff accent. Four permanent systems per
            // caster would exhaust the unchanged six-system renderer budget.
            if (ids[0]) loops.set(`${ids[0]}:silco-minion`, { owner: event.sourceId, source: ids[0], champion: 'silco', variant: 'silco-minion', next: clock });
            const groups = cohorts.get(event.sourceId) ?? []; groups.push({ ids, index: 0, castTick: event.tick }); cohorts.set(event.sourceId, groups);
          }
          if (unit.definitionId === 'elise' && unit.form === 'back')
            for (const target of [...new Set(event.targetIds)].slice(0, 8)) for (const id of proxies.spawn(event.sourceId, 'vfx-elise-spider', 1, .6, target))
              runtime.playVariant('elise', 'elise-spider', id);
        }
      }
      if (event.type === 'heal') for (const share of event.shares) if (share.sourceId === event.targetId && find(share.sourceId)?.definitionId === 'swain') last.set(share.sourceId, clock);
      if (event.type === 'packetDamage' && current) {
        const source = find(event.sourceId); if (!source || !allowed()) return;
        if (source.definitionId === 'illaoi') {
          if (event.damageType === 'true' && loops.has(`${event.sourceId}:illaoi-channel`)) play(event.sourceId, 'illaoi-drain', [event.targetId]);
          else if (event.damageType === 'magic' && ended.get(event.sourceId) === event.tick) play(event.sourceId, 'illaoi-slam', [event.targetId]);
        }
        if (source.definitionId === 'swain' && source.form === 'front' && event.damageType === 'magic') {
          last.set(event.sourceId, clock); play(event.sourceId, 'swain-pulse', [event.targetId]);
        }
        if (source.definitionId === 'loris' && event.damageType === 'magic' && ended.get(event.sourceId) === event.tick) play(event.sourceId, 'loris-retaliation', [event.targetId]);
        if (source.definitionId === 'silco' && event.damageType === 'magic') {
          const held = cohorts.get(event.sourceId)?.find(c => c.castTick < event.tick && c.ids.some(id => proxies.find(id)));
          if (held?.ids.length) { const id = held.ids[held.index++ % held.ids.length]; proxies.attack(id, event.targetId); }
        }
      }
      if (event.type === 'statusChanged' && event.kind === 'damage-reduction' && !['applied', 'refreshed'].includes(event.reason) && find(event.targetId)?.definitionId === 'illaoi') {
        ended.set(event.targetId, event.tick); stop(`${event.targetId}:illaoi-channel`);
      }
    },
    frame(frame: BoardFrame) {
      if (!frame.fighting) return;
      for (const piece of frame.pieces) {
        if (!piece.alive || !piece.visible) { stopUnit(piece.id); continue; }
        if (piece.definitionId === 'g23-sion' && !unbound.has(piece.id)) loop(piece.id, 'g23-sion-bound');
        if (shields.get(piece.id)?.size) loop(piece.id, `${piece.definitionId}-shield`);
        if (reviving.has(piece.id) && play(piece.id, 'g23-sion-revive')) reviving.delete(piece.id);
        if (piece.meters?.shield === 0 && ['rell', 'loris', 'g23-sion'].includes(piece.definitionId)) { shields.delete(piece.id); stop(`${piece.id}:${piece.definitionId}-shield`); }
      }
      for (const held of loops.values()) if (!frame.pieces.some(p => p.id === held.owner && p.alive && p.visible)) stopUnit(held.owner);
    },
    update(seconds: number) {
      if (!Number.isFinite(seconds) || seconds < 0) return; clock += seconds;
      if (!allowed()) proxies.clear(); else proxies.update(seconds);
      for (const [key, held] of loops) {
        if (!allowed() || !find(held.owner)?.alive || (held.source !== held.owner && !proxies.find(held.source))) { stop(key); continue; }
        // The public replay omits Swain's ascension deadline. Actual drain/heal
        // pulses keep it alive, including takedown extensions, with a short tail.
        if (held.variant === 'swain-ascension' && clock - (last.get(held.owner) ?? -Infinity) > 1.25) { stop(key); continue; }
        if (clock >= held.next) {
          if (runtime.playVariant(held.champion, held.variant, held.source, [], key)) held.next = clock + 9;
          else held.next = clock + .2;
        }
      }
    },
    clear() { for (const key of loops.keys()) stop(key); proxies.clear(); shields.clear(); unbound.clear(); last.clear(); ended.clear(); cohorts.clear(); reviving.clear(); poses.clear(); },
    get proxyCount() { return proxies.count; },
  };
}
export function batch3ModelId(id: string, form: 'front' | 'back'): string { return id === 'elise' && form === 'front' ? 'vfx-elise-front' : id; }
