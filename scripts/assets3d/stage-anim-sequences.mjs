import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeAnm } from './animation.mjs';
import { binField as bField, fnv1a, parseBin } from './bin.mjs';
import { canonicalAsset, skinBindings, sourceName } from './bin-bindings.mjs';
import { appendCastClip } from './cast-picks.mjs';
import { compressModelGlb } from './compress.mjs';
import { readGlb, writeGlb } from './glb.mjs';
import { inspectSkn } from './inspect-source.mjs';
import { loadUnitMap } from './local-config.mjs';
import { makeModel, validateModel } from './model.mjs';
import { contracts } from './runtime.mjs';

export const DEFAULT_EXCLUDES = new Set([
  'sevika:cast',
  'sevika:attack',
  'caitlyn:attack',
  'violet:cast',
  'malzahar:cast',
]);

/**
 * Casts whose SpellObject has an empty mAnimationName (the original spell script picks the clips).
 * The graph keys below were checked against gameplay video and the clips' own events:
 * - ezreal: TFT13_EzrealSpell stands still, pulls back and fires (gameplay footage); that is
 *   Spell3_In (carries the cast particle) + Spell3_Out (to the graph's own end frame). Spell2_* is the E blink
 *   with forward root motion, which made the model jump forward and snap back.
 * - warwick: TFT13_WarwickSpell is Blood Frenzy: he rears up in place and then claws (gameplay
 *   footage, no displacement). The graph key of howl.anm cracks to BloodFrenzy_Activate, the cast's own name. The clip
 *   we played, TFT13_Warwick_Spell_Dash, sits under the graph key Devour_Dash: the execute leap, not the cast.
 * - mel: TFT13_MissMageSpell dashes, then fires bolts (gameplay footage: the dash trail precedes the
 *   bolts). Spell1_Blast starts from the exact pose Spell_Dash holds, so the two chain as Spell_Dash then
 *   Spell1_Blast. (Spell2 is not used here: it carries a separate warning sound and is left out.)
 * Each list is played as a Sequencer, so the graph's own frame ranges still apply.
 */
export const SCRIPT_CAST_GRAPH_KEYS = Object.freeze({
  ezreal: Object.freeze(['Spell3_In', 'Spell3_Out']),
  warwick: Object.freeze(['BloodFrenzy_Activate']),
  mel: Object.freeze(['Spell_Dash', 'Spell1_Blast']),
});

/**
 * Casts whose spell names a graph key that is not what the original plays. Darius: TFT13_DariusSpell names `Spell`
 * (Atomic Spell1, a short clip), but the original Q_Ring emitters wait longer than that and the 11-08 footage audit shows
 * the blade ring with the swing of the Sequencer 0x5463dad9 (Spell1_IN → Spell1) next to it in the same graph.
 * Values are graph keys (names or 0x hashes).
 */
export const CAST_GRAPH_KEY_OVERRIDES = Object.freeze({
  darius: '0x5463dad9',
});

/** One graph key (a name, or a `0x` hash for an uncracked one) as its hash. */
export const graphKeyHash = key => (key.startsWith('0x') ? Number.parseInt(key, 16) : fnv1a(key)) >>> 0;

/**
 * A graph mask (MaskData.mWeightList, one weight per skeleton joint in skeleton order) as bone → weight, without the
 * zero weights. `jointNames` are the glb skin's joints, which keep the skeleton order.
 */
export function maskBoneWeights(weightList, jointNames) {
  if (!Array.isArray(weightList) || !Array.isArray(jointNames) || weightList.length !== jointNames.length) return null;
  const out = {};
  weightList.forEach((w, i) => {
    const weight = Math.min(1, Math.max(0, Number(w)));
    if (weight > 0 && jointNames[i]) out[jointNames[i]] = Math.round(weight * 1e4) / 1e4;
  });
  return Object.keys(out).length ? out : null;
}

/**
 * Builds a Sequencer node from SCRIPT_CAST_GRAPH_KEYS for a script-driven cast; null when the unit has none.
 * `resolveKey` resolves one graph key to a node (or null); a missing key is an error, not a silent skip.
 */
export async function buildScriptCastNode(id, resolveKey, table = SCRIPT_CAST_GRAPH_KEYS) {
  const keys = table[id];
  if (!keys?.length) return null;
  const children = [];
  for (const key of keys) {
    const child = await resolveKey(key);
    if (!child) throw new Error(`script-cast-graph-key-missing: ${id}:${key}`);
    children.push(child);
  }
  return { kind: 'Sequencer', keyName: `script:${keys.join('+')}`, keyHash: 0, children };
}

const KNOWN_GRAPH_NAMES = new Set([
  'AnimationGraphData', 'mClipDataMap', 'mBlendDataTable', 'mMaskDataMap', 'mTrackDataMap', 'mSyncGroupDataMap',
  'AtomicClipData', 'SequencerClipData', 'SelectorClipData', 'ParallelClipData', 'ConditionFloatClipData',
  'ConditionBoolClipData', 'ParametricClipData', 'SubGraphClipData', 'BotsClipData',
  'Attack1', 'Attack2', 'Attack3', 'Attack4', 'Attack5', 'Attack6', 'Attack',
  'BasicAttack', 'BasicAttack1', 'BasicAttack2', 'Crit', 'Crit1', 'Crit2',
  'Spell', 'Spell1', 'Spell2', 'Spell3', 'Spell4', 'SpellCast', 'Spell3Star', 'SpellAttackSelector',
  'Idle1', 'Idle', 'Run', 'Walk', 'Death', 'Celebration', 'Dance', 'Hit', 'Hit1', 'KnockUp', 'Death_Loop',
  'Spell_Zap', 'Spell_FlameChompers', 'Spell_DeathRocket', 'Spell_DeathRocket2', 'AfterDeathRocket',
  'Spell3_Both', 'Spell3_Both_Start', 'Spell3_Both_End', 'Spell3_Front', 'Spell3_Front_Start', 'Spell3_Front_End',
  'Spell3_Back', 'Spell3_Back_Start', 'Spell3_Back_End',
  'Spell_Melee', 'Spell_Melee_Ignite', 'Spell_Ranged', 'Spell_Ranged_Summon', 'Spell_Ranged_Blast',
  'Attack1_Melee', 'Attack2_Melee', 'Crit_Melee', 'Attack1_Ranged', 'Attack2_Ranged', 'Crit_Ranged',
  'SpellFist_Dash', 'SpellFist_Throw', 'SpellFist_DashBackwards', 'SpellChain_Strike',
  'Spell_First', 'Spell_Shoot', 'Spell_Shoot_90', 'Spell_Shoot_-90', 'Spell_Shoot_ToIdle',
  'Transform', 'TransformIn', 'TransformOut', 'Spell_2', 'Spell_3', 'Spell_1', 'Spell4_Hit',
  'Spell2_Ranged_Jump', 'Spell2_KnockHexCrystals', 'Spell1_GainShield', 'Spell1_Right', 'Spell1_Left', 'CallShield',
  'BloodFrenzy_Activate', 'Devour_Dash', 'Spell_Dash', 'Spell1_Blast',
  'Spell2_Sequence', 'Spell_Out', 'Spell_Hero', 'Spell_Hero_Parallel', 'Spell_Run',
]);

/**
 * Merge adjacent segments in a Sequencer (or Parallel child sequence).
 * - When `untrimmed` is false (cast): merges adjacent segments with identical `clipName`
 *   when `prev.endFrame + 1 === next.startFrame`.
 * - When `untrimmed` is true (attack, #581): strips frame ranges so every segment is a whole clip,
 *   and merges adjacent segments that reference the same `clipName`.
 */
