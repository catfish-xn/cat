import { CubeTexture, DataTexture, Mesh, ShaderMaterial, Texture, AdditiveBlending } from 'three';
import { describe, expect, it } from 'vitest';
import { installProbes } from '../dev/castcmp/probes';

// The emitters probe reads the runtime's running records (any Set holding { system, reserved, fx, until }).
describe('castcmp emitters probe', () => {
  const probes = installProbes(() => 0);
  const material = new ShaderMaterial({
    blending: AdditiveBlending, transparent: true, depthWrite: false,
    defines: { SOFT: '', EROSION: '' },
    uniforms: {
      map: { value: new DataTexture(new Uint8Array(4), 1, 1) },
      mapErosion: { value: new Texture() },
      mapReflection: { value: new CubeTexture(Array.from({ length: 6 }, () => new DataTexture(new Uint8Array(4), 1, 1))) },
      alphaRef: { value: 0.0196 },
      softness: { value: [0.5, 2] },
    },
  });
  const trench = new Mesh(undefined, material); trench.name = 'Trench#4';
  const other = new Mesh(undefined, material); other.name = 'Dust#2';
  const running = new Set<unknown>();
  const rec = { system: 'abc12345', source: 'me', reserved: 1, until: 1, fx: { draws: [{ object: trench, material }, { object: other, material }] } };
  running.add(rec);

  it('reads the named draw: blend, alphaRef, defines, textures and their readiness', () => {
    const { draws } = probes.emitters(['trench']);
    expect(draws).toHaveLength(1);
    const d = draws[0];
    expect(d).toMatchObject({ system: 'abc12345', name: 'Trench#4', index: 0, blending: AdditiveBlending, depthWrite: false, alphaRef: 0.02, defines: { SOFT: '', EROSION: '' } });
    expect(d.uniforms.softness).toEqual([0.5, 2]);
    const tex = Object.fromEntries(d.textures.map((t: any) => [t.uniform, t.ready]));
    expect(tex).toEqual({ map: true, mapErosion: false, mapReflection: true });
  });

  it('lists every draw without a filter and drops stopped systems', () => {
    expect(probes.emitters().draws.map((d: any) => d.name)).toEqual(['Trench#4', 'Dust#2']);
    running.delete(rec);
    expect(probes.emitters().draws).toHaveLength(0);
  });
});
