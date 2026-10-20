import { register } from 'node:module';
register('./ts-loader.mjs', import.meta.url);
// Dynamic imports occur after registration (static imports would run too early).
export async function contracts() {
    const { assertManifest, assetUrl } = await import('../../src/rendering3d/contracts.ts');
    const { parseParticleDocument } = await import('../../src/rendering3d/particles.ts');
    return { assertManifest, assetUrl, parseParticleDocument };
}
export async function unitDefinitions() {
    return (await import('../../src/simulation/units.ts')).M5_UNIT_DEFINITIONS;
}