export function mergeAdjacentSegments(segments, { untrimmed = false } = {}) {
  const out = [];
  for (const raw of segments) {
    const seg = {
      ...raw,
      clipName: raw.clipName ?? raw.glbName,
    };
    if (untrimmed) {
      const normalized = {
        ...seg,
        startFrame: null,
        endFrame: null,
        effectiveStartFrame: 0,
        effectiveEndFrame: seg.lastFrame ?? 0,
        isWholeClip: true,
      };
      const prev = out.at(-1);
      if (prev && prev.clipName === normalized.clipName) continue;
      out.push(normalized);
      continue;
    }
    const prev = out.at(-1);
    if (
      prev
      && prev.clipName === seg.clipName
      && prev.endFrame != null
      && seg.startFrame != null
      && prev.endFrame + 1 === seg.startFrame
    ) {
      const mergedEnd = seg.endFrame;
      const effStart = prev.effectiveStartFrame ?? prev.startFrame ?? 0;
      const effEnd = seg.effectiveEndFrame ?? mergedEnd ?? seg.lastFrame ?? 0;
      const fps = prev.fps || seg.fps || 30;
      const lastFrame = prev.lastFrame ?? seg.lastFrame ?? null;
      const isWhole = effStart <= 0 && lastFrame != null && mergedEnd != null && mergedEnd >= lastFrame;
      out[out.length - 1] = {
        ...prev,
        mask: JSON.stringify(prev.mask ?? null) === JSON.stringify(seg.mask ?? null) ? prev.mask : undefined,
        startFrame: isWhole ? null : (prev.startFrame ?? 0),
        endFrame: isWhole ? null : mergedEnd,
        effectiveStartFrame: effStart,
        effectiveEndFrame: effEnd,
        duration: Math.max(0, (effEnd - effStart) / fps),
        isWholeClip: isWhole,
        merged: true,
      };
      continue;
    }
    out.push(seg);
  }
  return out;
}

/**
 * Map 1..4 ordered stage clip names (and optional parallel layers) into a CastSequence.
 */
export function mapStagesToSequence(stageNames, layers = [], masks = {}) {
  if (!Array.isArray(stageNames) || stageNames.length === 0) {
    return { sequence: null, skipReason: '无有效片段' };
  }
  if (stageNames.length > 4) {
    return { sequence: null, skipReason: `段数>4 (${stageNames.length}段)` };
  }
  if (layers.length > 4) {
    return { sequence: null, skipReason: `layers>4 (${layers.length}层)` };
  }
  let sequence;
  if (stageNames.length === 1) {
    sequence = { main: stageNames[0] };
  } else if (stageNames.length === 2) {
    sequence = { in: stageNames[0], main: stageNames[1] };
  } else if (stageNames.length === 3) {
    sequence = { in: stageNames[0], main: stageNames[1], out: stageNames[2] };
  } else {
    sequence = { in: stageNames[0], hold: stageNames[1], main: stageNames[2], out: stageNames[3] };
  }
  if (layers.length > 0) {
    sequence = { ...sequence, layers: [...layers] };
    // Masks only matter where clips play together: the main stage and its layers.
    const kept = Object.fromEntries(Object.entries(masks ?? {}).filter(([name]) => name === sequence.main || layers.includes(name)));
    if (Object.keys(kept).length) sequence = { ...sequence, masks: kept };
  }
  return { sequence, skipReason: null };
}

function hasBlockingCastVariants(entry) {
  const v = entry?.castVariants;
  if (!v || typeof v !== 'object') return false;
  if (v.rotate || v.branch || v.front || v.back) return true;
  if (!entry.castSequence && Object.keys(v).length > 0) return true;
  return false;
}

function isWholeSegment(seg) {
  if (seg.isWholeClip) return true;
  if (seg.startFrame == null && seg.endFrame == null) return true;
  const sf = seg.startFrame ?? 0;
  if (sf <= 0 && seg.endFrame == null) return true;
  if (sf <= 0 && seg.lastFrame != null && seg.endFrame != null && seg.endFrame >= seg.lastFrame) return true;
  return false;
}

function collectLinearSegments(node) {
  if (!node) return { ok: false, reason: '未解析', segments: [] };
  if (node.kind === 'Atomic') return { ok: true, segments: [node] };
  if (node.kind === 'Sequencer') {
    const segments = [];
    for (const child of node.children ?? []) {
      const sub = collectLinearSegments(child);
      if (!sub.ok) return sub;
      segments.push(...sub.segments);
    }
    return { ok: true, segments };
  }
  return { ok: false, reason: `非常规节点 (${node.kind})`, segments: [] };
}

function isMovingCondition(node) {
  return node.updater === 'IsMovingParametricUpdater' || node.updater === '0x6c816d62';
}

/**
 * Pure planner that converts a resolved animation graph node into manifest updates
 * for either `'cast'` or `'attack'`.
 */
export function planGraphAction(node, { action = 'cast', entry = {}, otherUsedClips = new Set() } = {}) {
  if (action === 'cast' && hasBlockingCastVariants(entry)) {
    return { status: 'skipped', reason: '需人工 (castVariants)' };
  }
  if (!node) {
    return { status: 'skipped', reason: '未解析' };
  }
  // IsMoving ConditionBool (e.g. Dr. Mundo Spell4: [true] run / [false] idle): our units stand still while
  // casting, so the standing (false) branch is the clip the original plays.
  if (node.kind === 'ConditionBool' && isMovingCondition(node) && node.branches?.false) {
    return planGraphAction(node.branches.false, { action, entry, otherUsedClips });
  }
  if (node.kind === 'Selector' || node.kind === 'Parametric' || node.kind === 'ConditionBool' || node.kind === 'Unknown' || node.kind === 'Cycle') {
    return { status: 'skipped', reason: `非常规节点 (${node.kind})` };
  }

  let rawMain = [];
  let rawLayers = [];
  if (node.kind === 'Atomic' || node.kind === 'Sequencer') {
    const res = collectLinearSegments(node);
    if (!res.ok) return { status: 'skipped', reason: res.reason };
    rawMain = res.segments;
  } else if (node.kind === 'Parallel') {
    const children = node.children ?? [];
    if (!children.length) return { status: 'skipped', reason: '无有效片段' };
    const mainRes = collectLinearSegments(children[0]);
    if (!mainRes.ok) return { status: 'skipped', reason: mainRes.reason };
    rawMain = mainRes.segments;
    for (const layerChild of children.slice(1)) {
      const layerRes = collectLinearSegments(layerChild);
      if (!layerRes.ok) return { status: 'skipped', reason: layerRes.reason };
      rawLayers.push(...layerRes.segments);
    }
  } else {
    return { status: 'skipped', reason: `非常规节点 (${node.kind})` };
  }

  const untrimmed = action === 'attack';
  const mainSegments = mergeAdjacentSegments(rawMain, { untrimmed });
  const layerSegments = mergeAdjacentSegments(rawLayers, { untrimmed });

  if (mainSegments.length === 0) {
    return { status: 'skipped', reason: '无有效片段' };
  }

  const allSegments = [...mainSegments, ...layerSegments];
  const requiredClips = [...new Set(allSegments.map(s => s.clipName).filter(Boolean))];
  const clipCounts = new Map();
  for (const seg of allSegments) {
    clipCounts.set(seg.clipName, (clipCounts.get(seg.clipName) ?? 0) + 1);
  }

  const clipRanges = {};
  const clipSegments = {};
  const wholeClips = new Set();
  const mergedWholeClips = new Set();

  const resolveSegmentName = seg => {
    const clipName = seg.clipName;
    if (untrimmed || isWholeSegment(seg)) {
      wholeClips.add(clipName);
      if (seg.merged) mergedWholeClips.add(clipName);
      return clipName;
    }
    const fps = seg.fps || 30;
    const sf = Math.max(0, seg.startFrame ?? 0);
    const ef = seg.endFrame != null ? seg.endFrame : (seg.lastFrame ?? sf);
    const startSec = sf / fps;
    const endSec = ef / fps;
    if (endSec <= startSec) {
      wholeClips.add(clipName);
      return clipName;
    }
    const totalUses = (clipCounts.get(clipName) ?? 0) + (otherUsedClips.has(clipName) ? 1 : 0);
    if (totalUses === 1) {
      clipRanges[clipName] = [startSec, endSec];
      return clipName;
    }
    const alias = `${clipName}@${sf}-${ef}`;
    clipSegments[alias] = [clipName, startSec, endSec];
    return alias;
  };

  const mainNames = mainSegments.map(resolveSegmentName);
  const layerNames = layerSegments.map(resolveSegmentName);
  // An Atomic's own bone mask (resolved by the caller onto `mask`); a merged segment keeps it only if it is the same.
  const masks = {};
  [...mainSegments, ...layerSegments].forEach((seg, i) => {
    const name = i < mainNames.length ? mainNames[i] : layerNames[i - mainNames.length];
    if (seg.mask && !Object.hasOwn(masks, name)) masks[name] = seg.mask;
  });
  const { sequence, skipReason } = mapStagesToSequence(mainNames, layerNames, masks);
  if (skipReason || !sequence) {
    return { status: 'skipped', reason: skipReason ?? '无法映射序列' };
  }

  if (action === 'attack') {
    const isMulti = mainNames.length > 1 || layerNames.length > 0;
    return {
      status: 'ok',
      action: 'attack',
      attackSequence: isMulti ? sequence : undefined,
      attackClip: mainNames[0],
      requiredClips,
      mainSegments,
      layerSegments,
    };
  }

  return {
    status: 'ok',
    action: 'cast',
    castSequence: sequence,
    clipRanges,
    clipSegments,
    wholeClips: [...wholeClips],
    mergedWholeClips: [...mergedWholeClips],
    requiredClips,
    mainSegments,
    layerSegments,
  };
}

