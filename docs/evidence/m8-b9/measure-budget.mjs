// Node 2 (B9+U7) bundle measurement and B9/U7 split probes.
// Same method as docs/evidence/m8-b8/checkpoint-two/measure.mjs: an isolated `git archive` tree per label, vite production
// build, gzip level 9 per emitted JS file, summed. Probes are estimates: they revert the named UI files to the node-2 base
// inside a throwaway tree (no typecheck; the probe tree is never shipped or run), so gzip/tree-shaking interaction between
// the reverted files and the rest is attributed to B9. Usage:
//   node docs/evidence/m8-b9/measure-budget.mjs <candidate-sha> <out-dir>
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const BASE = 'c109d4ebc24bb5de60c1adfa4cad2e5ca5e816fd';
// U7 per M8_REMAINING_JS_BUDGET_PLAN §3 (rows B9/U7) and §4 (B9 owns compatibility/replay algorithms and public queries;
// U7 only UI). Probe "ui-leaves": the two D6-A UI leaves U7 rewrote. Probe "ui-all": additionally every Claude-owned UI
// and presentation consumer adapted to the formal replay2 events (budget row U7: "正式U4回放消费的必要适配在此计入").
const UI_LEAVES = ['src/persistence/save-controls.ts', 'src/replay/replay-panel.ts'];
const UI_ALL = [...UI_LEAVES, 'src/stats/stats-panel.ts', 'src/stats/combat-feedback-renderer.ts', 'src/presentation/combat-status.ts',
  'src/presentation/combat-fx.ts', 'src/presentation/fx-plan.ts', 'src/rendering/BoardScene.ts', 'src/rendering/combat-feedback.ts',
  'src/rendering/match-session.ts', 'src/rendering/replay-view.ts', 'src/rendering/strategy-panel.ts'];
const [, , candidate, outArg] = process.argv;
const repo = resolve(import.meta.dirname, '../../..'), out = resolve(outArg);
mkdirSync(out, { recursive: true });
const git = (...args) => execFileSync('git', args, { cwd: repo, maxBuffer: 256 * 1024 * 1024 });
function tree(label, sha, revert = []) {
  const root = `${out}/${label}-src`;
  rmSync(root, { recursive: true, force: true }); mkdirSync(root, { recursive: true });
  execFileSync('tar', ['-x', '-C', root], { input: git('archive', sha) });
  for (const file of revert) writeFileSync(`${root}/${file}`, git('show', `${BASE}:${file}`));
  symlinkSync(`${repo}/node_modules`, `${root}/node_modules`);
  return root;
}
async function measure(label, root) {
  const { build } = await import(createRequire(`${root}/package.json`).resolve('vite'));
  const outDir = `${out}/${label}`;
  await build({ root, configFile: `${root}/vite.config.ts`, logLevel: 'warn', build: { outDir, emptyOutDir: true } });
  const files = readdirSync(`${outDir}/assets`).filter(f => f.endsWith('.js')).sort()
    .map(file => ({ file, gzip9: gzipSync(readFileSync(`${outDir}/assets/${file}`), { level: 9 }).length }));
  return { label, files, total: files.reduce((s, f) => s + f.gzip9, 0) };
}
const sha = git('rev-parse', candidate).toString().trim();
const base = await measure('base', tree('base', BASE));
const cand = await measure('candidate', tree('candidate', sha));
const leaves = await measure('probe-ui-leaves', tree('probe-ui-leaves', sha, UI_LEAVES));
const all = await measure('probe-ui-all', tree('probe-ui-all', sha, UI_ALL));
const report = { base: BASE, candidate: sha, node: process.version, zlib: process.versions.zlib, method: 'vite build, gzip9 per dist/assets/*.js, summed',
  totals: { base: base.total, candidate: cand.total, probeUiLeaves: leaves.total, probeUiAll: all.total },
  net: cand.total - base.total,
  split: {
    uiLeaves: { revertedFiles: UI_LEAVES, b9: leaves.total - base.total, u7: cand.total - leaves.total },
    uiAll: { revertedFiles: UI_ALL, b9: all.total - base.total, u7: cand.total - all.total },
  },
  budget: { b9: { median: 9000, stop: 11700 }, u7: { median: 3500, stop: 4550 }, totalStop: 552191 },
  boundaries: [
    'Probe trees are non-shipping estimates built without typecheck; reverted files keep the base implementation against new data shapes.',
    'gzip and tree shaking are not additive: the B9/U7 split is an attribution, not two independent measurements; the net total is exact.',
    'src/m6/application.ts (D6-A non-visual integration) and all simulation/persistence/replay/stats aggregation stay in B9 in both probes.',
  ],
  files: { base: base.files, candidate: cand.files, probeUiLeaves: leaves.files, probeUiAll: all.files } };
writeFileSync(`${out}/budget.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ totals: report.totals, net: report.net, split: { uiLeaves: report.split.uiLeaves.b9 + '/' + report.split.uiLeaves.u7, uiAll: report.split.uiAll.b9 + '/' + report.split.uiAll.u7 } }));
