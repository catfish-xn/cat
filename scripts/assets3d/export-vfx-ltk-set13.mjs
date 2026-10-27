/** Uses the existing Rust resolver CLI. Every payload stays in scratch, outside git. */
import { readFile, writeFile, mkdir, readdir, copyFile, lstat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
for (const key of ['cli', 'source', 'six-cost', 'recovered', 'out']) if (!args[key]) throw Error(`--${key}=... required`);
const out = resolve(args.out);
if (!out.startsWith('/tmp/')) throw Error('output must be a fresh /tmp directory outside git');
if (!args.retry) { try { await lstat(out); throw Error('output already exists'); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
await mkdir(out, { recursive: true });
const overlay = join(out, '_overlay'); await mkdir(overlay, { recursive: true });
async function files(root, at = '') {
  const result = [];
  for (const entry of await readdir(join(root, at), { withFileTypes: true })) {
    const relative = join(at, entry.name);
    if (entry.isDirectory()) result.push(...await files(root, relative));
    else if (entry.isFile()) result.push(relative);
  }
  return result;
}
for (const source of [join(args['six-cost'], 'extracted'), join(args.recovered, 'extracted')]) {
  for (const relative of await files(source)) {
    const destination = join(overlay, relative); await mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(source, relative), destination);
  }
}
const aliases = { beardy: 'loris', blue: 'powder', chainsaw: 'renni', fish: 'steb', flyguy: 'scar', gremlin: 'smeech', lieutenant: 'sevika', nunuwillump: 'nunu', prime: 'vander', red: 'violet', renataglasc: 'renata', shooter: 'maddie', missmage: 'mel' };
const input = [];
for (const source of [args.source, args['six-cost']]) {
  const root = join(source, 'extracted/data/characters');
  for (const name of (await readdir(root)).sort()) {
    if (!name.startsWith('tft13_')) continue;
    const bin = join(root, name, 'skins/skin0.bin');
    try { await lstat(bin); } catch { continue; }
    const id = name.slice(6); input.push({ id: aliases[id] ?? id, source: name, bin });
  }
}
const overlayPaths = new Set((await files(overlay)).map(p => p.toLowerCase()));
const results = [];
for (const champion of input) {
  const folder = join(out, champion.source); await mkdir(folder, { recursive: true });
  if (args.retry) {
    const old = JSON.parse(await readFile(join(folder, 'inventory.json')));
    const canResolve = path => overlayPaths.has(path.toLowerCase()) || overlayPaths.has(path.toLowerCase().replace(/\.dds$/, '.tex'));
    if (!old.failures.length || old.failures.every(f => f.kind === 'asset' && f.reason === 'not in extracted asset root' && !canResolve(f.path))) {
      results.push({ ...champion, code: 0, exported: old.systems.length, failures: old.failures, folder }); continue;
    }
  }
  const argv = ['--bin', champion.bin, '--assets', join(args.source, 'extracted'), '--hashes', join(args.source, 'hashes'), '--overlay', overlay,
    '--extra-bin', join(overlay, 'data/maps/shipping/map22/map22.bin'), '--extra-systems', '0f2af66b,2436e086', '--out', folder];
  const result = await new Promise((accept, reject) => {
    const child = spawn(resolve(args.cli), argv, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = ''; child.stdout.on('data', b => stdout += b); child.stderr.on('data', b => stderr += b);
    child.on('error', reject); child.on('close', code => accept({ code, stdout, stderr }));
  });
  await writeFile(join(folder, 'export.log'), JSON.stringify({ argv, ...result }, null, 2));
  const inventory = result.code === 0 ? JSON.parse(await readFile(join(folder, 'inventory.json'), 'utf8')) : null;
  const row = { ...champion, code: result.code, exported: inventory?.systems.length ?? 0, failures: inventory?.failures ?? [], folder };
  results.push(row); await writeFile(join(out, 'export-summary.json'), JSON.stringify(results, null, 2));
  console.log(`${champion.id}: ${row.exported} systems, ${row.failures.length} diagnostics, exit ${row.code}`);
}
await writeFile(join(out, 'export-summary.json'), JSON.stringify(results, null, 2));
if (results.some(row => row.code !== 0)) process.exitCode = 1;
