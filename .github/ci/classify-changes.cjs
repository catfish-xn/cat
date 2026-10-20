// Decides which CI tier a pull request needs from the files it changes.
//   docs: only prose (Markdown/text outside code, test, script and evidence folders) that no
//         test, script, source or config file names; runs a seconds-long text check only.
//   ui:   only interface files (src/rendering, src/presentation, style, page shell, assets and
//         the four D6-A interface files), plus optionally docs; skips complete routes,
//         performance, memory and cross-mode evidence.
//   full: everything else, including any file this script cannot classify.
// Pushes, manual dispatches and any failure to read the file list run full.
// Usage: node classify-changes.cjs --self-test
//        node classify-changes.cjs <changes.tsv>   (lines: status<TAB>path<TAB>previous_path)
'use strict';
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');

const UI_PREFIXES = ['src/rendering/', 'src/presentation/', 'public/assets/'];
const UI_FILES = new Set(['src/style.css', 'src/main.ts', 'index.html',
  // D6-A (AGENTS.md): display and control adapters owned by the interface side.
  'src/persistence/save-controls.ts', 'src/replay/replay-panel.ts', 'src/stats/stats-panel.ts',
  'src/stats/combat-feedback-renderer.ts']);
const DOC_EXTENSIONS = /\.(md|markdown|txt)$/i;
// Prose inside these folders is read by tests or recorders (provenance notes, evidence).
const NOT_DOC_PREFIXES = ['src/', 'tests/', 'scripts/', 'public/', '.github/', 'deploy/', 'docs/evidence/'];
// A docs file named by any of these is an input to some check, so changing it runs full.
// This classifier is excluded: its self-test names docs files that are not inputs to anything.
const REFERENCE_PATHS = ['src', 'tests', 'scripts', '.github', 'package.json', 'vite.config.ts', 'vitest.config.ts', 'tsconfig.json',
  ':(exclude).github/ci/classify-changes.cjs'];

function isUiPath(path) { return UI_FILES.has(path) || UI_PREFIXES.some(prefix => path.startsWith(prefix)); }
function isDocPath(path) { return DOC_EXTENSIONS.test(path) && !NOT_DOC_PREFIXES.some(prefix => path.startsWith(prefix)); }

// changes: [{status, path, previous}]; isReferenced(path) -> boolean.
function classify(changes, isReferenced) {
  if (!changes.length) return {tier: 'full', reasons: ['no changed files listed']};
  const reasons = [];
  let tier = 'docs';
  for (const {status, path, previous} of changes) {
    const paths = previous ? [path, previous] : [path];
    for (const name of paths) {
      if (isDocPath(name)) {
        if (isReferenced(name)) { reasons.push(`${name}: named by a test, script, source or config file`); tier = 'full'; }
      } else if (isUiPath(name)) {
        // A deleted or renamed interface file can break imports the related-test lookup cannot see.
        if (status === 'removed' || status === 'renamed') { reasons.push(`${name}: interface file ${status}`); tier = 'full'; }
        else if (tier === 'docs') tier = 'ui';
      } else { reasons.push(`${name}: not a docs or interface file`); tier = 'full'; }
    }
  }
  return {tier, reasons};
}

// A reference is the file's name as a whole quoted string ('M6_GOAL.md', "../docs/X.md",
// `docs/X.md`), which is how a test or script reads it; a mention inside a longer label or
// comment sentence is not. git grep failures count as referenced.
function quotedName(base) {
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(['"\`])(?:[^'"\`\\s]*/)?${escaped}\\1`);
}
function gitReferenced(path) {
  const base = path.split('/').pop();
  let output;
  try { output = execFileSync('git', ['grep', '-h', '-F', '-e', base, '--', ...REFERENCE_PATHS], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024}); }
  catch (error) { if (error.status === 1) return false; return true; } // 1 = no match.
  const pattern = quotedName(base);
  return output.split('\n').some(line => pattern.test(line));
}

function parse(text) {
  return text.split('\n').filter(Boolean).map(line => { const [status, path, previous] = line.split('\t'); return {status, path, previous: previous || null}; });
}

function selfTest() {
  const assert = require('node:assert/strict');
  const none = () => false;
  const c = (path, status = 'modified', previous = null) => ({status, path, previous});
  const cases = [
    [[c('docs/UI_REQUESTS.md')], 'docs'],
    [[c('README.md'), c('planning/notes.txt')], 'docs'],
    [[c('docs/evidence/t13/notes.md')], 'full'],
    [[c('src/simulation/content/source/s13-14.24b/provenance/questions.md')], 'full'],
    [[c('src/rendering/hud.ts')], 'ui'],
    [[c('src/style.css'), c('docs/a.md')], 'ui'],
    [[c('src/stats/stats-panel.ts'), c('public/assets/s13/x.png', 'added')], 'ui'],
    [[c('src/rendering/old.ts', 'removed')], 'full'],
    [[c('src/rendering/new.ts', 'renamed', 'src/rendering/old.ts')], 'full'],
    [[c('src/rendering/x.ts', 'renamed', 'src/simulation/x.ts')], 'full'],
    [[c('src/simulation/match.ts')], 'full'],
    [[c('src/server/room.ts'), c('src/rendering/hud.ts')], 'full'],
    [[c('src/stats/aggregate.ts')], 'full'],
    [[c('tests/m5-economy.test.ts')], 'full'],
    [[c('scripts/m7-budget.cjs')], 'full'],
    [[c('.github/workflows/ci.yml')], 'full'],
    [[c('package-lock.json')], 'full'],
    [[c('u6-preview.html')], 'full'],
    [[c('src/rendering3d/scene.ts')], 'full'],
    [[], 'full'],
  ];
  for (const [changes, expected] of cases) assert.equal(classify(changes, none).tier, expected, JSON.stringify(changes));
  assert.equal(classify([c('M6_GOAL.md')], path => path === 'M6_GOAL.md').tier, 'full', 'referenced doc runs full');
  assert.equal(classify([c('M6_GOAL.md')], none).tier, 'docs');
  const quoted = quotedName('X.md');
  for (const line of [`read('X.md')`, `join(root, "../docs/X.md")`, 'const doc = `docs/X.md`;']) assert(quoted.test(line), line);
  for (const line of [`spec: 'docs/X.md UR-1'`, '// see docs/X.md', `'docs/AX.md'`, `'X.mdx'`]) assert(!quoted.test(line), line);
  console.log(`classify-changes self-test: ${cases.length + 9} cases passed`);
}

if (require.main === module) {
  if (process.argv[2] === '--self-test') selfTest();
  else {
    const changes = parse(fs.readFileSync(process.argv[2], 'utf8'));
    const result = classify(changes, gitReferenced);
    const related = result.tier === 'ui'
      ? changes.map(change => change.path).filter(path => /\.(ts|tsx|js|mjs|cjs)$/.test(path) && fs.existsSync(path)) : [];
    const docs = changes.map(change => change.path).filter(path => isDocPath(path) && fs.existsSync(path));
    process.stdout.write(JSON.stringify({...result, related, docs}) + '\n');
  }
}
module.exports = {classify, isDocPath, isUiPath};
