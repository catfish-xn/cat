import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'cat-main-seed-'));
const entry = join(directory, 'main.mjs');
const env: NodeJS.ProcessEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('CAT_') && key !== 'PORT'));
// Bundle dependencies too: the temporary entry lives outside node_modules resolution.
beforeAll(async () => {
  await build({ entryPoints: ['src/server/main.ts'], outfile: entry, bundle: true, platform: 'node', format: 'esm', target: 'node22.12', banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" } });
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe('CAT_SEED startup configuration', () => {
  it.each(['4294967296', '9007199254740992', '-1', '1.5', 'NaN', 'Infinity', 'abc'])('rejects %s before starting a server', raw => {
    const result = spawnSync(process.execPath, [entry], { env: { ...env, CAT_PORT: '0', CAT_SEED: raw }, encoding: 'utf8', timeout: 5_000 });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`CAT_SEED must be a uint32 integer (0..4294967295), got "${raw}"`);
    expect(result.stdout).not.toContain('server.listening');
    expect(result.stdout).not.toContain('config.seed');
  });

  it.each(['0', '4294967295', undefined])('starts with CAT_SEED=%s and logs the selected seed', async raw => {
    const child = spawn(process.execPath, [entry], { env: { ...env, CAT_PORT: '0', ...(raw === undefined ? {} : { CAT_SEED: raw }) }, timeout: 5_000 });
    let stdout = '', stderr = '', stopping = false;
    child.stdout.on('data', data => {
      stdout += data;
      if (!stopping && stdout.includes('server.listening')) {
        stopping = true;
        child.kill('SIGTERM');
      }
    });
    child.stderr.on('data', data => { stderr += data; });
    const [code] = await once(child, 'close');
    expect(stderr).toBe('');
    expect(code).toBe(0);
    const records = stdout.trim().split('\n').map(line => JSON.parse(line));
    const config = records.find(record => record.event === 'config.seed');
    expect(config).toBeDefined();
    if (raw === undefined) {
      // #421: unset means an OS-random uint32 per process, not a fixed legacy seed.
      expect(config.source).toBe('random');
      expect(Number.isInteger(config.seed)).toBe(true);
      expect(config.seed).toBeGreaterThanOrEqual(0);
      expect(config.seed).toBeLessThanOrEqual(0xffffffff);
    } else {
      expect(config).toMatchObject({ source: 'CAT_SEED', seed: Number(raw) });
    }
    expect(records.some(record => record.event === 'server.listening')).toBe(true);
  }, 10_000);
});
