import { inventoryParticles } from './particle-inventory.mjs';
const metadata = ['__type', 'emitterName', 'importance'];
const supported = [...metadata, 'primitive', 'isSingleParticle', 'particleLifetime', 'rate', 'timeBeforeFirstEmission', 'birthVelocity', 'birthDrag', 'worldAcceleration', 'color', 'texture', 'blendMode', 'texDiv', 'numFrames', 'frameRate'];
function constant(value, name) {
    if (!value || typeof value !== 'object' || Object.keys(value).some(k => !['constantValue', '__type'].includes(k)) || value.constantValue === undefined)
        throw new Error(`dynamic-or-probabilistic:${name}`);
    return value.constantValue;
}
const vector = (v, name) => {
    if (!Array.isArray(v) || v.length !== 3 || v.some(n => !Number.isFinite(n)))
        throw new Error(`invalid-vector:${name}`);
    return [-v[0], v[1], v[2]];
};
export function mapEmitter(source, texturePath) {
    const primitive = source.primitive?.__type ?? 'VfxPrimitiveCameraQuad';
    if (source.distortionDefinition?.__type === 'VfxDistortionDefinitionData')
        return { status: 'skipped', emitter: { kind: 'screenDistortion' }, reason: 'v1-runtime-skips-screen-distortion' };
    if (/Mesh/.test(primitive))
        return { status: 'skipped', emitter: { kind: 'mesh' }, reason: 'v1-runtime-skips-mesh' };
    if (/Trail/.test(primitive))
        return { status: 'skipped', emitter: { kind: 'trail' }, reason: 'v1-runtime-skips-trail' };
    if (!['VfxPrimitiveCameraQuad'].includes(primitive))
        return { status: 'rejected', reason: `unsupported-primitive:${primitive}` };
    try {
        if (!source.isSingleParticle)
            throw new Error('continuous-emission');
        for (const key of ['EmitterPosition', 'birthScale0', 'scale0', 'birthColor', 'birthRotation0', 'rotation0', 'particleLinger', 'lifetime', 'emitterLinger'])
            if (Object.hasOwn(source, key))
                throw new Error(`unrepresentable-semantics:${key}`);
        const stack = [source];
        while (stack.length) {
            const obj = stack.pop();
            if (!obj || typeof obj !== 'object')
                continue;
            if (Object.hasOwn(obj, 'probabilityTables'))
                throw new Error('birth-probability');
            stack.push(...Object.values(obj).filter(v => v && typeof v === 'object'));
        }
        for (const key of Object.keys(source))
            if (!supported.includes(key))
                throw new Error(`unmapped-source-field:${key}`);
        if (source.primitive && Object.keys(source.primitive).some(k => k !== '__type'))
            throw new Error('primitive-parameters');
        const lifetime = constant(source.particleLifetime, 'particleLifetime');
        if (!Number.isFinite(lifetime) || lifetime <= 0)
            throw new Error('special-or-dynamic-lifetime');
        // Single particles have count=1. A supplied rate still must be constant; no sampling.
        if (source.rate !== undefined)
            constant(source.rate, 'rate');
        const out = { kind: 'sprite', count: 1, lifetime };
        if (source.texture) {
            const path = texturePath(source.texture);
            if (!path)
                throw new Error('missing-or-unsupported-texture');
            out.texture = path;
        }
        if (source.timeBeforeFirstEmission !== undefined)
            out.delay = constant(source.timeBeforeFirstEmission, 'delay');
        if (source.birthVelocity !== undefined)
            out.velocity = vector(constant(source.birthVelocity, 'birthVelocity'), 'birthVelocity');
        if (source.worldAcceleration !== undefined)
            out.gravity = vector(constant(source.worldAcceleration, 'worldAcceleration'), 'worldAcceleration');
        if (source.birthDrag !== undefined) {
            const drag = constant(source.birthDrag, 'birthDrag');
            if (Array.isArray(drag)) {
                if (drag.length !== 3 || !drag.every(v => v === drag[0]))
                    throw new Error('anisotropic-drag');
                out.drag = drag[0];
            }
            else
                out.drag = drag;
        }
        if (source.color !== undefined) {
            const color = constant(source.color, 'color');
            if (!Array.isArray(color) || color.length !== 4 || color.some(n => !Number.isFinite(n) || n < 0 || n > 1))
                throw new Error('invalid-source-color');
            out.color = [{ time: 0, value: color.slice(0, 3) }];
            out.opacity = [{ time: 0, value: color[3] }];
        }
        // The local inputs do not establish the numeric Riot enum's equivalence.
        // Keep it in the rejection report instead of guessing a renderer blend mode.
        if (source.blendMode !== undefined)
            throw new Error(`unverified-source-blend:${source.blendMode}`);
        if (source.texDiv !== undefined || source.numFrames !== undefined || source.frameRate !== undefined) {
            const div = source.texDiv ?? [1, 1], fps = source.frameRate === undefined ? 0 : constant(source.frameRate, 'frameRate');
            if (!Array.isArray(div) || div.length !== 2 || source.numFrames !== undefined && source.numFrames !== div[0] * div[1])
                throw new Error('partial-atlas');
            out.frames = { columns: div[0], rows: div[1], fps, loop: false };
        }
        return { status: 'mapped', emitter: out, reason: 'finite-single-particle-exact-v1-subset' };
    }
    catch (error) {
        return { status: 'rejected', reason: error.message };
    }
}
export function convertParticles(source, texturePath, validate) {
    const inventory = inventoryParticles(source), counts = { mapped: 0, skipped: 0, rejected: 0 }, systems = [];
    for (const system of inventory.systems) {
        const emitters = [], report = [];
        for (const e of system.emitters) {
            let result = mapEmitter(e.source, texturePath);
            if (result.emitter)
                try {
                    validate({ schemaVersion: 1, emitters: [result.emitter] });
                }
                catch (error) {
                    result = { status: 'rejected', reason: `contract-rejected:${error.message}` };
                }
            counts[result.status]++;
            if (result.emitter)
                emitters.push(result.emitter);
            report.push({ sourcePath: e.id, mapped: result.status === 'mapped', status: result.status, reason: result.reason, inventoryGaps: e.gaps, originalFields: e.source });
        }
        const document = { schemaVersion: 1, emitters };
        validate(document);
        systems.push({ sourcePath: system.id, document, report });
    }
    return { systems, counts, emitters: inventory.emitterCount };
}
