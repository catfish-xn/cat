import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(process.cwd(), 'src', 'server');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => { const entry = join(dir, name); return statSync(entry).isDirectory() ? files(entry) : entry.endsWith('.ts') ? [entry] : []; });
}
const FORBIDDEN = [/phaser/i, /\bdocument\b/, /\bwindow\b/, /Math\.random/, /Date\.now/, /performance\.now/, /\bsetTimeout\b/, /\bsetInterval\b/, /WebSocket/, /\bfetch\(/, /\bprocess\b/, /from 'ws'/, /from 'node:/];

/**
 * Explicit exceptions (work orders C3 step 2 and B2): the real-clock adapter is the only file that
 * reads the real clock; the network layer may use ws, node:crypto, node:http (G3 /healthz) and the WebSocket API; the Node
 * entry and the test client may read process. Nothing else in src/server may.
 */
const ALLOWED: Readonly<Record<string, readonly RegExp[]>> = {
  'room/real-clock.ts': [/performance\.now/, /\bsetTimeout\b/],
  'net/server.ts': [/WebSocket/, /from 'ws'/, /from 'node:/],
  'net/session.ts': [/from 'node:/],
  'net/test-client.ts': [/WebSocket/, /\bsetTimeout\b/, /\bprocess\b/],
  'main.ts': [/\bprocess\b/],
};

describe('src/server stays pure', () => {
  it('has no browser, network, real-clock or ambient-random dependency outside the listed adapters', () => {
    const sources = files(ROOT);
    expect(sources.length).toBeGreaterThan(0);
    for (const file of sources) {
      const source = readFileSync(file, 'utf8');
      const key = relative(ROOT, file).split('\\').join('/');
      const allowed = ALLOWED[key] ?? [];
      for (const pattern of FORBIDDEN) {
        if (allowed.some(exception => exception.source === pattern.source)) continue;
        expect(source, `${key} matches ${pattern}`).not.toMatch(pattern);
      }
      expect(source, `${key} imports outside simulation/server`).not.toMatch(/from '\.\.\/(\.\.\/)?(rendering|presentation|main)/);
    }
  });
  it('keeps node:crypto in session.ts and ws in server.ts only', () => {
    for (const file of files(ROOT)) {
      const key = relative(ROOT, file).split('\\').join('/');
      const source = readFileSync(file, 'utf8');
      if (key !== 'net/session.ts') expect(source, `${key} imports node:crypto`).not.toMatch(/from 'node:crypto'/);
      if (key !== 'net/server.ts') expect(source, `${key} imports ws`).not.toMatch(/from 'ws'/);
    }
  });
  it('lets src/server/net reach the room only through its public modules and never the simulation directly', () => {
    for (const file of files(join(ROOT, 'net'))) {
      const source = readFileSync(file, 'utf8');
      const imports = [...source.matchAll(/from '([^']+)'/g)].map(match => match[1]!);
      for (const target of imports) {
        const value = /^\.\.\/\.\.\/simulation\//.test(target);
        const typeOnly = new RegExp(`import type [^;]*from '${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`).test(source);
        if (value) expect(typeOnly, `${relative(ROOT, file)} imports a value from ${target}`).toBe(true);
      }
    }
  });
  it('declares the shared protocol once, as pure types', () => {
    const protocol = readFileSync(join(ROOT, 'protocol.ts'), 'utf8');
    expect(protocol).not.toMatch(/^(export )?(function|class|const (?!ROOM_))/m);
    const roomTypes = readFileSync(join(ROOT, 'room', 'types.ts'), 'utf8');
    for (const name of ['PlayerView', 'LobbyView', 'SeatPublic', 'CombatFrame', 'QueueEntry']) expect(roomTypes, `${name} redeclared in room/types.ts`).not.toMatch(new RegExp(`^export interface ${name}\\b`, 'm'));
    expect(roomTypes).not.toMatch(/^export type SeatCommand =\s*\|/m);
  });
});
