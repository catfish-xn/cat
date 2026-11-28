import { describe, expect, it } from 'vitest';
import { applyDrawFilter, drawFilterOf } from '../dev/castcmp/probes';

/** A running record's draw as the probe sees it: an object with a name, a layer mask, and a material. Synthetic. */
const draw = (name: string, erosion = false) => ({ object: { name: `${name}#1.5`, layers: { mask: 0b10 }, userData: {} as any },
  material: { colorWrite: true, defines: erosion ? { EROSION: '' } : {}, needsUpdate: false } as any });
const rec = (system: string, ...draws: ReturnType<typeof draw>[]) => ({ system, fx: { draws } });

describe('castcmp draw filter', () => {
  it('reads its lists from the URL, --only from the URL or window.__only', () => {
    expect(drawFilterOf('?mute=a,b&solo=sys:c&nocolor=STENCIL&noerode=x')).toEqual({ only: null, mute: ['a', 'b'], solo: ['sys:c'], nocolor: ['STENCIL'], noerode: ['x'] });
    expect(drawFilterOf('?unit=viktor', 'abc12345').only).toBe('abc12345');
    expect(drawFilterOf('?only=def67890', 'abc12345').only).toBe('def67890');
  });

  it('--only draws one system alone', () => {
    const kept = rec('aaaa1111', draw('A')), other = rec('bbbb2222', draw('B'));
    const f = drawFilterOf('', 'aaaa1111'); applyDrawFilter(f, kept); applyDrawFilter(f, other);
    expect(kept.fx.draws[0]!.object.layers.mask).toBe(0b10); expect(other.fx.draws[0]!.object.layers.mask).toBe(0);
  });

  it('--mute leaves an emitter out, --solo draws its system\'s named emitters alone, other systems untouched', () => {
    const r = rec('s1', draw('Glow'), draw('STENCIL_MASK_WRITE3'), draw('Ring'));
    applyDrawFilter(drawFilterOf('?mute=Glow'), r);
    expect(r.fx.draws.map(d => d.object.layers.mask)).toEqual([0, 0b10, 0b10]);
    const s = rec('s1', draw('Glow'), draw('STENCIL_MASK_WRITE3')), t = rec('s2', draw('Other'));
    const f = drawFilterOf('?solo=STENCIL_MASK_WRITE3'); applyDrawFilter(f, s); applyDrawFilter(f, t);
    expect(s.fx.draws.map(d => d.object.layers.mask)).toEqual([0, 0b10]);
    expect(t.fx.draws[0]!.object.layers.mask).toBe(0b10);
    // system:emitter limits an entry to that system.
    const u = rec('s3', draw('STENCIL_MASK_WRITE3')); applyDrawFilter(drawFilterOf('?mute=s1:STENCIL_MASK_WRITE3'), u);
    expect(u.fx.draws[0]!.object.layers.mask).toBe(0b10);
  });

  it('--nocolor turns colour writes off and keeps the draw; --noerode takes the EROSION define out', () => {
    const r = rec('s1', draw('STENCIL_MASK_WRITE3', true), draw('Ring', true));
    applyDrawFilter(drawFilterOf('?nocolor=STENCIL_MASK_WRITE3&noerode=STENCIL_MASK_WRITE3'), r);
    const [stencil, ring] = r.fx.draws;
    expect(stencil!.object.layers.mask).toBe(0b10);
    expect(stencil!.material.colorWrite).toBe(false); expect('EROSION' in stencil!.material.defines).toBe(false); expect(stencil!.material.needsUpdate).toBe(true);
    expect(ring!.material.colorWrite).toBe(true); expect('EROSION' in ring!.material.defines).toBe(true);
  });

  it('applying again keeps the original mask (a muted draw comes back when the filter no longer names it)', () => {
    const r = rec('s1', draw('Glow'));
    applyDrawFilter(drawFilterOf('?mute=Glow'), r); expect(r.fx.draws[0]!.object.layers.mask).toBe(0);
    applyDrawFilter(drawFilterOf(''), r); expect(r.fx.draws[0]!.object.layers.mask).toBe(0b10);
  });
});
