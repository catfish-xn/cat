import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { frameTime, frames } = require('../dev/castcmp/frames.cjs') as {
  frameTime: (name: string) => number | null;
  frames: (dir: string) => { t: number; file: string }[];
};

describe('castcmp frame files', () => {
  let dir = '';
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = ''; });

  it('reads a time of any width from 4 digits up', () => {
    expect(frameTime('jinx-0033.jpg')).toBe(33);
    expect(frameTime('jinx-9967.jpg')).toBe(9967);
    expect(frameTime('jinx-10033.jpg')).toBe(10033);
    expect(frameTime('jinx-123456.jpg')).toBe(123456);
    expect(frameTime('jinx-033.jpg')).toBeNull();
    expect(frameTime('e138w-jinx-10fede7e.jpg')).toBeNull();
    expect(frameTime('jinx-10033.png')).toBeNull();
  });

  it('lists frames after 10 s and sorts them by time', () => {
    dir = mkdtempSync(join(tmpdir(), 'castcmp-frames-'));
    for (const name of ['jinx-12300.jpg', 'jinx-2000.jpg', 'jinx-0000.jpg', 'jinx-10033.jpg', 'gate.json', 'jinx-9967.jpg']) writeFileSync(join(dir, name), '');
    expect(frames(dir).map(f => f.t)).toEqual([0, 2000, 9967, 10033, 12300]);
    expect(frames(dir).filter(f => f.t >= 12300 && f.t <= 14300)).toHaveLength(1);
  });
});
