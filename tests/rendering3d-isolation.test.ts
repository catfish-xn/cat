import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { build } from 'vite';
import type { OutputChunk } from 'rollup';
import { expect, test } from 'vitest';

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

    const preloads = [...html.matchAll(/<link\b[^>]*>/gi)]
      .filter(([tag]) => attribute(tag, 'rel')?.toLowerCase().split(/\s+/).includes('modulepreload'))
      .map(([tag]) => attribute(tag, 'href')).filter((href): href is string => href !== undefined);
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
}, 60_000);
