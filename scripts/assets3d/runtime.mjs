import { register } from 'node:module';
import { readFile } from 'node:fs/promises';
register('./ts-loader.mjs', import.meta.url);
// Dynamic imports occur after registration (static imports would run too early).
export async function contracts() {
    const { assertManifest, assetUrl } = await import('../../src/rendering3d/contracts.ts');
    const { parseParticleDocument } = await import('../../src/rendering3d/particles.ts');
    return { assertManifest, assetUrl, parseParticleDocument };
}
export function mergeUnitDefinitions(definitions, extras) {
    const merged = { ...definitions };
    for (const [id, extra] of Object.entries(extras)) {
        if (Object.hasOwn(definitions, id)) {
            if (definitions[id].cost !== extra.cost) throw new Error(`extra-unit-cost-conflict:${id}`);
        } else merged[id] = extra;
    }
    return merged;
}
export async function unitDefinitions() {
    const definitions = (await import('../../src/simulation/units.ts')).M5_UNIT_DEFINITIONS;
    const extras = JSON.parse(await readFile(new URL('./extra-units.json', import.meta.url), 'utf8'));
    return mergeUnitDefinitions(definitions, extras);
}
export function selectUnits(definitions, units = 'all', cost) {
    // Keep legacy batches stable; six-cost units require an explicit selection/filter.
    const costs = cost === undefined ? (units === 'all' ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6]) : String(cost).split(',').map(Number);
    if (!costs.length || costs.some(n => !Number.isInteger(n) || n < 1 || n > 6) || new Set(costs).size !== costs.length)
        throw new Error('invalid-cost-filter');
    const selected = units === 'all' ? Object.keys(definitions) : units.split(',');
    if (new Set(selected).size !== selected.length || selected.some(id => !Object.hasOwn(definitions, id)))
        throw new Error('invalid-unit-selection');
    return selected.filter(id => costs.includes(definitions[id].cost))
        .sort((a, b) => definitions[a].cost - definitions[b].cost || a.localeCompare(b));
}
