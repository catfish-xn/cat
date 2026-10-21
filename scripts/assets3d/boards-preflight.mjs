import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

// Security tests may contain invented drive paths. Reject machine locations,
// including escaped JSON stack traces, without weakening those negative cases.
const machinePath = /\b[a-z]:[\\/]+(?:users|program files(?: \(x86\))?)(?:[\\/]+|\b)/i;
const unixMachinePath = /(?:^|[\s'"`(])(?:file:\/\/)?\/(?:home|Users)\/[^/\s]+\//;
const textExtensions = /\.(?:[cm]?[jt]sx?|md|json|jsonl|txt|html|css|ps1|ya?ml|sh|cmd|bat)$/i;
async function files(root) {
  const result = [];
  for (const e of await readdir(root, { withFileTypes: true })) {
    const p = join(root, e.name);
    if (e.isDirectory()) result.push(...await files(p));
    else if (e.isFile() && textExtensions.test(p)) result.push(p);
  }
  return result;
}
const failures = [];
let checked = 0;
for (const root of ['scripts', 'tests', 'docs']) for (const p of await files(root)) {
  const text = await readFile(p, 'utf8'); checked++;
  for (const [i, line] of text.split(/\r?\n/).entries())
    if (machinePath.test(line) || unixMachinePath.test(line)) failures.push(`${p}:${i + 1}: machine-specific absolute path`);
}
const browser = await readFile('scripts/assets3d/boards-browser-review.mjs', 'utf8');
if (!browser.includes("if(!process.env.CHROMIUM_PATH)throw new Error('CHROMIUM_PATH-required')") ||
    !browser.includes('executablePath:process.env.CHROMIUM_PATH,') ||
    /process\.env\.(?!CHROMIUM_PATH\b)/.test(browser)) failures.push('board browser must use CHROMIUM_PATH only');
const test = await readFile('tests/assets3d-boards.test.ts', 'utf8');
if (/assets3d-local|\.(?:anm|skn|skl)\b|\breadFile(?:Sync)?\s*\(/i.test(test))
  failures.push('board tests must use synthetic in-memory resources');
if (failures.length) throw new Error(failures.join('\n'));
console.log(JSON.stringify({ ready: true, textFiles: checked, machinePaths: 0, boardTests: 'synthetic', browser: 'CHROMIUM_PATH' }));
