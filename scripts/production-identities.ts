import { createServer, type Plugin } from 'vite';

/** Evaluate frozen content at build time, using the same public modules as Node/tests.
 * This removes identity-only catalogs from the browser without changing their hashes.
 * Runtime ledger/state hashes still use the original digestContent implementation.
 */
export function productionIdentities(): Plugin {
  let contentDigest: string, lootReplayDigest: string;
  const catalogs = [
    ['g2-3-special-item-source', 'G23_SPECIAL_ITEM_SOURCE', ['name', 'values', 'unique']],
    ['g2-3-trait-source', 'G23_TRAIT_SOURCE', ['name', 'enabled', 'tiers']],
    ['g2-4-artifact-source', 'G24_ARTIFACT_SOURCE', ['zhName', 'unique', 'values']],
    ['g2-4-support-item-source', 'G24_SUPPORT_ITEM_SOURCE', ['name', 'unique', 'values']],
  ] as const;
  const runtimeCatalogs = new Map<string, { name: string; value: string }>();
  return {
    name: 'production-identities',
    apply: 'build',
    async buildStart() {
      const server = await createServer({ configFile: false, cacheDir: 'artifacts/identity-cache',
        optimizeDeps: { noDiscovery: true, include: [] },
        server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error' });
      try {
        contentDigest = (await server.ssrLoadModule('/src/simulation/content/index.ts')).CONTENT_DIGEST;
        lootReplayDigest = (await server.ssrLoadModule('/src/simulation/loot-freeze.ts')).LOOT_REPLAY_DIGEST;
        if (![contentDigest, lootReplayDigest].every(value => /^fnv1a32-utf16:[0-9a-f]{8}$/.test(value)))
          throw new Error('Invalid production content identities');
        this.info(`content=${contentDigest}, loot=${lootReplayDigest}`);
        // Consumers of these four archive tables read only the listed columns.
        // Descriptions/provenance stay in the repository and in the full digest;
        // actual UI text comes from the compiled item/trait definitions.
        for (const [file, name, columns] of catalogs) {
          const source = (await server.ssrLoadModule(`/src/simulation/content/${file}.ts`))[name];
          const value = Object.fromEntries(Object.entries(source).map(([id, row]) => [id,
            Object.fromEntries(columns.map(key => [key, (row as Record<string, unknown>)[key]]))]));
          runtimeCatalogs.set(file + '.ts', { name, value: JSON.stringify(value) });
        }
      } finally { await server.close(); }
    },
    transform(code, id) {
      const normalized = id.replaceAll('\\', '/');
      const catalog = normalized.includes('/src/simulation/content/')
        ? runtimeCatalogs.get(normalized.slice(normalized.lastIndexOf('/') + 1)) : undefined;
      if (catalog) {
        const start = code.indexOf(`export const ${catalog.name}`), end = code.indexOf('\n});', start);
        if (start < 0 || end < 0) this.error(`Cannot locate ${catalog.name} initializer`);
        code = code.slice(0, start) + `export const ${catalog.name} = freezeContent(${catalog.value});`
          + code.slice(end + '\n});'.length);
      }
      const name = normalized.endsWith('/src/simulation/content/index.ts') ? 'CONTENT_DIGEST'
        : normalized.endsWith('/src/simulation/loot-freeze.ts') ? 'LOOT_REPLAY_DIGEST' : null;
      if (!name) return { code, map: null };
      const start = code.indexOf(`export const ${name} = digestContent({`);
      const end = code.indexOf('\n});', start);
      if (start < 0 || end < 0) this.error(`Cannot locate ${name} initializer`);
      const value = name === 'CONTENT_DIGEST' ? contentDigest : lootReplayDigest;
      return { code: code.slice(0, start) + `export const ${name} = ${JSON.stringify(value)};`
        + code.slice(end + '\n});'.length), map: null };
    },
  };
}
