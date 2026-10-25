import { build } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// Diagnostic: preserve the production manualChunks boundary. Read final Rollup
// output after Vite resolves preload lists, using the same gzip-9 as the budget.
const relative = (id: string) => id.replace(`${process.cwd()}/`, '');
const modules = new Map<string, { importers: string[]; importedIds: string[] }>();
const result = await build({ mode: 'production', configLoader: 'runner', build: { write: false }, plugins: [{
  name: 'report-bundle-modules',
  generateBundle() {
    for (const id of this.getModuleIds()) {
      const info = this.getModuleInfo(id)!;
      modules.set(id, { importers: info.importers.map(relative), importedIds: info.importedIds.map(relative) });
    }
  },
}] });
if ('on' in result) throw new Error('Expected a build, not a watcher');
const chunks = (Array.isArray(result) ? result : [result]).flatMap(output => output.output)
  .filter(chunk => chunk.type === 'chunk');
const byName = new Map(chunks.map(chunk => [chunk.fileName, chunk]));
const eager = new Set(chunks.filter(chunk => chunk.isEntry).map(chunk => chunk.fileName));
for (const name of eager) for (const dependency of byName.get(name)?.imports ?? []) eager.add(dependency);
const report = chunks.map(chunk => ({ file: chunk.fileName, entry: chunk.isEntry, eager: eager.has(chunk.fileName),
  gzip9: gzipSync(chunk.code, { level: 9 }).length, imports: chunk.imports, dynamicImports: chunk.dynamicImports,
  modules: Object.entries(chunk.modules).map(([id, info]) => ({ id: relative(id),
    bytes: info.renderedLength, ...modules.get(id),
  })).sort((a, b) => b.bytes - a.bytes),
}));
mkdirSync('artifacts/bundle-split', { recursive: true });
writeFileSync(process.env.BUNDLE_REPORT || 'artifacts/bundle-split/modules.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.map(({ modules, ...chunk }) => ({ ...chunk, largest: modules.slice(0, 15) })), null, 2));
