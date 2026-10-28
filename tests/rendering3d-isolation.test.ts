import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { build } from 'vite';
import type { OutputChunk } from 'rollup';
import { expect, test } from 'vitest';
import { gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const normalize = (id: string): string => id.replaceAll('\\', '/');

// Match the production manualChunks boundary independently, so changing that
// boundary cannot silently weaken this test. The loader and type contract are stubs.
function is3dModule(id: string): boolean {
  return /\/(?:node_modules\/three\/|src\/rendering3d\/|src\/rendering\/three-mode\/(?!three-loader\.ts$|contract\.ts$))/.test(normalize(id));
}

function attribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1];
}

test('the 2D HTML entry loads 3D implementation only through dynamic imports', async () => {
  const started = performance.now();
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    // Load the real production config, including its plugins and manualChunks.
    // Runner avoids generating a temporary bundled config; no dist is written.
    const result = await build({
      root,
      mode: 'production',
      configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
      configLoader: 'runner',
      build: { write: false },
    });
    if ('on' in result) throw new Error('Expected Rollup output, received a watcher');
    const output = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
    const chunks = output.filter((item): item is OutputChunk => item.type === 'chunk');
    const byName = new Map(chunks.map(chunk => [chunk.fileName, chunk]));
    const entryCandidates = chunks.filter(chunk => chunk.isEntry
      && normalize(chunk.facadeModuleId ?? '').endsWith('/index.html')
      && chunk.moduleIds.some(id => normalize(id).endsWith('/src/main.ts')));
    expect(entryCandidates.map(chunk => chunk.fileName), 'index.html → src/main.ts entry').toHaveLength(1);
    const entry = entryCandidates[0]!;
    const htmlAsset = output.find(item => item.type === 'asset' && item.fileName === 'index.html');
    if (!htmlAsset || htmlAsset.type !== 'asset') throw new Error('Missing generated index.html');
    const html = typeof htmlAsset.source === 'string'
      ? htmlAsset.source : new TextDecoder().decode(htmlAsset.source);
    const outputPath = (href: string): string => new URL(href, 'https://build.invalid/index.html').pathname.slice(1);
    const scriptEntries = [...html.matchAll(/<script\b[^>]*>/gi)]
      .map(([tag]) => attribute(tag, 'src')).filter((src): src is string => src !== undefined);
    expect(scriptEntries.map(outputPath), 'generated HTML must load the inspected entry').toContain(entry.fileName);

    // Keep the path as evidence: a regression reports each leaking module and
    // the exact chunk import chain, rather than relying on filenames or sizes.
    function reachable(includeDynamic: boolean): Map<string, string[]> {
      const paths = new Map<string, string[]>([[entry.fileName, [entry.fileName]]]);
      for (const [name, path] of paths) {
        const chunk = byName.get(name);
        if (!chunk) throw new Error(`Missing emitted chunk: ${path.join(' → ')}`);
        const edges = chunk.imports.map(target => ({ target, kind: 'static' }));
        if (includeDynamic) edges.push(...chunk.dynamicImports.map(target => ({ target, kind: 'dynamic' })));
        for (const { target, kind } of edges) {
          if (!paths.has(target)) paths.set(target, [...path, `--${kind} import--> ${target}`]);
        }
      }
      return paths;
    }
    const staticPaths = reachable(false);
    const allPaths = reachable(true);
    const threeDChunks = chunks.filter(chunk => chunk.moduleIds.some(is3dModule));
    const leaks = [...staticPaths].flatMap(([name, path]) => byName.get(name)!.moduleIds
      .filter(is3dModule).map(module => ({ module: normalize(module), chain: path.join(' ') })));
    expect.soft(leaks, '3D modules reachable from the 2D entry using only static imports').toEqual([]);

    const staticModuleIds = [...staticPaths.keys()].flatMap(name => byName.get(name)!.moduleIds).map(normalize);
    expect(staticModuleIds.filter(id => /\/src\/simulation\/restore-checks\//.test(id)),
      'restore-checks must not be in entry static reachable chunks').toEqual([]);

    const soloChunks = chunks.filter(chunk => chunk.fileName.startsWith('assets/solo/'));
    expect(soloChunks.length, 'solo functionality must actually be emitted').toBeGreaterThan(0);
    for (const chunk of soloChunks) {
      expect(staticPaths.has(chunk.fileName), 'solo code must not be eagerly imported').toBe(false);
      expect(allPaths.has(chunk.fileName), 'solo functionality must remain reachable on demand').toBe(true);
    }
    const soloModules = soloChunks.flatMap(chunk => chunk.moduleIds).map(normalize);
    for (const module of ['src/m6/application.ts', 'src/simulation/serialization-structure.ts', 'src/simulation/b8-restore.ts', 'src/simulation/restore-checks/fold-provenance.ts', 'src/simulation/restore-checks/shop-history-check.ts']) {
      expect(soloModules.some(id => id.endsWith(`/${module}`)), module).toBe(true);
    }
    console.info('solo JS gzip-9:', soloChunks.reduce((sum, chunk) => sum + gzipSync(chunk.code, { level: 9 }).length, 0));
    const uiChunks = chunks.filter(chunk => chunk.fileName.startsWith('assets/ui/'));
    expect(uiChunks.length, 'pure UI data must actually be emitted').toBeGreaterThan(0);
    for (const chunk of uiChunks) {
      expect(staticPaths.has(chunk.fileName), 'UI text must never be eagerly imported').toBe(false);
      if (!chunk.moduleIds.some(id => /unit-panel(?:-style)?\.ts$/.test(id))) {
        expect(chunk.imports, 'UI data must not pull the application or domain back in').toEqual([]);
      }
      expect(allPaths.has(chunk.fileName), 'UI data must be reachable on demand').toBe(true);
      expect(chunk.moduleIds.every(id => /\/src\/presentation\//.test(normalize(id)))).toBe(true);
    }
    const inspect = uiChunks.find(chunk => chunk.moduleIds.some(id => id.endsWith('/unit-panel.ts')));
    expect(inspect, 'inspect panel must be in an on-demand UI chunk').toBeDefined();
    expect(staticPaths.has(inspect!.fileName), 'inspect panel must not enter the static entry graph').toBe(false);
    for (const chunk of threeDChunks) {
      expect(chunk.imports.filter(name => !name.startsWith('assets/3d/')),
        '3D chunks must not import 2D or UI chunks').toEqual([]);
    }
    const gzip2d = chunks.filter(chunk => /^assets\/[^/]+\.js$/.test(chunk.fileName))
      .reduce((sum, chunk) => sum + gzipSync(chunk.code, { level: 9 }).length, 0);
    // v25 临时上限，当前实测 665,354，目标收回到 637,144
    expect(gzip2d, 'unchanged production JS hard limit').toBeLessThan(670_000);

    const preloads = [...html.matchAll(/<link\b[^>]*>/gi)]
      .filter(([tag]) => attribute(tag, 'rel')?.toLowerCase().split(/\s+/).includes('modulepreload'))
      .map(([tag]) => attribute(tag, 'href')).filter((href): href is string => href !== undefined);
    expect([...preloads, ...scriptEntries].filter(href => outputPath(href).startsWith('assets/solo/')), 'HTML must not preload solo code').toEqual([]);
    const threeDNames = new Set(threeDChunks.map(chunk => chunk.fileName));
    expect.soft(preloads.filter(href => threeDNames.has(outputPath(href))), 'HTML must not preload 3D chunks').toEqual([]);

    // Positive controls: the current loader dynamically imports this renderer,
    // and it really bundles Three.js. Absence of 3D output must never pass.
    expect.soft(threeDChunks.length, '3D chunks must be emitted').toBeGreaterThan(0);
    const threeDModules = threeDChunks.flatMap(chunk => chunk.moduleIds).map(normalize);
    expect.soft(threeDModules.some(id => id.includes('/node_modules/three/')), 'Three.js must be present in 3D output').toBe(true);
    expect.soft(threeDModules.some(id => id.endsWith('/src/rendering/three-mode/placeholder-renderer.ts')),
      'the renderer dynamically imported by three-loader.ts must be emitted').toBe(true);
    expect.soft(threeDChunks.filter(chunk => !allPaths.has(chunk.fileName)).map(chunk => chunk.fileName),
      'every 3D chunk must be reachable when dynamic imports are followed').toEqual([]);
    expect.soft(threeDChunks.filter(chunk => staticPaths.has(chunk.fileName)).map(chunk => ({
      chunk: chunk.fileName, chain: staticPaths.get(chunk.fileName),
    })), 'every path from the 2D entry to 3D must cross a dynamic import').toEqual([]);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    console.info(`2D entry isolation build and assertions: ${Math.round(performance.now() - started)} ms`);
  }
}, 240_000);
