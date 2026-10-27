/** Offline mapping of resolved BIN spell/animation events; no gameplay rules or asset payloads. */
import type { VfxValue } from './bindings';
import { nameHash } from './binHash';
import type { TimelineCue } from './timeline';
import { S13_TIMELINES } from './s13-timelines';
import { planActionEffects, type EffectPlayback } from '../action-effect-plan';
export interface ConvertedMetadata { class: string | null; name?: string | null; root: VfxValue }
export interface ConvertedEvent {
  source: 'spell' | 'animation'; label: string; action?: 'cast' | 'attack'; event: TimelineCue['event'];
  system?: string; bone?: string; targetBone?: string; frame: number; endFrame?: number;
}
const field = (node: VfxValue | undefined, name: string): VfxValue | undefined => node?.type === 'struct'
  ? node.fields.find(f => f.hash.toLowerCase() === nameHash(name))?.value : undefined;
const items = (node: VfxValue | undefined): VfxValue[] => node?.type === 'container' ? node.items : [];
const number = (node: VfxValue | undefined, fallback = 0): number => node?.type === 'number' && node.value !== null ? node.value : fallback;
const text = (node: VfxValue | undefined): string | undefined => node?.type === 'string' ? node.value : node?.type === 'asset' ? node.path
  : node?.type === 'hash' || node?.type === 'link' ? node.name ?? node.hash : undefined;
const key = (value: string) => value.toLowerCase().replace(/^0x/, '');
const reference = (node: VfxValue | undefined) => node?.type === 'struct' ? node.object?.entry : node?.type === 'link' ? node.hash : undefined;

export function mapConvertedEvents(champion: string, metadata: readonly ConvertedMetadata[], systems: Record<string, string>) {
  const resolver = new Map<string, string>([
    [nameHash('TFT_Global_BA_Hit'), '0f2af66b'], [nameHash('TFT_Global_BA_Crit'), '2436e086'],
  ]);
  const records = metadata.filter(o => o.class === 'TFTCharacterRecord');
  const spellNames = new Set(records.flatMap(o => items(field(o.root, 'spellNames')).map(text)).filter((v): v is string => !!v).map(v => v.toLowerCase()));
  const attackNames = new Set(records.map(o => text(field(field(o.root, 'basicAttack'), 'mAttackName'))).filter((v): v is string => !!v).map(v => v.toLowerCase()));
  for (const object of metadata.filter(o => o.class === 'ResourceResolver')) {
    const map = field(object.root, 'resourceMap');
    if (map?.type !== 'map') continue;
    for (const entry of map.entries) {
      const target = reference(entry.value); if (!target) continue;
      resolver.set(entry.key.startsWith('0x') ? entry.key.toLowerCase() : nameHash(entry.key), key(target));
    }
  }
  const resolveKey = (node: VfxValue | undefined) => {
    const name = text(node); if (!name) return undefined;
    const hash = node?.type === 'hash' || node?.type === 'link' ? node.hash : nameHash(name);
    const id = resolver.get(hash.toLowerCase()); return id && Object.hasOwn(systems, id) ? id : undefined;
  };
  const events: ConvertedEvent[] = [], animationActions = new Map<string, 'cast' | 'attack'>();
  // Only character-record primary spell slots and basic attack select animation cues.
  // Subspells, crits, passives and recall graphs are recorded, never guessed into a cast.
  for (const object of metadata.filter(o => o.class === 'SpellObject')) {
    const script = text(field(object.root, 'mScriptName')) ?? object.name?.split('/').at(-1) ?? '';
    const spell = field(object.root, 'mSpell');
    const action = spellNames.has(script.toLowerCase()) ? 'cast' : attackNames.has(script.toLowerCase()) ? 'attack' : undefined;
    const animation = text(field(spell, 'mAnimationName'));
    if (action && animation) { animationActions.set(animation.toLowerCase(), action); animationActions.set(nameHash(animation), action); }
    const movement = field(field(spell, 'mMissileSpec'), 'movementComponent');
    for (const [name, event] of [['mCastEffectKey', 'cast-start'], ['mMissileEffectKey', 'projectile'], ['mHitEffectKey', 'hit']] as const) {
      const effect = field(spell, name); if (!effect) continue;
      const bone = text(field(event === 'projectile' ? movement : spell,
        event === 'projectile' ? 'mStartBoneName' : event === 'hit' ? 'mHitBoneName' : 'mCastBoneName'));
      events.push({ source: 'spell', label: script, action, event, system: resolveKey(effect), bone: bone && bone !== '0' ? bone : undefined,
        targetBone: text(field(spell, 'mHitBoneName')), frame: number(field(spell, 'castFrame')) });
    }
  }
  const walk = (node: VfxValue, label: string, action?: 'cast' | 'attack') => {
    if (node.type === 'struct') {
      if (node.classHash.toLowerCase() === nameHash('ParticleEventData')) {
        const start = number(field(node, 'mStartFrame')), end = number(field(node, 'mEndFrame'), -1);
        const pairs = items(field(node, 'mParticleEventDataPairList'));
        for (const pair of pairs.length ? pairs : [undefined]) events.push({ source: 'animation', label, action, event: 'cast-start',
          system: resolveKey(field(node, 'mEffectKey')), bone: text(field(pair, 'mBoneName')), frame: start, ...(end >= start ? { endFrame: end } : {}) });
        return;
      }
      for (const held of node.fields) {
        if (held.hash.toLowerCase() === nameHash('mClipDataMap') && held.value.type === 'map') {
          for (const clip of held.value.entries) {
            const clipAction = animationActions.get(clip.key.toLowerCase());
            walk(clip.value, clip.key, clipAction);
          }
        } else walk(held.value, label, action);
      }
    } else if (node.type === 'container') for (const child of node.items) walk(child, label, action);
    else if (node.type === 'map') for (const child of node.entries) walk(child.value, label, action);
  };
  for (const object of metadata.filter(o => o.class === 'AnimationGraphData')) walk(object.root, object.name ?? 'animation');
  const diagnostics: string[] = [];
  const cues: TimelineCue[] = [];
  for (const action of ['cast', 'attack'] as const) {
    const selected = events.filter(e => e.action === action);
    const unresolved = selected.filter(e => !e.system);
    // An unresolved selected effect means the whole action must keep its legacy visual.
    if (unresolved.length) { diagnostics.push(`${action}:unresolved-events:${unresolved.length}`); continue; }
    const unique = new Map<string, TimelineCue>(); let outsideBudget = false;
    for (const event of selected) {
      const delay = event.frame / 30; // Explicit presentation convention, not the combat tick.
      const travel = event.event === 'projectile' ? 0.3 : 0;
      const cue: TimelineCue = { system: event.system!, action, event: event.event, bone: event.bone,
        delay: delay + (event.event === 'hit' && selected.some(e => e.event === 'projectile') ? 0.3 : 0),
        duration: event.endFrame !== undefined ? Math.min(10, Math.max(0.5, (event.endFrame - event.frame) / 30 + 1)) : 1.5,
        ...(travel ? { travelSeconds: travel, targetBone: event.targetBone } : {}),
        ...(event.endFrame !== undefined ? { stopAfter: (event.endFrame - event.frame) / 30 } : {}) };
      if (cue.delay < 0 || cue.delay > 10 || (cue.stopAfter ?? 0) > cue.duration) { outsideBudget = true; continue; }
      unique.set(JSON.stringify(cue), cue);
    }
    if (outsideBudget) diagnostics.push(`${action}:event-outside-budget`);
    else if (unique.size === 0) diagnostics.push(`${action}:no-direct-events`);
    else cues.push(...unique.values());
  }
  const special = S13_TIMELINES[champion as keyof typeof S13_TIMELINES];
  const mapped = special && special.every(c => Object.hasOwn(systems, c.system))
    ? [...special, ...cues.filter(c => c.action === 'attack')] : cues;
  if (mapped.length > 12) { diagnostics.push('timeline:cue-budget'); return { events, cues: [], diagnostics }; }
  return { events, cues: mapped, diagnostics };
}

