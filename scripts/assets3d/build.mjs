import { readFile, readdir, stat, unlink } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { safeInputPath, safeOutputPath, writeOutputFile, withinRoot } from './safe-path.mjs';
import { contracts, unitDefinitions } from './runtime.mjs';
import { makeModel, validateModel } from './model.mjs';
import { compareModels } from './compare.mjs';
import { decodeTexture, encodePng } from './texture.mjs';
import { convertParticles } from './particles.mjs';
import { planFetch, argumentsFor } from './plan-fetch.mjs';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = p => p.toLowerCase().replaceAll('.tft_set13', '');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
async function walk(root, directory = root) {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = await safeInputPath(root, join(directory, entry.name));
        const info = await stat(path);
        if (info.isDirectory())
            files.push(...await walk(root, path));
        else if (info.isFile())
            files.push(path);
    }
    return files.sort();
}
export function makeManifest(models, effects, validate) {
    const manifest = { schemaVersion: 1, models, effects };
    validate(manifest);
    return manifest;
}
export async function writeParticleEffects(id, converted, patterns, { write, remove }, effectIds = new Set()) {
    const effects = {}, systems = [], actionEffects = Object.fromEntries(Object.keys(patterns).map(action => [action, []]));
    for (const system of converted.systems) {
        const slug = system.sourcePath.split('/').at(-1).toLowerCase().replace(/[^a-z0-9_-]/g, '_'), effectId = `${id}_${slug}`;
        if (effectIds.has(effectId))
            throw new Error('duplicate-effect-id');
        effectIds.add(effectId);
        const path = `effects/${id}/${slug}.json`, reportPath = `effects/${id}/${slug}.report.json`;
        await write(reportPath, json({ sourcePath: system.sourcePath, reason: system.reason, emitters: system.report }));
        const counts = { mapped: 0, skipped: 0, rejected: 0 };
        system.report.forEach(e => counts[e.status]++);
        if (!system.document) {
            // Remove this system's former payload on --force; retain its sidecar.
            await remove(path);
            systems.push({ effectId, reportPath, sourcePath: system.sourcePath, counts, reason: system.reason });
            continue;
        }
        await write(path, json(system.document));
        effects[effectId] = { path };
        systems.push({ effectId, path, reportPath, sourcePath: system.sourcePath, counts });
        for (const [action, matches] of Object.entries(patterns))
            if (matches.some(p => system.sourcePath.toLowerCase().includes(p.toLowerCase())))
                actionEffects[action].push(effectId);
    }
    return { effects, systems, actionEffects };
}
export async function build({ units = 'jinx,vi', source = 'assets3d-local/trial/local', out = 'assets3d-local/out', force = false } = {}) {
    const root = resolve(source), output = await safeOutputPath(out, { directory: true }), rel = relative(root, output);
    if (!rel || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)))
        throw new Error('output-overlaps-source');
    const selected = units.split(','), map = JSON.parse(await readFile(new URL('./unit-map.json', import.meta.url), 'utf8')), definitions = await unitDefinitions();
    if (new Set(selected).size !== selected.length || selected.some(id => !Object.hasOwn(definitions, id) || !map[id]?.mesh))
        throw new Error('unsupported-build-units');
    const { assertManifest, assetUrl, parseParticleDocument } = await contracts(), rawRoot = await safeInputPath(root, join(root, 'extracted'));
    const records = JSON.parse(await readFile(await safeInputPath(root, join(root, 'extraction.json')), 'utf8'));
    if (records.version !== '14.24.6442327' || !Array.isArray(records.files))
        throw new Error('source-version-mismatch');
    // A failed --force rebuild must never leave a stale success marker covering
    // a mixture of old and new payloads. The final report replaces our marker.
    await writeOutputFile(join(output, 'build-report.json'), json({ schemaVersion: 1, ready: false, phase: 'building' }), { force });
    const sources = [], recordMap = new Map();
    for (const record of records.files) {
        if (!record || typeof record.path !== 'string')
            throw new Error('invalid-source-record');
        assetUrl('', record.path);
        const path = await safeInputPath(rawRoot, withinRoot(rawRoot, resolve(rawRoot, record.path), 'unsafe-source-path'));
        if (recordMap.has(record.path))
            throw new Error('duplicate-source-record');
        recordMap.set(record.path, { ...record, absolute: path });
    }
    const readRaw = async (path) => {
        const r = recordMap.get(path);
        if (!r)
            throw new Error(`missing-source-record:${path}`);
        const bytes = await readFile(r.absolute);
        if (r.bytes !== bytes.length || r.sha256 !== sha256(bytes))
            throw new Error(`source-hash-mismatch:${path}`);
        if (!sources.some(s => s.path === path))
            sources.push({ path, bytes: bytes.length, sha256: r.sha256 });
        return bytes;
    };
    const files = [], write = async (path, bytes) => {
        assetUrl('', path);
        const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
        await writeOutputFile(join(output, path), data, { force });
        files.push({ path, bytes: data.length, sha256: sha256(data) });
    };
    const remove = async path => {
        if (!force)
            return;
        try {
            await unlink(await safeOutputPath(join(output, path), { force: true }));
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
    };
    const jsonRoot = resolve(root, '../../source-json'), referenceRoot = resolve(root, '../public-assets');
    const textures = {}, textureByCanonical = new Map(), textureReports = [], particleSources = {};
    for (const id of selected) {
        const bytes = await readFile(await safeInputPath(jsonRoot, join(jsonRoot, `${id}.json`)));
        particleSources[id] = JSON.parse(bytes);
        sources.push({ path: `source-json/${id}.json`, bytes: bytes.length, sha256: sha256(bytes) });
    }
    const requestedTextures = new Set([...recordMap.keys()].filter(p => selected.some(id => p.startsWith(`${map[id].base}/`)) && /\.(tex|dds)$/i.test(p)));
    const rawByCanonical = new Map([...recordMap.keys()].map(p => [canonical(p), p]));
    const missingTextureReferences = new Set();
    for (const source of Object.values(particleSources)) {
        const stack = [source];
        while (stack.length) {
            const v = stack.pop();
            if (typeof v === 'string' && /\.(tex|dds)$/i.test(v)) {
                const p = rawByCanonical.get(canonical(v));
                if (p)
                    requestedTextures.add(p);
                else
                    missingTextureReferences.add(v);
            }
            else if (v && typeof v === 'object')
                stack.push(...Object.values(v));
        }
    }
    for (const path of [...requestedTextures].sort()) {
        const bytes = await readRaw(path);
        try {
            const decoded = decodeTexture(bytes), png = encodePng(decoded), dest = `textures/${path.replace(/\.(tex|dds)$/i, '.png')}`;
            await write(dest, png);
            textures[path] = png;
            textureByCanonical.set(canonical(path), dest);
            textureReports.push({ source: path, path: dest, width: decoded.width, height: decoded.height, format: decoded.format, status: 'converted', bytes: png.length });
        }
        catch (e) {
            if (!e.message.startsWith('unsupported-texture-'))
                throw e;
            textureReports.push({ source: path, status: 'skipped', reason: e.message });
        }
    }
    let validator;
    try {
        const path = await safeInputPath(root, join(root, 'validator/node_modules/gltf-validator/index.js'));
        validator = createRequire(import.meta.url)(path);
    }
    catch (e) {
        if (e.code !== 'ENOENT')
            throw e;
    }
    const models = {}, effects = {}, unitReports = {}, actionEffects = {}, effectIds = new Set();
    for (const id of selected) {
        const config = map[id], animationSources = [];
        for (const name of Object.values(config.animations))
            animationSources.push({ name, bytes: await readRaw(`${config.base}/${config.animationPath.replace('{name}', name)}`) });
        const materialTextures = {};
        for (const [material, path] of Object.entries(config.textures))
            materialTextures[material] = textures[`${config.base}/${path}`];
        const result = makeModel(await readRaw(`${config.base}/${config.mesh}`), await readRaw(`${config.base}/${config.skeleton}`), animationSources, materialTextures), structure = validateModel(result.glb);
        const reference = await readFile(await safeInputPath(referenceRoot, join(referenceRoot, id, 'rigged.glb'))), comparison = compareModels(result.glb, reference, config.animations, result.report.coordinateTransform);
        const gltfValidation = validator ? await validator.validateBytes(new Uint8Array(result.glb), { uri: `${id}.glb`, maxIssues: 1000 }) : null;
        const path = `models/${id}/model.glb`;
        await write(path, result.glb);
        models[id] = { path, animations: config.animations };
        const converted = convertParticles(particleSources[id], p => textureByCanonical.get(canonical(p)), parseParticleDocument);
        const particleOutput = await writeParticleEffects(id, converted, config.effectPatterns, { write, remove }, effectIds), systems = particleOutput.systems;
        Object.assign(effects, particleOutput.effects);
        actionEffects[id] = particleOutput.actionEffects;
        unitReports[id] = { ...result.report, bytes: result.glb.length, sha256: sha256(result.glb), referenceSha256: sha256(reference), structure, comparison, gltfValidation: gltfValidation ? { version: validator.version(), ...gltfValidation.issues } : { available: false }, particles: { counts: converted.counts, emitters: converted.emitters, systems }, textures: textureReports.filter(t => t.source.startsWith(`${config.base}/`)).length };
    }
    const manifest = makeManifest(models, effects, assertManifest);
    await write('manifest.json', json(manifest));
    const fetchPlan = await planFetch({ source: root, out: output, force });
    const fetchBytes = await readFile(join(output, 'fetch-plan.json'));
    files.push({ path: 'fetch-plan.json', bytes: fetchBytes.length, sha256: sha256(fetchBytes) });
    const ready = Object.values(unitReports).every(u => u.comparison.passed && u.structure.passed && (!validator || u.gltfValidation.numErrors === 0 && u.gltfValidation.numWarnings === 0));
    const report = { schemaVersion: 1, ready, sourceVersion: records.version, units: unitReports, sourceFiles: sources, textureSummary: { converted: textureReports.filter(t => t.status === 'converted').length, skipped: textureReports.filter(t => t.status === 'skipped').length, missingReferences: [...missingTextureReferences].sort() }, textures: textureReports,
        actionEffects, actionEffectsNote: 'Name-based suggestions for written effects only, no schema extension or runtime wiring. Unsupported emitters are sidecar-only; systems with no writable emitters have no document or manifest effect.',
        contractVerification: { manifest: 'src/rendering3d/contracts.ts assertManifest (direct TS import)', particles: 'src/rendering3d/particles.ts parseParticleDocument (direct TS import)', particleDocuments: Object.keys(effects).length, passed: true },
        animationMethod: 'v1: 16-bit truncated sample time, flags bit 4 selects time-weighted rather than uniform Catmull-Rom tangents; incoming quaternion endpoint hemisphere correction leaves look-ahead control encoded. Float32 frame clock matches reference export. v5: indexed vector/quaternion pools. No fitting to reference GLBs; they are read only for verification.',
        fetchPlan: { totals: fetchPlan.totals, byWad: fetchPlan.wads.map(w => ({ name: w.name, entries: w.entries.length, chunks: w.chunks, downloadBytes: w.downloadBytes })), byUnit: Object.fromEntries(Object.entries(fetchPlan.units).map(([id, u]) => [id, u.summary])), limitations: fetchPlan.limitations }, files, totals: { manifestBytes: files.find(f => f.path === 'manifest.json').bytes, outFiles: 0, outBytes: 0, buildReportBytes: 0 } };
    const otherFiles = (await walk(output)).filter(p => relative(output, p) !== 'build-report.json');
    report.totals.outFiles = otherFiles.length + 1;
    const otherBytes = (await Promise.all(otherFiles.map(p => stat(p)))).reduce((s, f) => s + f.size, 0);
    // Include this report's own byte size without a recursive self-hash.
    for (let i = 0; i < 8; i++) {
        const bytes = Buffer.byteLength(json(report));
        if (bytes === report.totals.buildReportBytes)
            break;
        report.totals.buildReportBytes = bytes;
        report.totals.outBytes = otherBytes + bytes;
    }
    await writeOutputFile(join(output, 'build-report.json'), json(report), { force: true });
    return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const report = await build(argumentsFor(process.argv.slice(2), ['--units', '--source', '--out']));
    console.log(JSON.stringify({ ready: report.ready, textures: { converted: report.textureSummary.converted, skipped: report.textureSummary.skipped, missingReferences: report.textureSummary.missingReferences.length }, totals: report.totals, fetchPlan: report.fetchPlan.totals }));
    if (!report.ready)
        process.exitCode = 1;
}
