import { register } from 'node:module';
register('./ts-loader.mjs', import.meta.url);
// Dynamic imports occur after registration (static imports would run too early).
export async function contracts() {
    const { assertManifest, assetUrl } = await import('../../src/rendering3d/contracts.ts');
    const { parseParticleDocument } = await import('../../src/rendering3d/particles.ts');
    return { assertManifest, assetUrl, parseParticleDocument };
}
export async function unitDefinitions() {
    // The checked-in 3D map covers the original 1–5-cost roster only.
    // v19 six-cost visuals are a separate integration task; never guess asset paths.
    const all = (await import('../../src/simulation/units.ts')).M5_UNIT_DEFINITIONS;
    return Object.fromEntries(Object.entries(all).filter(([, unit]) => unit.cost <= 5));
}
