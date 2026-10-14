// Same method as docs/evidence/m8-b8/checkpoint-two/measure.mjs: vite production build, then gzip level 9 per emitted JS, summed.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
const [, , label, root, out] = process.argv;
const { build } = await import(createRequire(`${root}/package.json`).resolve('vite'));
const outDir = `${out}/${label}`;
await build({ root, configFile: `${root}/vite.config.ts`, logLevel: 'warn', build: { outDir, emptyOutDir: true } });
const files = readdirSync(`${outDir}/assets`).filter(f => f.endsWith('.js')).sort().map(file => ({ file, gzip9: gzipSync(readFileSync(`${outDir}/assets/${file}`), { level: 9 }).length }));
const result = { label, root, files, total: files.reduce((s, f) => s + f.gzip9, 0) };
writeFileSync(`${out}/${label}.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ label, total: result.total, files: files.length }));