/**
 * `castVariants.rotate` is hand-authored: entry i is the i-th spell the unit cycles through. Each spell script names
 * its graph key (`mAnimationName`, or the listed fallback when that is empty).
 */
export const ROTATE_SPELLS = {
  jinx: [
    { script: 'TFT13_JinxSpell_Zap', graphKey: 'Spell_Zap' },
    { script: 'TFT13_JinxSpell_FlameChompers', graphKey: 'Spell_FlameChompers' },
    { script: 'TFT13_JinxSpell_DeathRocket', graphKey: 'Spell_DeathRocket' },
  ],
};

/**
 * Pure planner for one `castVariants.rotate` entry: a single whole clip stays a string, anything longer becomes a
 * CastSequence. A trimmed clip may only take a clipRange when no other reference already trims it differently.
 */
export function planRotateEntry(node, { entry = {}, otherUsedClips = new Set() } = {}) {
  const plan = planGraphAction(node, { action: 'cast', entry: {}, otherUsedClips });
  if (plan.status !== 'ok') return plan;
  const existing = entry.clipRanges ?? {};
  for (const [clip, range] of Object.entries(plan.clipRanges)) {
    const old = existing[clip];
    if (old && (Math.abs(old[0] - range[0]) > 1e-6 || Math.abs(old[1] - range[1]) > 1e-6)) {
      return { status: 'skipped', reason: `clipRanges 冲突 (${clip})` };
    }
  }
  for (const clip of plan.wholeClips) {
    if (existing[clip]) return { status: 'skipped', reason: `clipRanges 冲突 (${clip})` };
  }
  const seq = plan.castSequence;
  const single = typeof seq.main === 'string' && !seq.in && !seq.hold && !seq.out && !seq.layers;
  return {
    status: 'ok',
    rotateEntry: single ? seq.main : seq,
    clipRanges: plan.clipRanges,
    clipSegments: plan.clipSegments,
    requiredClips: plan.requiredClips,
  };
}

/**
 * Plans an existing `castVariants.hero` from the original `<Spell>Hero` SpellObject's graph node.
 * Returns the next `castVariants` (undefined when empty); a hero variant equal to the default
 * cast sequence is dropped so the default path plays it. Ranged/segmented hero clips stay manual.
 */
export function planHeroVariant(node, { entry = {} } = {}) {
  const variants = entry?.castVariants;
  if (!variants?.hero) return { status: 'skipped', reason: '无 castVariants.hero' };
  if (!node) return { status: 'skipped', reason: '未解析' };
  const plan = planGraphAction(node, { action: 'cast', entry: {} });
  if (plan.status !== 'ok') return plan;
  if (Object.keys(plan.clipRanges).length > 0 || Object.keys(plan.clipSegments).length > 0) {
    return { status: 'skipped', reason: '需人工 (hero 片段带帧区间)' };
  }
  const trimmed = plan.wholeClips.filter(c => entry.clipRanges && Object.hasOwn(entry.clipRanges, c));
  if (trimmed.length > 0) return { status: 'skipped', reason: `需人工 (hero 整段与 clipRanges 冲突: ${trimmed.join(', ')})` };
  const defaultSequence = entry.castSequence ?? (entry.animations?.cast ? { main: entry.animations.cast } : undefined);
  const sameAsDefault = JSON.stringify(plan.castSequence) === JSON.stringify(defaultSequence);
  const { hero: _oldHero, ...rest } = variants;
  const castVariants = sameAsDefault ? rest : { ...rest, hero: plan.castSequence };
  const changed = JSON.stringify(variants.hero) !== JSON.stringify(plan.castSequence);
  return {
    status: 'ok',
    changed,
    heroSequence: plan.castSequence,
    castVariants: Object.keys(castVariants).length > 0 ? castVariants : undefined,
    requiredClips: plan.requiredClips,
  };
}

function fnv1aHex(str) {
  return '0x' + (fnv1a(str) >>> 0).toString(16).padStart(8, '0');
}

const metaField = (node, name) => node?.type === 'struct'
  ? node.fields.find(f => f.hash.toLowerCase() === fnv1aHex(name))?.value : undefined;
const metaItems = node => node?.type === 'container' ? node.items : [];
const metaText = node => node?.type === 'string' ? node.value : node?.type === 'asset' ? node.path
  : node?.type === 'hash' || node?.type === 'link' ? node.name ?? node.hash : undefined;

async function walkFiles(root, dir = root) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walkFiles(root, full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function readGlbDocument(bytes) {
  try {
    return readGlb(bytes).document;
  } catch {
    if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67) {
      throw new Error('invalid-glb-header');
    }
    const jsonLength = bytes.readUInt32LE(12);
    return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  }
}

function isUncompressedGlb(bytes) {
  try {
    readGlb(bytes);
    return true;
  } catch {
    return false;
  }
}

function getGlbJointNames(bytes) {
  const doc = readGlbDocument(bytes);
  const skin = doc.skins?.[0];
  return skin ? skin.joints.map(i => doc.nodes?.[i]?.name ?? '') : null;
}

function getGlbClipNames(bytes) {
  const doc = readGlbDocument(bytes);
  return new Set((doc.animations ?? []).map(a => a.name));
}

