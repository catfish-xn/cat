// Vitest reporter that records each test file's wall time for scripts/update-shard-weights.cjs.
// The JSON reporter's per-file startTime/endTime omit beforeAll/afterAll hooks, so a file whose
// work sits in hooks looked like 1 s and the sharder piled it onto an already full shard.
// TestModule.diagnostic().duration covers the whole module run, hooks included.
import { writeFileSync } from 'node:fs';
import { relative } from 'node:path';

export default class ShardWeightsReporter {
  onInit(vitest) { this.root = vitest.config.root; }
  onTestRunEnd(testModules) {
    const out = process.env.SHARD_WEIGHTS_REPORT ?? 'shard-weights-report.json';
    const files = Object.fromEntries(testModules.map(module => [
      relative(this.root, module.moduleId).split('\\').join('/'), module.diagnostic().duration]));
    writeFileSync(out, JSON.stringify(files));
  }
}
