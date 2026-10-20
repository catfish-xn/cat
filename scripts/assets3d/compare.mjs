import { Matrix4, Quaternion, Vector3 } from 'three';
import { readGlb, summarizeGlb } from './glb.mjs';
import { readAccessor } from './model.mjs';
function duration(parsed, animation) {
    return Math.max(...animation.samplers.flatMap(s => readAccessor(parsed, s.input).flat()));
}
function worldPose(parsed, animation, time) {
    const d = parsed.document, poses = d.nodes.map(n => ({ translation: n.translation ?? [0, 0, 0], rotation: n.rotation ?? [0, 0, 0, 1], scale: n.scale ?? [1, 1, 1] }));
    for (const c of animation.channels) {
        const s = animation.samplers[c.sampler], times = readAccessor(parsed, s.input).flat(), values = readAccessor(parsed, s.output);
        let i = 0;
        while (i < times.length - 2 && times[i + 1] < time)
            i++;
        const j = Math.min(i + 1, times.length - 1), t = Math.max(0, Math.min(1, (time - times[i]) / (times[j] - times[i]) || 0));
        poses[c.target.node][c.target.path] = c.target.path === 'rotation' ? new Quaternion(...values[i]).slerp(new Quaternion(...values[j]), t).normalize().toArray() : values[i].map((v, k) => v + (values[j][k] - v) * t);
    }
    const parents = new Map();
    d.nodes.forEach((n, i) => (n.children ?? []).forEach(child => parents.set(child, i)));
    const world = new Map(), active = new Set();
    function matrix(i) {
        if (world.has(i))
            return world.get(i);
        if (active.has(i))
            throw new Error('cyclic-gltf-hierarchy');
        active.add(i);
        const p = poses[i], m = d.nodes[i].matrix ? new Matrix4().fromArray(d.nodes[i].matrix) : new Matrix4().compose(new Vector3(...p.translation), new Quaternion(...p.rotation).normalize(), new Vector3(...p.scale));
        if (parents.has(i))
            m.premultiply(matrix(parents.get(i)));
        active.delete(i);
        world.set(i, m);
        return m;
    }
    return new Map(d.skins[0].joints.map(i => [d.nodes[i].name, matrix(i)]));
}
function hierarchy(parsed) {
    const d = parsed.document, joints = new Set(d.skins[0].joints), parents = new Map();
    d.nodes.forEach((n, i) => (n.children ?? []).forEach(c => parents.set(c, i)));
    return Object.fromEntries([...joints].map(i => [d.nodes[i].name, joints.has(parents.get(i)) ? d.nodes[parents.get(i)].name : null]).sort(([a], [b]) => a.localeCompare(b)));
}
export function compareModels(output, reference, animations, coordinateTransform) {
    const actual = readGlb(output), expected = readGlb(reference), a = summarizeGlb(output), e = summarizeGlb(reference);
    const reflection = new Matrix4().makeScale(-1, 1, 1), origin = new Matrix4().makeTranslation(...coordinateTransform.translation), clips = [];
    const vertexData = p => [...new Set(p.document.meshes.flatMap(m => m.primitives.map(v => v.attributes.POSITION)))].flatMap(i => readAccessor(p, i));
    const av = vertexData(actual), ev = vertexData(expected);
    let maxVertexError = 0;
    if (av.length === ev.length)
        for (let i = 0; i < av.length; i++) {
            const p = ev[i].map((n, k) => (k === 0 ? -n : n) + coordinateTransform.translation[k]);
            maxVertexError = Math.max(maxVertexError, Math.hypot(...av[i].map((n, k) => n - p[k])));
        }
    else
        maxVertexError = Infinity;
    for (const [action, name] of Object.entries(animations)) {
        const ac = actual.document.animations.find(x => x.name === name), ex = expected.document.animations.find(x => x.name === action);
        if (!ac || !ex)
            throw new Error(`missing-comparison-clip:${action}`);
        const ad = duration(actual, ac), ed = duration(expected, ex), frames = [];
        for (const [label, time] of [['first', 0], ['middle', ed / 2], ['last', ed]]) {
            const ap = worldPose(actual, ac, time), ep = worldPose(expected, ex, time);
            let translation = 0, rotationDegrees = 0, worstTranslationBone = '', worstRotationBone = '';
            for (const [bone, m] of ap) {
                const source = ep.get(bone);
                if (!source)
                    throw new Error(`missing-reference-bone:${bone}`);
                const transformed = origin.clone().multiply(reflection).multiply(source).multiply(reflection);
                const p = new Vector3(), q = new Quaternion(), s = new Vector3(), rp = new Vector3(), rq = new Quaternion(), rs = new Vector3();
                m.decompose(p, q, s);
                transformed.decompose(rp, rq, rs);
                const dt = p.distanceTo(rp), dr = q.normalize().angleTo(rq.normalize()) * 180 / Math.PI;
                if (dt > translation) {
                    translation = dt;
                    worstTranslationBone = bone;
                }
                if (dr > rotationDegrees) {
                    rotationDegrees = dr;
                    worstRotationBone = bone;
                }
            }
            frames.push({ label, time, translation, rotationDegrees, worstTranslationBone, worstRotationBone, passed: translation <= 0.5 && rotationDegrees <= 0.5 });
        }
        clips.push({ action, name, duration: ad, referenceDuration: ed, durationDifference: Math.abs(ad - ed), frames, passed: Math.abs(ad - ed) <= 1e-6 && frames.every(f => f.passed) });
    }
    const hierarchyMatches = JSON.stringify(hierarchy(actual)) === JSON.stringify(hierarchy(expected));
    const namesMatch = Object.values(animations).length === a.animations.length && Object.keys(animations).length === e.animations.length;
    return { method: 'Compare GLB LINEAR/slerp poses at 0, reference duration/2, reference duration; all skin joint world matrices. Apply declared X reflection and common origin translation to reference, without fitting. Reference aliases are matched using unit-map. Compare all unique POSITION accessor vertices under the same transform.', tolerances: { translation: 0.5, rotationDegrees: 0.5, durationSeconds: 1e-6, vertexPosition: 0.0001 }, vertices: { actual: a.vertices, reference: e.vertices, maxPositionError: maxVertexError }, bones: { actual: a.bones, reference: e.bones }, hierarchyMatches, namesMatch, clips,
        maxTranslation: Math.max(...clips.flatMap(c => c.frames.map(f => f.translation))), maxRotationDegrees: Math.max(...clips.flatMap(c => c.frames.map(f => f.rotationDegrees))), passed: a.vertices === e.vertices && maxVertexError <= 0.0001 && a.bones === e.bones && hierarchyMatches && namesMatch && clips.every(c => c.passed) };
}