function alignDonorRootOffset(workingBytes, donorGlb) {
  const orig = readGlb(workingBytes);
  const donor = readGlb(donorGlb);
  const aNodes = orig.document.nodes ?? [];
  const bNodes = donor.document.nodes ?? [];
  if (aNodes.length !== bNodes.length || aNodes.length === 0) return donorGlb;
  const rootSet = new Set(aNodes[0]?.children ?? []);
  const rootDeltas = new Map();
  for (let i = 1; i < aNodes.length; i++) {
    const an = aNodes[i];
    const bn = bNodes[i];
    if (an.name !== bn.name) return donorGlb;
    if (JSON.stringify(an.children ?? null) !== JSON.stringify(bn.children ?? null)) return donorGlb;
    if (JSON.stringify(an.rotation ?? null) !== JSON.stringify(bn.rotation ?? null)) return donorGlb;
    if (JSON.stringify(an.scale ?? null) !== JSON.stringify(bn.scale ?? null)) return donorGlb;
    if (rootSet.has(i) && Array.isArray(an.translation) && Array.isArray(bn.translation)) {
      const dx = an.translation[0] - bn.translation[0];
      const dy = an.translation[1] - bn.translation[1];
      const dz = an.translation[2] - bn.translation[2];
      if (Math.abs(dx) > 1e-7 || Math.abs(dy) > 1e-7 || Math.abs(dz) > 1e-7) {
        rootDeltas.set(i, [dx, dy, dz]);
        bn.translation = [...an.translation];
      }
    } else if (JSON.stringify(an.translation ?? null) !== JSON.stringify(bn.translation ?? null)) {
      return donorGlb;
    }
  }
  if (rootDeltas.size === 0) return donorGlb;
  const adjustedSamplers = new Set();
  for (const anim of donor.document.animations ?? []) {
    for (const ch of anim.channels ?? []) {
      if (ch.target?.path === 'translation' && rootDeltas.has(ch.target.node)) {
        const key = `${anim.name}:${ch.sampler}`;
        if (adjustedSamplers.has(key)) continue;
        adjustedSamplers.add(key);
        const delta = rootDeltas.get(ch.target.node);
        const sampler = anim.samplers[ch.sampler];
        const acc = donor.document.accessors[sampler.output];
        const view = donor.document.bufferViews[acc.bufferView];
        const byteOffset = view.byteOffset ?? 0;
        for (let k = 0; k < acc.count; k++) {
          for (let c = 0; c < 3; c++) {
            const pos = byteOffset + (k * 3 + c) * 4;
            const val = donor.binary.readFloatLE(pos);
            donor.binary.writeFloatLE(Math.fround(val + delta[c]), pos);
          }
        }
      }
    }
  }
  return writeGlb(donor.document, donor.binary);
}

function formatNodeSummary(node) {
  if (!node) return '未解析';
  if (node.kind === 'Atomic') {
    const range = (node.startFrame != null || node.endFrame != null)
      ? `[${node.startFrame ?? 0}..${node.endFrame ?? `末帧(${node.lastFrame})`}]`
      : '全段';
    return `Atomic: \`${node.clipName}\` (${range})`;
  }
  if (node.kind === 'Sequencer') {
    return `Sequencer(${node.keyName}): ` + (node.children ?? []).map(formatNodeSummary).join(' → ');
  }
  if (node.kind === 'Parallel') {
    return `Parallel(${node.keyName}): ` + (node.children ?? []).map(formatNodeSummary).join(' ∥ ');
  }
  if (node.kind === 'ConditionBool' && node.branches) {
    return `ConditionBool(${node.keyName}${node.updater ? `, ${node.updater}` : ''}): `
      + Object.entries(node.branches).map(([label, b]) => `[${label}] ${formatNodeSummary(b)}`).join(' | ');
  }
  return `${node.kind}(${node.keyName})`;
}

/**
 * Graph keys tried, in order, for a champion's cast when its spell data names nothing the graph has.
 * Swain's falls back to Spell2. Singed: TFT13_SingedSpell names "Spell1"; the graph spells it Spell_1 (a section of
 * Spell_3.anm: the canister swung round to the front and held up as a shield, the original's block). Spell2_Sequence
 * starts mid-swing and flips the canister within a few frames, which read as a twitch (user 11-11).
 */
export function castFallbackKeys(id) {
  const keys = ['Spell', 'Spell1', 'SpellCast'];
  if (id === 'swain') keys.push('Spell2');
  if (id === 'singed') keys.push('Spell_1');
  return keys;
}