export interface LegacyVfxBindings {
  actionEffects?: Record<string, { cast?: readonly string[]; attack?: readonly string[] }>;
  playback?: Record<string, { anchor: string; delay: number; maxDuration: number; bone?: string }>;
}
/** Script-driven spells reuse already reviewed display bindings, matched by exact
 * exported system names. Missing binding members keep the complete legacy action. */
export function mapLegacyTimeline(champion: string, inventory: readonly { id: string; name: string | null }[], bindings: LegacyVfxBindings) {
  const byName = new Map(inventory.filter(s => s.name).map(s => [s.name!.split('/').at(-1)!.toLowerCase(), s.id]));
  const cues: TimelineCue[] = [], diagnostics: string[] = [];
  for (const action of ['cast', 'attack'] as const) {
    const ids = bindings.actionEffects?.[champion]?.[action] ?? [];
    const playback: Record<string, EffectPlayback> = {};
    for (const id of ids) {
      const spec = bindings.playback?.[id];
      if (spec && ['source','target','projectile'].includes(spec.anchor)) playback[id] = {
        anchor: spec.anchor as EffectPlayback['anchor'], delay: spec.delay, maxDuration: spec.maxDuration, ...(spec.bone ? { bone: spec.bone } : {}),
      };
    }
    const original = ids.map(id => ({ id, playback: playback[id] }));
    // Existing renderer overrides can depend on procedural missiles/areas or omit
    // known fixed-direction layers. A data-only replacement must not bypass them.
    if (Object.keys(playback).length === ids.length && JSON.stringify(planActionEffects(champion, action, ids.map(id => ({ id })), playback)) !== JSON.stringify(original)) {
      diagnostics.push(`${action}:requires-host-staging`); continue;
    }
    const pending: TimelineCue[] = []; let complete = true;
    for (const id of ids) {
      const name = id.slice((id.startsWith('global_') ? 'global' : champion).length + 1), system = byName.get(name);
      const spec = bindings.playback?.[id];
      if (!system || !spec || !['source','target','projectile'].includes(spec.anchor)) { complete = false; diagnostics.push(`${action}:unmapped-binding:${id}`); continue; }
      pending.push({ system, action, event: spec.anchor === 'source' ? 'cast-start' : spec.anchor === 'target' ? 'hit' : 'projectile',
        delay: spec.delay, duration: spec.maxDuration, bone: spec.bone,
        ...(spec.anchor === 'projectile' ? { travelSeconds: spec.maxDuration } : {}) });
    }
    if (complete) cues.push(...pending);
  }
  return { cues, diagnostics };
}
