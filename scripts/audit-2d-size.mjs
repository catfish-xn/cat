// Usage: node scripts/audit-2d-size.mjs --out=artifacts/2d-size [--dist=dist]
// Exact chunk gzip-9 plus per-module estimates (not additive gzip attribution).
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { build } from 'vite';
import { transform } from 'esbuild';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const out = resolve(arg('out') ?? 'artifacts/2d-size');
const dist = arg('dist');
const root = process.cwd();
const normalize = id => id.replaceAll('\\', '/').replace(root + '/', '').replace(/^.*?(?=node_modules\/)/, '');
const gzip = code => gzipSync(code, { level: 9 }).length;
const result = await build({ root, configLoader: 'runner', mode: 'production', logLevel: 'warn',
  build: { write: !!dist, ...(dist ? { outDir: resolve(dist) } : {}) } });
if ('on' in result) throw Error('Unexpected watcher');
const chunks = (Array.isArray(result) ? result : [result]).flatMap(value => value.output).filter(item => item.type === 'chunk');
const rows = [];
for (const chunk of chunks.filter(chunk => /^assets\/[^/]+\.js$/.test(chunk.fileName))) {
  const modules = Object.entries(chunk.modules);
  for (let offset = 0; offset < modules.length; offset += 16) {
    rows.push(...await Promise.all(modules.slice(offset, offset + 16).map(async ([id, module]) => {
      const code = module.code ?? '';
      const minified = code ? (await transform(code, { minify: true, format: 'esm', target: 'es2020', legalComments: 'none' })).code : '';
      return { id: normalize(id), chunk: chunk.fileName, renderedBytes: Buffer.byteLength(code),
        minifiedBytes: Buffer.byteLength(minified), gzip9Estimate: minified ? gzip(minified) : 0,
        sha256: createHash('sha256').update(code).digest('hex') };
    })));
  }
}
rows.sort((a, b) => b.gzip9Estimate - a.gzip9Estimate || a.id.localeCompare(b.id));
const sizes = chunks.map(chunk => ({ file: chunk.fileName, bytes: Buffer.byteLength(chunk.code), gzip9: gzip(chunk.code),
  imports: chunk.imports, dynamicImports: chunk.dynamicImports, moduleIds: chunk.moduleIds.map(normalize) }));
const entry = chunks.find(chunk => chunk.isEntry && chunk.moduleIds.some(id => id.endsWith('/src/main.ts')));
if (!entry) throw Error('Missing main entry');
const byName = new Map(chunks.map(chunk => [chunk.fileName, chunk]));
const reachable = new Set([entry.fileName]);
for (const name of reachable) for (const dependency of byName.get(name).imports) reachable.add(dependency);
const copies = new Map();
for (const chunk of chunks) for (const id of chunk.moduleIds) {
  const names = copies.get(id) ?? []; names.push(chunk.fileName); copies.set(id, names);
}
const report = { method: 'Exact emitted chunk gzip-9; estimates: Rollup rendered module code → esbuild minify esm/es2020 → separate gzip-9. Estimates exclude chunk-level compact-entry-strings and shared gzip dictionary; do not sum them or use as guaranteed savings.',
  node: process.version, gzip2d: sizes.filter(chunk => /^assets\/[^/]+\.js$/.test(chunk.file)).reduce((sum, chunk) => sum + chunk.gzip9, 0),
  staticReachable: [...reachable], chunks: sizes,
  duplicateModuleIds: [...copies].filter(([, names]) => names.length > 1).map(([id, chunks]) => ({ id: normalize(id), chunks })),
  modules: rows };
await mkdir(out, { recursive: true });
await writeFile(resolve(out, 'modules.json'), JSON.stringify(report, null, 2) + '\n');
const cell = value => JSON.stringify(String(value));
await writeFile(resolve(out, 'modules.csv'), ['module,chunk,rendered_bytes,minified_bytes,gzip9_estimate',
  ...rows.map(row => [row.id, row.chunk, row.renderedBytes, row.minifiedBytes, row.gzip9Estimate].map(cell).join(','))].join('\n') + '\n');
console.log(JSON.stringify({ gzip2d: report.gzip2d, chunks: sizes.map(({ moduleIds, ...size }) => size),
  duplicateModuleIds: report.duplicateModuleIds, top20: rows.slice(0, 20), reportDirectory: out }, null, 2));