export async function stageAnimSequences({
  assetsRoot,
  extractedRoot,
  metadataRoot = '/data/aiapps/vfx-set13-20261102/export',
  outDir,
  only = null,
  exclude = null,
  unitMapPath,
} = {}) {
  if (!assetsRoot || !extractedRoot || !outDir) {
    throw new Error('usage: --assets <dir> --extracted <dir> --metadata-root <dir> --out-dir <dir> [--only <ids>] [--exclude <id:action,...>]');
  }
  const resolvedAssets = resolve(assetsRoot);
  const resolvedOut = resolve(outDir);
  const resolvedMeta = resolve(metadataRoot);
  if (resolvedOut === resolvedAssets) {
    throw new Error('out-dir-must-not-equal-assets-root');
  }

  const extractedRoots = extractedRoot.split(',').map(s => resolve(s.trim())).filter(Boolean);
  const sixCostCandidate = resolve(extractedRoots[0], '../../../six-cost/source/extracted');
  if (existsSync(sixCostCandidate) && !extractedRoots.includes(sixCostCandidate)) {
    extractedRoots.push(sixCostCandidate);
  }
  const hardcodedSixCost = '/home/aiapps/workspace/set13-worktrees/boards/assets3d-local/six-cost/source/extracted';
  if (existsSync(hardcodedSixCost) && !extractedRoots.includes(hardcodedSixCost)) {
    extractedRoots.push(hardcodedSixCost);
  }

  const excludeSet = new Set(DEFAULT_EXCLUDES);
  if (exclude) {
    const items = typeof exclude === 'string' ? exclude.split(',') : exclude;
    for (const raw of items) {
      const token = raw.trim();
      if (!token) continue;
      if (token.includes(':')) excludeSet.add(token);
      else {
        excludeSet.add(`${token}:cast`);
        excludeSet.add(`${token}:attack`);
      }
    }
  }

  const onlySet = only
    ? new Set((typeof only === 'string' ? only.split(',') : only).map(s => s.trim()).filter(Boolean))
    : null;

  const byLower = new Map();
  const byCanonical = new Map();
  for (const root of extractedRoots) {
    if (!existsSync(root)) continue;
    const files = await walkFiles(root);
    for (const full of files) {
      const rel = full.slice(root.length + 1).replaceAll('\\', '/');
      if (!byLower.has(rel.toLowerCase())) byLower.set(rel.toLowerCase(), full);
      if (!byCanonical.has(canonicalAsset(rel))) byCanonical.set(canonicalAsset(rel), full);
    }
  }
  const resolveExtracted = path => {
    if (!path) return null;
    const norm = path.replaceAll('\\', '/').toLowerCase();
    return byLower.get(norm) ?? byCanonical.get(canonicalAsset(norm)) ?? null;
  };

  let baseManifest = JSON.parse(await readFile(join(resolvedAssets, 'manifest.json'), 'utf8'));
  const hasAnyClipRanges = Object.values(baseManifest.models ?? {}).some(m => m.clipRanges && Object.keys(m.clipRanges).length > 0);
  if (!hasAnyClipRanges && existsSync('/tmp/animcmp-manifest.json')) {
    baseManifest = JSON.parse(await readFile('/tmp/animcmp-manifest.json', 'utf8'));
  }
  const nextManifest = structuredClone(baseManifest);
  const defaultUnitMap = fileURLToPath(new URL('../../assets3d-local/unit-map.local.json', import.meta.url));
  const unitMap = await loadUnitMap(unitMapPath ?? (existsSync(defaultUnitMap) ? defaultUnitMap : undefined));
  const unitEntries = Object.entries(unitMap).filter(([k]) => !k.startsWith('$'));

  const knownNames = new Set(KNOWN_GRAPH_NAMES);
  for (const [, cfg] of unitEntries) {
    const dir = cfg.sourceName.toLowerCase();
    const metaPath = join(resolvedMeta, dir, 'metadata.json');
    if (!existsSync(metaPath)) continue;
    const meta = JSON.parse(await readFile(metaPath, 'utf8'));
    const visit = n => {
      if (!n || typeof n !== 'object') return;
      if (typeof n.value === 'string') knownNames.add(n.value);
      if (typeof n.path === 'string') {
        knownNames.add(n.path);
        const base = n.path.split('/').at(-1).replace(/(?:\.tft_set13(?:_evolved|_macaomode)?)?\.anm$/i, '');
        knownNames.add(base);
        knownNames.add(base.replace(/^tft13_[a-z0-9_]+?_/i, ''));
      }
      if (typeof n.name === 'string') knownNames.add(n.name);
      if (Array.isArray(n.fields)) n.fields.forEach(f => { if (f.name) knownNames.add(f.name); visit(f.value); });
      if (Array.isArray(n.items)) n.items.forEach(visit);
      if (Array.isArray(n.entries)) n.entries.forEach(e => { if (typeof e.key === 'string') knownNames.add(e.key); visit(e.value); });
    };
    meta.forEach(o => visit(o.root));
  }

  const hashToName = new Map();
  for (const name of knownNames) {
    if (name) hashToName.set(fnv1a(name), name);
  }
  const nameOf = h => {
    if (typeof h === 'string') return h;
    if (typeof h === 'object' && h !== null && 'hash' in h) h = Number(h.hash);
    return hashToName.get(h >>> 0) ?? ('0x' + (h >>> 0).toString(16).padStart(8, '0'));
  };

  const anmCache = new Map();
  async function getAnmInfo(anmRelPath) {
    const full = resolveExtracted(anmRelPath);
    if (!full) return null;
    if (!anmCache.has(full)) {
      const info = decodeAnm(await readFile(full));
      anmCache.set(full, {
        duration: info.duration,
        fps: info.fps,
        lastFrame: Math.round(info.duration * info.fps * 100) / 100,
        fullPath: full,
      });
    }
    return anmCache.get(full);
  }

  const uncompressedFallbackRoot = '/home/aiapps/workspace/set13-worktrees/boards/assets3d-local/test-server-v7-uncompressed';
  const reportRows = [];
  const modifiedModels = new Map();

  for (const [id, cfg] of unitEntries) {
    if (onlySet && !onlySet.has(id)) continue;
    const entry = nextManifest.models[id];
    if (!entry) continue;

    const dir = cfg.sourceName.toLowerCase();
    const metaPath = join(resolvedMeta, dir, 'metadata.json');
    if (!existsSync(metaPath)) continue;
    const meta = JSON.parse(await readFile(metaPath, 'utf8'));
    const record = meta.find(o => o.class === 'TFTCharacterRecord');
    if (!record) continue;

    const spellNames = metaItems(metaField(record.root, 'spellNames')).map(metaText).filter(Boolean);
    const basicAttackName = metaText(metaField(metaField(record.root, 'basicAttack'), 'mAttackName'));
    const spellObjs = new Map();
    for (const o of meta.filter(o => o.class === 'SpellObject')) {
      const sName = metaText(metaField(o.root, 'mScriptName')) ?? o.name?.split('/').at(-1) ?? '';
      const anim = metaText(metaField(metaField(o.root, 'mSpell'), 'mAnimationName'));
      spellObjs.set(sName.toLowerCase(), { scriptName: sName, anim });
    }
    for (const o of meta.filter(o => o.class === 'AnimationGraphData')) {
      const m = metaField(o.root, 'mClipDataMap');
      if (m?.type === 'map') {
        for (const e of m.entries) {
          if (typeof e.key === 'string' && !e.key.startsWith('0x')) {
            hashToName.set(fnv1a(e.key), e.key);
          }
        }
      }
    }

    const skin0 = resolveExtracted(`data/characters/${dir}/skins/skin0.bin`);
    if (!skin0) continue;
    const docs = [parseBin(await readFile(skin0))];
    for (const extra of [`data/characters/${dir}/skins/root.bin`, `characters/${dir}`]) {
      const f = resolveExtracted(extra);
      if (f) docs.push(parseBin(await readFile(f)));
    }
    const binding = skinBindings(docs, []);
    const graphPaths = [...new Set(docs.flatMap(d => d.linked).filter(p => /\/animations\/.*\.bin$/i.test(p)))];
    const graphDocs = [...docs];
    for (const gp of graphPaths) {
      const f = resolveExtracted(gp);
      if (f) graphDocs.push(parseBin(await readFile(f)));
    }
    const graphEntries = graphDocs.flatMap(d => d.entries).filter(e => e.hash === binding.animationGraphHash);
    const graphClips = new Map();
    const graphMasks = new Map();
    let jointNames = null;
    const clipNameToAnmPath = new Map();
    for (const e of graphEntries) {
      const g = bField(e, 'animationGraphData') ?? e;
      for (const [k, mask] of bField(g, 'mMaskDataMap')?.entries ?? []) {
        const mHash = (typeof k === 'object' && k ? Number(k.hash) : typeof k === 'string' ? fnv1a(k) : k) >>> 0;
        const list = bField(mask, 'mWeightList');
        if (Array.isArray(list)) graphMasks.set(mHash, list.map(Number));
      }
      for (const [k, clip] of bField(g, 'mClipDataMap')?.entries ?? []) {
        const p = bField(bField(clip, 'mAnimationResourceData'), 'mAnimationFilePath') ?? bField(clip, 'mAnimationFilePath');
        if (typeof p === 'string') {
          const glbName = sourceName(p);
          if (glbName && !clipNameToAnmPath.has(glbName)) clipNameToAnmPath.set(glbName, p);
          const base = p.split('/').at(-1).replace(/(?:\.tft_set13(?:_evolved|_macaomode)?)?\.anm$/i, '');
          if (!hashToName.has(fnv1a(base))) hashToName.set(fnv1a(base), base);
          const stripped = base.replace(new RegExp(`^${dir}_`, 'i'), '').replace(/^tft13_[a-z0-9]+_/i, '');
          if (stripped && !hashToName.has(fnv1a(stripped))) hashToName.set(fnv1a(stripped), stripped);
        }
        const kHash = (typeof k === 'string' ? fnv1a(k) : k.hash) >>> 0;
        const kName = typeof k === 'string' ? k : nameOf(kHash);
        graphClips.set(kHash, { keyName: kName, keyHash: kHash, node: clip });
      }
    }

    async function resolveNode(kHash, visited = new Set()) {
      if (visited.has(kHash)) return { kind: 'Cycle', keyName: nameOf(kHash), keyHash: kHash };
      visited.add(kHash);
      const item = graphClips.get(kHash >>> 0);
      if (!item) return null;
      const { keyName, node } = item;
      const cls = nameOf(node.type);
      if (cls === 'AtomicClipData') {
        const anmPath = bField(bField(node, 'mAnimationResourceData'), 'mAnimationFilePath') ?? bField(node, 'mAnimationFilePath');
        const startFrame = bField(node, 'StartFrame');
        const endFrame = bField(node, 'EndFrame');
        const anm = await getAnmInfo(anmPath);
        const clipName = anmPath ? sourceName(anmPath) : null;
        if (clipName && anmPath && !clipNameToAnmPath.has(clipName)) {
          clipNameToAnmPath.set(clipName, anmPath);
        }
        const sf = startFrame != null ? Math.max(0, startFrame) : 0;
        const ef = endFrame != null ? endFrame : (anm ? anm.lastFrame : 0);
        const fps = anm?.fps ?? 30;
        const dur = anm ? Math.max(0, (ef - sf) / fps) : 0;
        const maskKey = bField(node, 'mMaskDataName');
        const maskHash = maskKey == null ? null : (typeof maskKey === 'object' ? Number(maskKey.hash) : typeof maskKey === 'string' ? fnv1a(maskKey) : maskKey) >>> 0;
        const mask = maskHash == null ? null : maskBoneWeights(graphMasks.get(maskHash), jointNames);
        return {
          kind: 'Atomic',
          ...(mask ? { mask } : {}),
          keyName,
          keyHash: kHash >>> 0,
          anmPath,
          clipName,
          glbName: clipName,
          startFrame: startFrame ?? null,
          endFrame: endFrame ?? null,
          effectiveStartFrame: sf,
          effectiveEndFrame: ef,
          fps,
          anmDuration: anm?.duration ?? 0,
          lastFrame: anm?.lastFrame ?? null,
          duration: dur,
        };
      }
      if (cls === 'SequencerClipData' || cls === 'ParallelClipData') {
        const list = bField(node, 'mClipNameList') ?? [];
        const children = [];
        for (const c of list) {
          const ch = (typeof c === 'string' ? fnv1a(c) : c.hash) >>> 0;
          const r = await resolveNode(ch, new Set(visited));
          if (r) children.push(r);
        }
        return {
          kind: cls === 'SequencerClipData' ? 'Sequencer' : 'Parallel',
          keyName,
          keyHash: kHash >>> 0,
          children,
        };
      }
      if (cls === 'ConditionBoolClipData') {
        const updater = bField(node, 'Updater');
        const updaterClass = updater && typeof updater === 'object' && 'type' in updater ? nameOf(updater.type) : null;
        const branches = {};
        for (const [label, field] of [['true', 'mTrueConditionClipName'], ['false', 'mFalseConditionClipName']]) {
          const c = bField(node, field);
          if (c == null) continue;
          const ch = (typeof c === 'string' ? fnv1a(c) : c.hash) >>> 0;
          const r = await resolveNode(ch, new Set(visited));
          if (r) branches[label] = r;
        }
        return { kind: 'ConditionBool', keyName, keyHash: kHash >>> 0, updater: updaterClass, branches };
      }
      if (cls === 'SelectorClipData') return { kind: 'Selector', keyName, keyHash: kHash >>> 0 };
      if (cls === 'ParametricClipData') return { kind: 'Parametric', keyName, keyHash: kHash >>> 0 };
      return { kind: 'Unknown', keyName, keyHash: kHash >>> 0 };
    }

    const deployedGlbPath = id === 'jayce' && existsSync('/tmp/jayce-form-stage/models/jayce/model.glb')
      ? '/tmp/jayce-form-stage/models/jayce/model.glb'
      : join(resolvedAssets, entry.path);
    const deployedBytes = await readFile(deployedGlbPath);
    const existingClips = getGlbClipNames(deployedBytes);
    jointNames = getGlbJointNames(deployedBytes);
    const neededMissingClips = new Set();

    // 1. Cast
    const castKey = `${id}:cast`;
    const targetSpellScript = spellNames[0] ?? '';
    const spObj = spellObjs.get(targetSpellScript.toLowerCase());
    const rawSpellAnim = spObj?.anim;
    let origCastNode = null;
    if (Object.hasOwn(CAST_GRAPH_KEY_OVERRIDES, id)) {
      origCastNode = await resolveNode(graphKeyHash(CAST_GRAPH_KEY_OVERRIDES[id]));
      if (!origCastNode) throw new Error(`cast-graph-key-missing: ${id}:${CAST_GRAPH_KEY_OVERRIDES[id]}`);
    }
    if (!origCastNode && rawSpellAnim) origCastNode = await resolveNode(fnv1a(rawSpellAnim));
    if (!origCastNode && !rawSpellAnim) {
      origCastNode = await buildScriptCastNode(id, key => resolveNode(fnv1a(key)));
    }
    if (!origCastNode) {
      const fallbackKeys = castFallbackKeys(id);
      for (const fk of fallbackKeys) {
        const kh = fk.startsWith('0x') ? Number.parseInt(fk, 16) : fnv1a(fk);
        const r = await resolveNode(kh);
        if (r) { origCastNode = r; break; }
      }
    }

    if (excludeSet.has(castKey)) {
      reportRows.push({
        id,
        action: 'cast',
        nodeDesc: formatNodeSummary(origCastNode),
        fieldChange: '—',
        addedClips: [],
        skipReason: '不在本单范围 (--exclude)',
      });
    } else if (id === 'amumu' && entry.animations?.cast === null) {
      reportRows.push({
        id,
        action: 'cast',
        nodeDesc: '无施法动作',
        fieldChange: '—',
        addedClips: [],
        skipReason: '被动无施法动作',
      });
    } else {
      const otherUsedClips = new Set(
        Object.entries(entry.animations ?? {})
          .filter(([k, v]) => k !== 'cast' && typeof v === 'string')
          .map(([, v]) => v),
      );
      const plan = planGraphAction(origCastNode, { action: 'cast', entry, otherUsedClips });
      if (plan.status === 'skipped') {
        reportRows.push({
          id,
          action: 'cast',
          nodeDesc: formatNodeSummary(origCastNode),
          fieldChange: '—',
          addedClips: [],
          skipReason: plan.reason,
        });
      } else {
        const missingForCast = plan.requiredClips.filter(c => !existingClips.has(c));
        const flattenStages = seq => {
          if (!seq) return [];
          const main = Array.isArray(seq.main) ? seq.main.join('|') : seq.main;
          return [seq.in, seq.hold, main, seq.out].filter(Boolean);
        };
        const effectiveOldSeq = entry.castSequence ?? (entry.animations?.cast ? { main: entry.animations.cast } : undefined);
        const stagesChanged = JSON.stringify(flattenStages(effectiveOldSeq)) !== JSON.stringify(flattenStages(plan.castSequence));
        const layersChanged = JSON.stringify(effectiveOldSeq?.layers ?? []) !== JSON.stringify(plan.castSequence.layers ?? [])
          || JSON.stringify(effectiveOldSeq?.masks ?? {}) !== JSON.stringify(plan.castSequence.masks ?? {});
        const seqChanged = stagesChanged || layersChanged;

        const nextRanges = { ...(entry.clipRanges ?? {}) };
        for (const wc of (seqChanged ? plan.wholeClips : plan.mergedWholeClips)) {
          delete nextRanges[wc];
        }
        if (seqChanged) {
          for (const oldClip of flattenStages(entry.castSequence)) {
            if (!plan.requiredClips.includes(oldClip) && !otherUsedClips.has(oldClip)) {
              delete nextRanges[oldClip];
            }
          }
        }
        for (const [k, v] of Object.entries(plan.clipRanges)) nextRanges[k] = v;

        const nextSegments = { ...(entry.clipSegments ?? {}), ...plan.clipSegments };
        const rangesChanged = JSON.stringify(entry.clipRanges ?? {}) !== JSON.stringify(nextRanges);
        const segmentsChanged = JSON.stringify(entry.clipSegments ?? {}) !== JSON.stringify(nextSegments);

        if (seqChanged || rangesChanged || segmentsChanged || missingForCast.length > 0) {
          for (const c of missingForCast) neededMissingClips.add(c);
          const oldDesc = JSON.stringify({
            castSequence: entry.castSequence,
            ...(rangesChanged ? { clipRanges: entry.clipRanges } : {}),
            ...(segmentsChanged ? { clipSegments: entry.clipSegments } : {}),
          });
          entry.castSequence = plan.castSequence;
          if (
            typeof plan.castSequence.main === 'string'
            && !plan.castSequence.main.includes('@')
            && !plan.castSequence.in
            && !plan.castSequence.hold
            && !plan.castSequence.out
          ) {
            entry.animations = { ...entry.animations, cast: plan.castSequence.main };
          }
          if (Object.keys(nextRanges).length > 0) entry.clipRanges = nextRanges;
          else delete entry.clipRanges;
          if (Object.keys(nextSegments).length > 0) entry.clipSegments = nextSegments;
          else delete entry.clipSegments;

          const newDesc = JSON.stringify({
            castSequence: entry.castSequence,
            ...(rangesChanged ? { clipRanges: entry.clipRanges } : {}),
            ...(segmentsChanged ? { clipSegments: entry.clipSegments } : {}),
          });
          reportRows.push({
            id,
            action: 'cast',
            nodeDesc: formatNodeSummary(origCastNode),
            fieldChange: `${oldDesc} → ${newDesc}`,
            addedClips: missingForCast,
            skipReason: entry.castVariants?.hero ? '已更新 castSequence（hero 变体见 cast (hero) 行）' : '已更新',
            applyRollback: null,
          });
        } else {
          reportRows.push({
            id,
            action: 'cast',
            nodeDesc: formatNodeSummary(origCastNode),
            fieldChange: '—',
            addedClips: [],
            skipReason: '已一致',
          });
        }
      }
    }

    // 1c. Hand-authored cast rotation (one sequence per rotating spell)
    const rotateSpells = ROTATE_SPELLS[id];
    const rotate = entry.castVariants?.rotate;
    if (rotateSpells && Array.isArray(rotate) && rotate.length === rotateSpells.length && !excludeSet.has(`${id}:cast-rotate`)) {
      const otherUsedClips = new Set(
        Object.entries(entry.animations ?? {})
          .filter(([k, v]) => k !== 'cast' && typeof v === 'string')
          .map(([, v]) => v),
      );
      const nextRotate = [...rotate];
      let nextRanges = { ...(entry.clipRanges ?? {}) };
      let nextSegments = { ...(entry.clipSegments ?? {}) };
      const rotateMissing = [];
      for (let i = 0; i < rotateSpells.length; i++) {
        const { script, graphKey } = rotateSpells[i];
        const anim = spellObjs.get(script.toLowerCase())?.anim;
        const node = (anim ? await resolveNode(fnv1a(anim)) : null) ?? await resolveNode(fnv1a(graphKey));
        const plan = planRotateEntry(node, { entry: { clipRanges: nextRanges }, otherUsedClips });
        const label = `cast (rotate[${i}])`;
        if (plan.status !== 'ok') {
          reportRows.push({ id, action: label, nodeDesc: formatNodeSummary(node), fieldChange: '—', addedClips: [], skipReason: plan.reason });
          continue;
        }
        if (JSON.stringify(rotate[i]) === JSON.stringify(plan.rotateEntry)) {
          reportRows.push({ id, action: label, nodeDesc: formatNodeSummary(node), fieldChange: '—', addedClips: [], skipReason: '已一致' });
          continue;
        }
        const missing = plan.requiredClips.filter(c => !existingClips.has(c));
        rotateMissing.push(...missing);
        nextRotate[i] = plan.rotateEntry;
        nextRanges = { ...nextRanges, ...plan.clipRanges };
        nextSegments = { ...nextSegments, ...plan.clipSegments };
        reportRows.push({
          id,
          action: label,
          nodeDesc: formatNodeSummary(node),
          fieldChange: `castVariants.rotate[${i}]: ${JSON.stringify(rotate[i])} → ${JSON.stringify(plan.rotateEntry)}`,
          addedClips: missing,
          skipReason: '已更新',
        });
      }
      for (const c of rotateMissing) neededMissingClips.add(c);
      entry.castVariants = { ...entry.castVariants, rotate: nextRotate };
      if (Object.keys(nextRanges).length > 0) entry.clipRanges = nextRanges;
      if (Object.keys(nextSegments).length > 0) entry.clipSegments = nextSegments;
    }

    // 1b. Hero-augment cast variant: follow the original `<Spell>Hero` SpellObject's mAnimationName.
    if (entry.castVariants?.hero && !excludeSet.has(`${id}:hero`)) {
      const heroObj = spellObjs.get(`${targetSpellScript}hero`.toLowerCase());
      const heroNode = heroObj?.anim ? await resolveNode(fnv1a(heroObj.anim)) : null;
      const heroPlan = planHeroVariant(heroNode, { entry });
      if (heroPlan.status !== 'ok') {
        reportRows.push({
          id, action: 'cast (hero)', nodeDesc: formatNodeSummary(heroNode), fieldChange: '—', addedClips: [],
          skipReason: `保留 castVariants.hero（${heroPlan.reason}）`,
        });
      } else {
        const missingForHero = heroPlan.requiredClips.filter(c => !existingClips.has(c));
        for (const c of missingForHero) neededMissingClips.add(c);
        const oldDesc = JSON.stringify({ castVariants: entry.castVariants });
        const nextVariantsChanged = JSON.stringify(entry.castVariants) !== JSON.stringify(heroPlan.castVariants);
        if (heroPlan.castVariants) entry.castVariants = heroPlan.castVariants;
        else delete entry.castVariants;
        reportRows.push({
          id, action: 'cast (hero)', nodeDesc: formatNodeSummary(heroNode),
          fieldChange: nextVariantsChanged
            ? `${oldDesc} → ${entry.castVariants ? JSON.stringify({ castVariants: entry.castVariants }) : '删除 castVariants（hero 走默认施法）'}`
            : '—',
          addedClips: missingForHero, skipReason: nextVariantsChanged ? '已更新' : '已一致',
        });
      }
    }

    // 2. Attack (including Gangplank ranged form)
    const atkKey = `${id}:attack`;
    const targetAtkScript = basicAttackName ?? '';
    const atkObj = spellObjs.get(targetAtkScript.toLowerCase());
    const effectiveAtkAnim = atkObj?.anim || 'Attack1';
    const origAtkNode = await resolveNode(fnv1a(effectiveAtkAnim));

    if (excludeSet.has(atkKey)) {
      reportRows.push({
        id,
        action: 'attack',
        nodeDesc: formatNodeSummary(origAtkNode),
        fieldChange: '—',
        addedClips: [],
        skipReason: '不在本单范围 (--exclude)',
      });
    } else if (id === 'gangplank') {
      const rangedClip = 'tft13_gangplank_attack1_ranged';
      const meleeClip = entry.animations?.attack ?? 'tft13_gangplank_attack1_melee';
      const missingGp = existingClips.has(rangedClip) ? [] : [rangedClip];
      for (const c of missingGp) neededMissingClips.add(c);
      const oldForm = JSON.stringify(entry.formAnimations ?? null);
      entry.formAnimations = {
        ...entry.formAnimations,
        front: { ...entry.formAnimations?.front, attack: meleeClip },
        back: { ...entry.formAnimations?.back, attack: rangedClip },
      };
      reportRows.push({
        id,
        action: 'attack (back)',
        nodeDesc: 'Atomic: `tft13_gangplank_attack1_ranged` (全段)',
        fieldChange: `formAnimations: ${oldForm} → ${JSON.stringify(entry.formAnimations)}`,
        addedClips: missingGp,
        skipReason: '已更新',
      });
    } else {
      const plan = planGraphAction(origAtkNode, { action: 'attack', entry });
      if (plan.status === 'skipped') {
        reportRows.push({
          id,
          action: 'attack',
          nodeDesc: formatNodeSummary(origAtkNode),
          fieldChange: '—',
          addedClips: [],
          skipReason: plan.reason,
        });
      } else {
        const missingForAtk = plan.requiredClips.filter(c => !existingClips.has(c));
        if (plan.attackSequence) {
          const oldVal = JSON.stringify(entry.attackSequence ?? entry.animations?.attack ?? null);
          const changed = JSON.stringify(entry.attackSequence) !== JSON.stringify(plan.attackSequence) || missingForAtk.length > 0;
          if (changed) {
            for (const c of missingForAtk) neededMissingClips.add(c);
            entry.attackSequence = plan.attackSequence;
            reportRows.push({
              id,
              action: 'attack',
              nodeDesc: formatNodeSummary(origAtkNode),
              fieldChange: `attackSequence: ${oldVal} → ${JSON.stringify(plan.attackSequence)}`,
              addedClips: missingForAtk,
              skipReason: '已更新',
            });
          } else {
            reportRows.push({
              id,
              action: 'attack',
              nodeDesc: formatNodeSummary(origAtkNode),
              fieldChange: '—',
              addedClips: [],
              skipReason: '已一致',
            });
          }
        } else if (plan.attackClip && plan.attackClip !== entry.animations?.attack) {
          for (const c of missingForAtk) neededMissingClips.add(c);
          const oldAtk = entry.animations?.attack ?? null;
          entry.animations = { ...entry.animations, attack: plan.attackClip };
          reportRows.push({
            id,
            action: 'attack',
            nodeDesc: formatNodeSummary(origAtkNode),
            fieldChange: `animations.attack: ${JSON.stringify(oldAtk)} → ${JSON.stringify(plan.attackClip)}`,
            addedClips: missingForAtk,
            skipReason: '已更新',
          });
        } else {
          reportRows.push({
            id,
            action: 'attack',
            nodeDesc: formatNodeSummary(origAtkNode),
            fieldChange: '—',
            addedClips: [],
            skipReason: '已一致',
          });
        }
      }
    }

    // 3. Append missing clips to GLB if needed
    if (neededMissingClips.size > 0) {
      let workingBytes = deployedBytes;
      if (!isUncompressedGlb(workingBytes)) {
        const fallbackPath = join(uncompressedFallbackRoot, entry.path);
        if (existsSync(fallbackPath)) {
          workingBytes = await readFile(fallbackPath);
        }
      }
      const currentNames = isUncompressedGlb(workingBytes) ? getGlbClipNames(workingBytes) : new Set();
      const allTargetClips = new Set([...existingClips, ...neededMissingClips]);
      const clipsToAdd = [...allTargetClips].filter(c => !currentNames.has(c));
      const reportedAddedClips = [...neededMissingClips];

      const sknPath = resolveExtracted(`${cfg.base}/${cfg.mesh}`);
      const sklPath = resolveExtracted(`${cfg.base}/${cfg.skeleton}`);
      if (!sknPath || !sklPath) {
        nextManifest.models[id] = structuredClone(baseManifest.models[id]);
        for (const r of reportRows.filter(row => row.id === id && row.addedClips.length > 0)) {
          r.fieldChange = '—';
          r.skipReason = '缺少 skn/skl 源文件';
        }
        continue;
      }
      const clipPayloads = [];
      let missingAnm = null;
      for (const clipName of clipsToAdd) {
        const mappedRel = cfg.animationFiles?.[clipName] ? `${cfg.base}/${cfg.animationFiles[clipName]}` : null;
        const graphRel = clipNameToAnmPath.get(clipName);
        const fullAnm = resolveExtracted(mappedRel) ?? resolveExtracted(graphRel)
          ?? resolveExtracted(`${cfg.base}/animations/${clipName}.anm`);
        if (!fullAnm) {
          missingAnm = clipName;
          break;
        }
        clipPayloads.push({ name: clipName, bytes: await readFile(fullAnm) });
      }
      if (missingAnm) {
        nextManifest.models[id] = structuredClone(baseManifest.models[id]);
        for (const r of reportRows.filter(row => row.id === id && row.addedClips.length > 0)) {
          r.fieldChange = '—';
          r.skipReason = `缺少 anm 文件 (${missingAnm})`;
        }
        continue;
      }

      try {
        const [sknBytes, sklBytes] = await Promise.all([readFile(sknPath), readFile(sklPath)]);
        const originalDoc = readGlbDocument(workingBytes);
        const hiddenSubmeshes = [];
        const solidMaterials = {};
        for (const sub of inspectSkn(sknBytes).submeshes) {
          const hasMat = (originalDoc.materials ?? []).some(m => m.name === sub.name);
          if (!hasMat) hiddenSubmeshes.push(sub.name);
          else solidMaterials[sub.name] = { factor: [1, 1, 1, 1] };
        }
        let donorGlb = makeModel(sknBytes, sklBytes, clipPayloads, {}, { hiddenSubmeshes, solidMaterials }).glb;
        if (!isUncompressedGlb(workingBytes)) {
          workingBytes = donorGlb;
        } else {
          donorGlb = alignDonorRootOffset(workingBytes, donorGlb);
        }
        for (const clipName of clipsToAdd) {
          if (!currentNames.has(clipName)) {
            workingBytes = appendCastClip(workingBytes, donorGlb, clipName);
          }
        }
        validateModel(workingBytes);
        const origLog = console.log;
        const origWarn = console.warn;
        let compressed;
        try {
          console.log = () => {};
          console.warn = () => {};
          compressed = await compressModelGlb(workingBytes);
        } finally {
          console.log = origLog;
          console.warn = origWarn;
        }
        modifiedModels.set(id, { path: entry.path, bytes: compressed, addedClips: reportedAddedClips });
      } catch (err) {
        nextManifest.models[id] = structuredClone(baseManifest.models[id]);
        for (const r of reportRows.filter(row => row.id === id && row.addedClips.length > 0)) {
          r.fieldChange = '—';
          r.skipReason = `追加片段失败 (${err.message})`;
        }
      }
    } else if (id === 'jayce' && existsSync('/tmp/jayce-form-stage/models/jayce/model.glb')) {
      // Preserve staged jayce form model if present
      modifiedModels.set('jayce', {
        path: entry.path,
        bytes: await readFile('/tmp/jayce-form-stage/models/jayce/model.glb'),
        addedClips: [],
      });
    }
  }

  const { assertManifest } = await contracts();
  assertManifest(nextManifest);

  await mkdir(resolvedOut, { recursive: true });
  await writeFile(join(resolvedOut, 'manifest.json'), `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
  for (const [id, mod] of modifiedModels) {
    const canonicalOutPath = join(resolvedOut, 'models', id, 'model.glb');
    await mkdir(dirname(canonicalOutPath), { recursive: true });
    await writeFile(canonicalOutPath, mod.bytes);
    const relTargetPath = join(resolvedOut, mod.path);
    if (relTargetPath !== canonicalOutPath) {
      await mkdir(dirname(relTargetPath), { recursive: true });
      await writeFile(relTargetPath, mod.bytes);
    }
  }

  const lines = [
    '# 全英雄施法/普攻动画序列按原版动画图生成报告',
    '',
    `- **输入素材根**：\`${resolvedAssets}\``,
    `- **解包根**：\`${extractedRoots.join(', ')}\``,
    `- **元数据根**：\`${resolvedMeta}\``,
    `- **输出目录**：\`${resolvedOut}\``,
    `- **修改模型数（重打包 GLB）**：${[...modifiedModels.values()].filter(m => m.addedClips.length > 0).length}`,
    `- **更新条目数**：${reportRows.filter(r => r.fieldChange !== '—').length}`,
    '',
    '## 一、 本次更新的英雄与动作明细',
    '',
    '| 英雄 | 动作 | 原版节点类型与段 | 写入的字段（旧值 → 新值） | 新增片段 | 状态 |',
    '| :--- | :--- | :--- | :--- | :--- | :--- |',
  ];

  for (const row of reportRows.filter(r => r.fieldChange !== '—')) {
    const added = row.addedClips.length ? row.addedClips.map(c => `\`${c}\``).join(', ') : '—';
    lines.push(`| \`${row.id}\` | ${row.action} | ${row.nodeDesc} | \`${row.fieldChange}\` | ${added} | ${row.skipReason} |`);
  }

  lines.push(
    '',
    '## 二、 全量英雄处理与跳过明细表',
    '',
    '| 英雄 | 动作 | 原版节点类型与段 | 写入的字段（旧值 → 新值） | 新增片段 | 状态 / 跳过原因 |',
    '| :--- | :--- | :--- | :--- | :--- | :--- |',
  );

  for (const row of reportRows) {
    const added = row.addedClips.length ? row.addedClips.map(c => `\`${c}\``).join(', ') : '—';
    const change = row.fieldChange === '—' ? '—' : `\`${row.fieldChange}\``;
    lines.push(`| \`${row.id}\` | ${row.action} | ${row.nodeDesc} | ${change} | ${added} | ${row.skipReason} |`);
  }

  const markdown = `${lines.join('\n')}\n`;
  return {
    manifest: nextManifest,
    modifiedModels: [...modifiedModels.keys()],
    reportRows,
    markdown,
  };
}

function parseCliArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!value) throw new Error(`missing-argument-value:${flag}`);
    if (flag === '--assets') options.assetsRoot = value;
    else if (flag === '--extracted') options.extractedRoot = value;
    else if (flag === '--metadata-root') options.metadataRoot = value;
    else if (flag === '--out-dir') options.outDir = value;
    else if (flag === '--only') options.only = value;
    else if (flag === '--exclude') options.exclude = value;
    else if (flag === '--unit-map') options.unitMapPath = value;
    else throw new Error(`invalid-argument:${flag}`);
  }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseCliArgs(process.argv.slice(2));
  const result = await stageAnimSequences(args);
  if (resolve(args.outDir) === '/data/aiapps/anim-seq/stage') {
    await mkdir('/data/aiapps/anim-seq/out', { recursive: true });
    await writeFile('/tmp/anim-seq-report.md', result.markdown, 'utf8');
    await writeFile('/data/aiapps/anim-seq/out/anim-seq-report.md', result.markdown, 'utf8');
  }
  process.stdout.write(result.markdown);
}
