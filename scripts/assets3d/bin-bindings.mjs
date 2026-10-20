import { binField as field, binIs, fnv1a } from './bin.mjs';
export const canonicalAsset = path => path.toLowerCase().replaceAll('\\', '/').replaceAll('.tft_set13', '');
/** Only initial diffuse bindings, not shader/dynamic driver evaluation. */
export function skinBindings(documents, submeshes) {
  if (documents.some(d => d.patches.length)) throw new Error('unsupported-binding-bin-patches');
  const entries = documents.flatMap(d => d.entries), skin = entries.find(e =>
    (binIs(e, 'SkinCharacterDataProperties') || binIs(e, 'TftSkinCharacterDataProperties')) && field(e, 'skinMeshProperties'));
  if (!skin) throw new Error('missing-skin-mesh-properties');
  const mesh = field(skin, 'skinMeshProperties'), byHash = new Map();
  for (const e of entries) {
    // skin0 and root can have distinct entries; conflicting definitions must not be order dependent.
    if (byHash.has(e.hash) && binIs(e, 'StaticMaterialDef')) throw new Error('duplicate-material-entry');
    byHash.set(e.hash, e);
  }
  function diffuse(object) {
    const material = field(object, 'material');
    if (material && material.hash !== 0) {
      const def = material.fields ? material : byHash.get(typeof material === 'string' ? fnv1a(material) : material.hash);
      if (!binIs(def, 'StaticMaterialDef')) throw new Error(`missing-static-material:${material.hash}`);
      for (const name of ['diffuse_texture', 'diffusetexture', 'basecolor_texture', 'albedo_texture']) {
        const paths = [...new Set((field(def, 'samplerValues') ?? []).filter(s => field(s, 'samplerName')?.toLowerCase() === name)
          .map(s => field(s, 'textureName')).filter(Boolean))];
        if (paths.length > 1) throw new Error('ambiguous-material-diffuse');
        if (paths.length) return paths[0];
      }
      const glass = (field(def, 'paramValues') ?? []).find(p => field(p, 'name')?.toLowerCase() === 'glass_color1');
      const color = field(glass, 'value');
      if (Array.isArray(color) && color.length === 4)
        return { factor: [...color.slice(0, 3).map(v => Math.max(0, Math.min(1, v))), 1],
          reason: 'procedural-glass-flat-color-approximation', material: field(def, 'name') };
      throw new Error(`missing-material-diffuse:${material.hash}`);
    }
    return field(object, 'texture');
  }
  const overrides = field(mesh, 'materialOverride') ?? [], textures = {}, solidMaterials = {};
  const hide = field(mesh, 'initialSubmeshToHide') ?? '';
  const hidden = (Array.isArray(hide) ? hide : hide.split(/[\s,;]+/)).filter(Boolean);
  const seen = new Set();
  for (const o of overrides) {
    const name = field(o, 'submesh');
    if (typeof name !== 'string' || seen.has(name.toLowerCase())) throw new Error('invalid-material-override');
    seen.add(name.toLowerCase());
  }
  for (const name of submeshes) {
    const override = overrides.find(o => field(o, 'submesh').toLowerCase() === name.toLowerCase());
    const path = diffuse(override ?? mesh);
    if (typeof path === 'string') textures[name] = path;
    else if (path) solidMaterials[name] = path;
  }
  return { mesh: field(mesh, 'simpleSkin'), skeleton: field(mesh, 'skeleton'), textures, solidMaterials,
    animationGraphHash: field(field(skin, 'skinAnimationProperties'), 'animationGraphData')?.hash ?? null,
    hidden: submeshes.filter(n => hidden.some(h => h.toLowerCase() === n.toLowerCase())) };
}
export function animationClips(documents) {
  const clips = [];
  for (const doc of documents) {
    if (doc.patches.length) throw new Error('unsupported-binding-bin-patches');
    for (const e of doc.entries) {
      const graph = field(e, 'animationGraphData') ?? e;
      for (const [key, clip] of field(graph, 'mClipDataMap')?.entries ?? []) {
        const path = field(field(clip, 'mAnimationResourceData'), 'mAnimationFilePath') ?? field(clip, 'mAnimationFilePath');
        clips.push({ hash: typeof key === 'string' ? fnv1a(key) : key.hash,
          ...(typeof key === 'string' ? { name: key } : {}),
          type: clip?.type ?? 0, atomic: binIs(clip, 'AtomicClipData'), flags: field(clip, 'mFlags') ?? 0,
          path: typeof path === 'string' ? path : null });
      }
    }
  }
  return clips;
}
const sourceName = path => path.split('/').at(-1).replace(/(?:\.tft_set13)?\.anm$/i, '').toLowerCase();
/** Exact graph aliases first; filename token priorities only when aliases cannot resolve.
 * Equal-priority different paths are ambiguous and omitted. No sequence flattening. */
export function selectAnimations(clips, rules, explicit = {}) {
  const atomic = clips.filter(c => c.atomic && c.path), mapped = {}, files = {}, decisions = {};
  for (const [action, rule] of Object.entries(rules)) {
    const matches = (name, token) => new RegExp(`(?:^|_)${token}(?:_|$)`, 'i').test(name);
    // Exclusions apply to aliases as well: an alias named Hit can still point at Spell1_Hit.
    const eligible = atomic.filter(c => !(rule.excludeTokens ?? []).some(t => matches(sourceName(c.path), t)));
    let candidates = [], method = 'graph-alias';
    if (explicit[action]) { candidates = eligible.filter(c => sourceName(c.path) === explicit[action].toLowerCase()); method = 'unit-explicit'; }
    else {
      for (const alias of rule.aliases) { candidates = eligible.filter(c => c.hash === fnv1a(alias)); if (candidates.length) break; }
      if (!candidates.length) { method = 'filename-token';
        for (const token of rule.tokens) {
          candidates = eligible.filter(c => matches(sourceName(c.path), token)); if (candidates.length) break; }
      }
    }
    const paths = [...new Map(candidates.map(c => [canonicalAsset(c.path), c.path])).values()];
    if (paths.length !== 1) {
      const evidence = clips.some(c => (!c.atomic || eligible.includes(c)) && rule.aliases.some(a => c.hash === fnv1a(a))) || (rule.evidenceTokens ? atomic : eligible).some(c =>
        (rule.evidenceTokens ?? rule.tokens).some(t => matches(sourceName(c.path), t)));
      decisions[action] = { reason: paths.length ? 'ambiguous-action' : 'missing-atomic-action', candidates: paths,
        sourceStatus: explicit[action] || evidence ? 'undetermined' : 'no-source-action' }; continue;
    }
    const path = paths[0], name = sourceName(path);
    if (files[name] && canonicalAsset(files[name]) !== canonicalAsset(path)) throw new Error('animation-name-collision');
    mapped[action] = name; files[name] = path;
    decisions[action] = { method, path, graphHashes: candidates.map(c => c.hash.toString(16)), flags: [...new Set(candidates.map(c => c.flags))] };
  }
  return { mapped, files, decisions };
}
