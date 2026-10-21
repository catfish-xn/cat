import { compressAssets } from './compress.mjs';

const report = await compressAssets({ from: 'assets3d-local/little-legends/runtime',
  out: 'assets3d-local/little-legends-compressed', onProgress: p => console.log(JSON.stringify(p)) });
const river = await compressAssets({ from: 'assets3d-local/little-legends/river-sprite-supplement/runtime',
  out: 'assets3d-local/little-legends-compressed/river-sprite-supplement', onProgress: p => console.log(JSON.stringify(p)) });
console.log(JSON.stringify({ six: { before: report.modelBytes.before, after: report.modelBytes.after, payload: report.afterBytes },
  river: { before: river.modelBytes.before, after: river.modelBytes.after, payload: river.afterBytes } }));
