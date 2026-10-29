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
/** Public combat tick, used only to see whether a caught-up drawing is still inside its display life. */
const TICK_SECONDS = 0.05;
const SWAIN_TAIL_SECONDS = 1.25;
/** Effect keys are public nine-field tuples; use their source identity, never
 * interpret another caster's item/ally shield as this champion's ability. */
export function ownAbilityShield(key: string, target: string): boolean {
  try { const t: unknown = JSON.parse(key); return Array.isArray(t) && t.length === 9 && t[1] === target && t[2] === 'ability' && t[7] === target; }
  catch { return false; }
}
/** Equipment procs are not this batch's ability phase. A replay that omits
 * sourceKind, definitionId and delivery is not ability damage. */
export function isAbilityPacket(event: { sourceKind?: unknown; definitionId?: unknown; delivery?: unknown }): boolean {
  const sourceKind = typeof event.sourceKind === 'string' ? event.sourceKind : undefined;
  const definitionId = typeof event.definitionId === 'string' ? event.definitionId : undefined;
  const delivery = typeof event.delivery === 'string' ? event.delivery : undefined;
  if (sourceKind === undefined && definitionId === undefined && delivery === undefined) return false;
  if (sourceKind === 'item' || delivery === 'equipment-proc' || delivery === 'item-burn') return false;
  if (sourceKind !== 'ability') return false;
  if (delivery !== 'ability-direct' && delivery !== 'ability-periodic') return false;
  if (definitionId !== undefined && definitionId.length === 0) return false;
  return true;
}
function packetOrigin(event: DisplayCombatEvent): { sourceKind?: string; definitionId?: string; delivery?: string } {
  if (event.type !== 'packetDamage') return {};
  const tagged = event as { sourceKind?: unknown; definitionId?: unknown; delivery?: unknown };
  return {
    sourceKind: typeof tagged.sourceKind === 'string' ? tagged.sourceKind : undefined,
    definitionId: typeof tagged.definitionId === 'string' ? tagged.definitionId : undefined,
    delivery: typeof tagged.delivery === 'string' ? tagged.delivery : undefined,
  };
}
interface PendingSummon {
  key: string; owner: string; tick: number; duration: number; presented: boolean;
  ids: string[]; groups: string[];
  run: (remaining: number) => { ids: string[]; groups: string[] };
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
  const summons = new Map<string, PendingSummon>();
  const ascension = new Map<string, { lastTick: number }>();
  const channels = new Set<string>();
  let clock = 0, latestTick = 0;
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
  const dropSummon = (rec: PendingSummon) => {
    proxies.drop(rec.ids);
    for (const group of rec.groups) stop(group);
    summons.delete(rec.key);
  };
  const stopUnit = (id: string) => {
    for (const rec of [...summons.values()]) if (rec.owner === id) dropSummon(rec);
    for (const [key, held] of loops) if (held.owner === id) stop(key);
    shields.delete(id); last.delete(id); ended.delete(id); cohorts.delete(id); reviving.delete(id);
    ascension.delete(id); channels.delete(id); proxies.stopUnit(id);
  };
  const sionPose = (id: string) => { let pose = poses.get(id); if (!pose) poses.set(id, pose = new SionAnimation()); return pose; };
  /** Persistent drawings wait out a catch-up batch. `skip` holds a summon armed by the
   * event being applied, so a non-current cast is not shown before the batch's latest tick is known. */
  const settle = (skip: ReadonlySet<string>) => {
    for (const rec of [...summons.values()]) {
      if (skip.has(rec.key)) continue;
      const age = Math.max(0, (latestTick - rec.tick) * TICK_SECONDS);
      if (age >= rec.duration) { dropSummon(rec); continue; }
      if (rec.presented || !allowed()) continue;
      rec.presented = true;
      const spawned = rec.run(rec.duration - age);
      rec.ids = spawned.ids; rec.groups = spawned.groups;
    }
    for (const [id, held] of [...ascension]) {
      const age = Math.max(0, (latestTick - held.lastTick) * TICK_SECONDS);
      const key = `${id}:swain-ascension`;
      if (age > SWAIN_TAIL_SECONDS) {
        if (loops.has(key)) stop(key);
        ascension.delete(id); last.delete(id); continue;
      }
      if (!loops.has(key)) {
        loop(id, 'swain-ascension');
        if (loops.has(key)) last.set(id, clock - age);
      }
    }
    for (const id of channels) if (!loops.has(`${id}:illaoi-channel`)) loop(id, 'illaoi-channel');
  };
  const noteTick = (tick: unknown) => { if (typeof tick === 'number' && tick > latestTick) latestTick = tick; };
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
      noteTick('tick' in event ? event.tick : undefined);
      if (event.type === 'cast') {
        const unit = find(event.sourceId);
        if (unit?.definitionId === 'swain' && unit.form === 'front') {
          const tick = typeof event.tick === 'number' ? event.tick : latestTick;
          const held = ascension.get(event.sourceId) ?? { lastTick: tick };
          held.lastTick = tick; ascension.set(event.sourceId, held);
        }
      } else if (event.type === 'heal') {
        for (const share of event.shares) {
          if (share.sourceId !== event.targetId || find(share.sourceId)?.definitionId !== 'swain' || !ascension.has(share.sourceId)) continue;
          const held = ascension.get(share.sourceId)!;
          if (typeof event.tick === 'number') held.lastTick = event.tick;
          if (loops.has(`${share.sourceId}:swain-ascension`)) last.set(share.sourceId, clock);
        }
      } else if (event.type === 'packetDamage') {
        const source = find(event.sourceId);
        if (source?.definitionId === 'swain' && source.form === 'front' && event.damageType === 'magic'
          && isAbilityPacket(packetOrigin(event)) && ascension.has(event.sourceId)) {
          const held = ascension.get(event.sourceId)!;
          if (typeof event.tick === 'number') held.lastTick = event.tick;
          if (loops.has(`${event.sourceId}:swain-ascension`)) last.set(event.sourceId, clock);
        }
      }
      // Facts first, then release summons armed by earlier catch-up events. A cast in
      // this event is settled afterwards so its latest tick is the one just recorded.
      settle(new Set());
      const fresh = new Set<string>();
      const handle = () => {
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
          if (unit.definitionId === 'illaoi') channels.add(event.sourceId);
          if (unit.definitionId === 'silco') {
            const key = `${event.sourceId}:${event.tick}:${event.actionSeq ?? 0}:silco`;
            if (!summons.has(key)) {
              if (!current) fresh.add(key);
              const count = unit.starLevel >= 3 ? 8 : 4, target = event.targetIds[0], owner = event.sourceId, castTick = event.tick;
              summons.set(key, { key, owner, tick: castTick, duration: 12, presented: false, ids: [], groups: [], run: remaining => {
                const ids = proxies.spawn(owner, 'v20-silco-minion', count, remaining, target);
                const groups: string[] = [];
                if (ids[0]) {
                  const group = `${ids[0]}:silco-minion`;
                  loops.set(group, { owner, source: ids[0], champion: 'silco', variant: 'silco-minion', next: clock });
                  groups.push(group);
                }
                const held = cohorts.get(owner) ?? []; held.push({ ids, index: 0, castTick }); cohorts.set(owner, held);
                return { ids, groups };
              } });
            }
          }
          if (unit.definitionId === 'elise' && unit.form === 'back') {
            const key = `${event.sourceId}:${event.tick}:${event.actionSeq ?? 0}:elise`;
            if (!summons.has(key)) {
              if (!current) fresh.add(key);
              const targets = [...new Set(event.targetIds)].slice(0, 8), owner = event.sourceId;
              summons.set(key, { key, owner, tick: event.tick, duration: 0.6, presented: false, ids: [], groups: [], run: remaining => {
                const ids: string[] = [], groups: string[] = [];
                for (const target of targets) for (const id of proxies.spawn(owner, 'vfx-elise-spider', 1, remaining, target)) {
                  const group = `${id}:elise-spider`;
                  runtime.playVariant('elise', 'elise-spider', id, [], group);
                  ids.push(id); groups.push(group);
                }
                return { ids, groups };
              } });
            }
          }
        }
        if (event.type === 'packetDamage' && current) {
          const source = find(event.sourceId); if (!source || !allowed()) return;
          const ability = isAbilityPacket(packetOrigin(event));
          if (source.definitionId === 'illaoi' && ability) {
            if (event.damageType === 'true' && loops.has(`${event.sourceId}:illaoi-channel`)) play(event.sourceId, 'illaoi-drain', [event.targetId]);
            else if (event.damageType === 'magic' && ended.get(event.sourceId) === event.tick) play(event.sourceId, 'illaoi-slam', [event.targetId]);
          }
          if (source.definitionId === 'swain' && source.form === 'front' && event.damageType === 'magic' && ability && ascension.has(event.sourceId)) {
            play(event.sourceId, 'swain-pulse', [event.targetId]);
          }
          if (source.definitionId === 'loris' && event.damageType === 'magic' && ability && ended.get(event.sourceId) === event.tick) play(event.sourceId, 'loris-retaliation', [event.targetId]);
          if (source.definitionId === 'silco' && event.damageType === 'magic' && ability) {
            const held = cohorts.get(event.sourceId)?.find(c => c.castTick < event.tick && c.ids.some(id => proxies.find(id)));
            if (held?.ids.length) { const id = held.ids[held.index++ % held.ids.length]; proxies.attack(id, event.targetId); }
          }
        }
        if (event.type === 'statusChanged' && event.kind === 'damage-reduction' && !['applied', 'refreshed'].includes(event.reason) && find(event.targetId)?.definitionId === 'illaoi') {
          channels.delete(event.targetId); ended.set(event.targetId, event.tick); stop(`${event.targetId}:illaoi-channel`);
        }
      };
      handle();
      settle(fresh);
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
      settle(new Set());
      for (const held of [...loops.values()]) if (!frame.pieces.some(p => p.id === held.owner && p.alive && p.visible)) stopUnit(held.owner);
    },
    update(seconds: number) {
      if (!Number.isFinite(seconds) || seconds < 0) return; clock += seconds;
      settle(new Set());
      if (!allowed()) proxies.clear(); else proxies.update(seconds);
      for (const [key, held] of loops) {
        if (!allowed() || !find(held.owner)?.alive || (held.source !== held.owner && !proxies.find(held.source))) { stop(key); continue; }
        // The public replay omits Swain's ascension deadline. Actual drain/heal
        // pulses keep it alive, including takedown extensions, with a short tail.
        if (held.variant === 'swain-ascension' && clock - (last.get(held.owner) ?? -Infinity) > SWAIN_TAIL_SECONDS) {
          ascension.delete(held.owner); stop(key); continue;
        }
        if (clock >= held.next) {
          if (runtime.playVariant(held.champion, held.variant, held.source, [], key)) held.next = clock + 9;
          else held.next = clock + .2;
        }
      }
    },
    clear() {
      for (const rec of [...summons.values()]) dropSummon(rec);
      for (const key of loops.keys()) stop(key);
      proxies.clear(); shields.clear(); unbound.clear(); last.clear(); ended.clear(); cohorts.clear(); reviving.clear(); poses.clear();
      ascension.clear(); channels.clear();
    },
    get proxyCount() { return proxies.count; },
  };
}
export function batch3ModelId(id: string, form: 'front' | 'back'): string { return id === 'elise' && form === 'front' ? 'vfx-elise-front' : id; }
