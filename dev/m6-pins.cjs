#!/usr/bin/env node
/* Prints the values a pinned test now produces, without changing it (dev only).
 * usage: node dev/m6-pins.cjs [test file] [-t name pattern]      (default: tests/m6-playback-checkpoints.test.ts)
 * It runs a temporary copy of the test in which every expect(x) is soft and records, for each toBe / toHaveLength that no
 * longer holds, the source line, the pinned value and the value the code now produces (full, untruncated). The test file
 * itself is never edited and the copy is removed afterwards. Re-pin by hand from the list, keeping old values and the
 * reason in the comments. Assertions other than toBe / toHaveLength are reported only through the test's own failures. */
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const args = process.argv.slice(2), t = args.indexOf('-t'), pattern = t >= 0 ? args.splice(t, 2)[1] : null;
const file = args[0] || 'tests/m6-playback-checkpoints.test.ts';
const copy = path.join(path.dirname(file), 'zz-pins-' + path.basename(file)), out = path.resolve(copy + '.pins.json');
const src = fs.readFileSync(file, 'utf8');
const helper = `
const __pins: any[] = [];
const __line = () => { const m = (new Error().stack || '').split('\\n').slice(3).join('\\n').match(/zz-pins-[^:]+:(\\d+):/); return m ? +m[1] : 0; };
const __pin = (value: any, ...rest: any[]) => new Proxy(expect.soft(value, ...rest) as any, { get(target, key) {
  const f = target[key]; if (typeof f !== 'function') return f;
  return (...a: any[]) => {
    const line = __line();
    if (key === 'toBe' && !Object.is(value, a[0])) __pins.push({ line, pinned: a[0], now: value });
    if (key === 'toHaveLength' && value?.length !== a[0]) __pins.push({ line, pinned: a[0], now: value?.length });
    require('node:fs').writeFileSync(${JSON.stringify(out)}, JSON.stringify(__pins));
    return f.apply(target, a);
  };
} });
`;
const lines = src.split('\n'), lastImport = lines.reduce((n, l, i) => /^import /.test(l) ? i : n, -1);
const body = lines.slice(lastImport + 1).join('\n').replace(/\bexpect\(/g, '__pin(');
fs.writeFileSync(copy, [...lines.slice(0, lastImport + 1), helper, body].join('\n'));
const shift = helper.split("\n").length;
try {
  fs.rmSync(out, { force: true });
  spawnSync('npx', ['vitest', 'run', copy, '--testTimeout', '900000', ...(pattern ? ['-t', pattern] : [])], { stdio: ['ignore', 'ignore', 'inherit'] });
  const pins = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : [];
  if (!pins.length) console.log('no toBe / toHaveLength pin moved');
  for (const p of pins) {
    const line = p.line - shift;
    console.log(`line ${line}: ${JSON.stringify(p.pinned)} -> ${JSON.stringify(p.now)}`);
    console.log(`    ${(lines[line - 1] || '').trim().slice(0, 160)}`);
  }
} finally { fs.rmSync(copy, { force: true }); fs.rmSync(out, { force: true }); }
