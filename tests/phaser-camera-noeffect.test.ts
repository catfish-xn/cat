import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { expect, test } from 'vitest';
import { CAMERA_NO_EFFECT } from '../scripts/vite-production-size';

test('the production camera effect stub defines every member accessed by Phaser', () => {
  const root = fileURLToPath(new URL('../node_modules/phaser/src/', import.meta.url));
  const accesses = new Map<string, Set<string>>();
  for (const path of readdirSync(root, { recursive: true, encoding: 'utf8' })) {
    const normalized = path.replaceAll('\\', '/');
    if (!normalized.endsWith('.js') || normalized.startsWith('cameras/2d/effects/')) continue;
    const source = readFileSync(resolve(root, path), 'utf8');
    // Include camera.fooEffect.member, local fooEffect.member and literal
    // bracket access; scan renderers as well as the Camera implementation.
    const pattern = /\b(?:fade|flash|shake|pan|zoom|rotateTo)Effect\b\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*['"]([^'"]+)['"]\s*\])/g;
    for (const match of source.matchAll(pattern)) {
      const member = match[1] ?? match[2]!;
      const locations = accesses.get(member) ?? new Set<string>();
      locations.add(`${normalized}:${source.slice(0, match.index).split('\n').length}`);
      accesses.set(member, locations);
    }
  }
  const defined = new Set([
    ...[...CAMERA_NO_EFFECT.matchAll(/CameraNoEffect\.prototype\.([A-Za-z_$][\w$]*)\s*=/g)].map(match => match[1]),
    ...[...CAMERA_NO_EFFECT.matchAll(/Object\.defineProperty\(CameraNoEffect\.prototype,\s*['"]([^'"]+)['"]/g)].map(match => match[1]),
  ]);
  expect([...accesses.keys()]).toEqual(expect.arrayContaining([
    'postRenderCanvas', 'postRenderWebGL', 'isComplete',
  ]));
  const missing = [...accesses].filter(([member]) => !defined.has(member))
    .map(([member, locations]) => ({ member, locations: [...locations] }));
  expect(missing, 'Phaser camera effect accesses missing from CAMERA_NO_EFFECT').toEqual([]);
});

type NoEffect = {
  camera: object | null;
  isRunning: boolean;
  isComplete: boolean;
  postRenderCanvas: (...args: unknown[]) => boolean;
  postRenderWebGL: (...args: unknown[]) => boolean;
  start: () => void;
  destroy: () => void;
};

test('all trimmed camera effects support rendering and destruction while staying inactive', () => {
  const effects = runInNewContext(`${CAMERA_NO_EFFECT}\nEffects;`) as Record<string, new (camera: object) => NoEffect>;
  expect(Object.keys(effects).sort()).toEqual(['Fade', 'Flash', 'Pan', 'RotateTo', 'Shake', 'Zoom']);
  for (const Effect of Object.values(effects)) {
    const camera = {};
    const effect = new Effect(camera);
    expect(effect.camera).toBe(camera);
    expect(effect.isRunning).toBe(false);
    expect(effect.isComplete).toBe(false);
    // Real renderer arguments must never be used by the inactive effects.
    const unexpectedUse = new Proxy({}, { get() { throw new Error('inactive effect used the renderer'); } });
    expect(effect.postRenderCanvas(unexpectedUse)).toBe(false);
    expect(effect.postRenderWebGL(unexpectedUse, unexpectedUse)).toBe(false);
    expect(() => effect.start()).toThrow('camera effects are not in this build');
    effect.destroy();
    expect(effect.camera).toBeNull();
  }
});
