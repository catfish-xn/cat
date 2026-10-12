import { describe, expect, it } from 'vitest';

// The repository has no Node type definitions; vitest runs in Node, so the builtins load dynamically.
interface Fs { readdirSync(dir: string): string[]; readFileSync(path: string, encoding: 'utf8'): string; statSync(path: string): { isDirectory(): boolean } }
interface Path { join(...parts: string[]): string }
const builtin = <T>(name: string): Promise<T> => import(/* @vite-ignore */ `node:${name}`) as Promise<T>;
const fs = await builtin<Fs>('fs'), path = await builtin<Path>('path');
const cwd = (globalThis as unknown as { process: { cwd(): string } }).process.cwd();
const ROOT = path.join(cwd, 'src', 'server');

function files(dir: string): string[] {
  return fs.readdirSync(dir).flatMap(name => { const entry = path.join(dir, name); return fs.statSync(entry).isDirectory() ? files(entry) : entry.endsWith('.ts') ? [entry] : []; });
}
const FORBIDDEN = [/phaser/i, /\bdocument\b/, /\bwindow\b/, /Math\.random/, /Date\.now/, /performance\.now/, /\bsetTimeout\b/, /\bsetInterval\b/, /WebSocket/, /\bfetch\(/];

describe('src/server stays pure', () => {
  it('has no browser, network, real-clock or ambient-random dependency', () => {
    const sources = files(ROOT);
    expect(sources.length).toBeGreaterThan(0);
    for (const file of sources) {
      const source = fs.readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN) expect(source, `${file} matches ${pattern}`).not.toMatch(pattern);
      expect(source, `${file} imports outside simulation/server`).not.toMatch(/from '\.\.\/\.\.\/(rendering|presentation|main)/);
    }
  });
});
