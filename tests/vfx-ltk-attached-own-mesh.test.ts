import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BoxGeometry, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { ATTACHED_OWN_MESH_DRAWN, MUTED_EMITTERS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { attachedMeshOfItsOwn, createVfxLibrary, withOwnMeshesDrawn } from '../src/rendering/three-mode/vfx-ltk/loader';
import { QUAD_TYPE } from '../src/rendering/three-mode/vfx-ltk/engine/model/enums';
import type { VfxValue } from '../src/rendering/three-mode/vfx-ltk/bindings';
import { syntheticIndex, syntheticSystem, struct } from './vfx-ltk-synthetic';
import { binaryFixture } from './vfx-ltk-binary-fixture';

// Fable 11-24: an attached mesh naming a static mesh of its own stays undrawn, except Renata's crit missile body (whitelist).
const own = (name: string) => ({ name, quadType: QUAD_TYPE.attachedMesh, mesh: { skinned: false } });
describe('attached meshes of their own: a whitelist', () => {
  it('names only Renata\'s crit missile body; Sevika\'s punch-hit bubble stays muted', () => {
    expect(ATTACHED_OWN_MESH_DRAWN).toEqual({ d7729373: ['Alpha_Bullet', 'Add_Bullet'] });
    expect(MUTED_EMITTERS['95fb90ce']).toContain('BUBBLE_START1');
  });
  it('turns the named emitters of the named system into mesh particles, and nothing else', () => {
    const model = { emitters: [own('Alpha_Bullet'), own('Add_Bullet'), own('Other'), { name: 'Body', quadType: QUAD_TYPE.attachedMesh, mesh: { skinned: true } }] };
    const drawn = withOwnMeshesDrawn('d7729373', model);
    expect(drawn.emitters.map(e => e.quadType)).toEqual([QUAD_TYPE.mesh, QUAD_TYPE.mesh, QUAD_TYPE.attachedMesh, QUAD_TYPE.attachedMesh]);
    expect(drawn.emitters.filter(attachedMeshOfItsOwn).map(e => e.name)).toEqual(['Other']);
    // Another system with the same emitter names keeps them undrawn.
    expect(withOwnMeshesDrawn('95fb90ce', model)).toBe(model);
  });
});

// The loader itself, on a synthetic system (no exported data): an attached mesh naming a static mesh of its own is drawn as a
// mesh particle, with that mesh loaded, only under a whitelisted system id and emitter name.
const asset = (path: string): VfxValue => ({ type: 'asset', path, asset: { kind: 'file', path: '/synthetic/' + path } });
const ownMeshEmitter = (name: string) => ({ emitterName: { type: 'string', value: name } as VfxValue,
  primitive: struct('VfxPrimitiveAttachedMesh', { mMesh: struct('VfxMeshDefinitionData', { mSimpleMeshName: asset('canister.scb') }) }) });
async function loadAs(id: string, name: string) {
  const index = { ...syntheticIndex(), systems: { [id]: 'systems/one.json' }, assets: { ...syntheticIndex().assets, 'canister.scb': 'meshes/canister.ltkg' }, skills: {} };
  const library = createVfxLibrary('/root/', {
    readJson: async url => url.endsWith('index.json') ? index : syntheticSystem(ownMeshEmitter(name)),
    readTexture: async () => new Texture(),
    readBinary: async () => binaryFixture('mesh', false, false),
  });
  const prepared = await library.load(id);
  return { library, prepared };
}
describe('the loader with a synthetic own-mesh attachment', () => {
  it('draws a whitelisted one as a mesh particle with its mesh, and leaves any other undrawn', async () => {
    const listed = await loadAs('d7729373', 'Alpha_Bullet');
    expect(listed.prepared.drawn.map(d => [d.emitter.name, d.emitter.quadType])).toEqual([['Alpha_Bullet', QUAD_TYPE.mesh]]);
    expect(listed.prepared.meshes.size).toBe(1);
    listed.library.dispose();
    for (const [id, name] of [['d7729373', 'Other'], ['95fb90ce', 'Alpha_Bullet']] as const) {
      const other = await loadAs(id, name);
      expect(other.prepared.drawn).toEqual([]);
      expect(other.prepared.model.emitters.map(e => e.quadType)).toEqual([QUAD_TYPE.attachedMesh]);
      other.library.dispose();
    }
  });
});

// With the assets (VFX_LTK_ROOT = an asset root's vfx-ltk folder): the loaded crit missile draws its body as meshes.
const root = process.env.VFX_LTK_ROOT;
describe.skipIf(!root)('Renata\'s crit missile with the assets (VFX_LTK_ROOT)', () => {
  it('draws its body as mesh particles with their own mesh; the punch-hit bubble stays undrawn', async () => {
    const lib = createVfxLibrary('/root/', { readJson: async u => JSON.parse(readFileSync(join(root!, '..', u.slice('/root/'.length)), 'utf8')),
      readTexture: async () => new Texture(), readMesh: async () => new BoxGeometry(),
      readBinary: async u => { const b = readFileSync(join(root!, '..', u.slice('/root/'.length))); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } }, { groundPass: true });
    const renata: any = await lib.champion('renata');
    const missile = renata.get('d7729373') ?? await renata.load('d7729373');
    const body = missile.drawn.filter((d: any) => ['Alpha_Bullet', 'Add_Bullet'].includes(d.emitter.name));
    expect(body.map((d: any) => [d.emitter.name, d.emitter.quadType])).toEqual([['Alpha_Bullet', QUAD_TYPE.mesh], ['Add_Bullet', QUAD_TYPE.mesh]]);
    const sevika: any = await lib.champion('sevika');
    const hit = sevika.get('95fb90ce') ?? await sevika.load('95fb90ce');
    expect(hit.drawn.map((d: any) => d.emitter.name)).not.toContain('BUBBLE_START1');
  }, 120000);
});
