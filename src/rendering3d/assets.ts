import { AnimationClip, BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture, type BufferGeometry, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { assertManifest, assetUrl, DEFAULT_ASSET_ROOT, type AssetManifest, type AnimationNames, type CastMetadata } from './contracts';

export interface ModelTemplate { scene: Object3D; animations: AnimationClip[] }
export interface ModelLease extends ModelTemplate, CastMetadata {
  placeholder: boolean;
  animationNames: AnimationNames;
  release(): void;
}
interface Entry { promise: Promise<ModelTemplate>; refs: number; retired: boolean; placeholder: boolean }
export type ReadModel = (url: string) => Promise<ModelTemplate>;

function placeholder(): ModelTemplate {
  const scene = new Group();
  scene.name = 'rendering3d-placeholder';
  scene.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0xff00ff })));
  return { scene, animations: [] };
}
function disposeModel(model: ModelTemplate): void {
  const resources = new Set<{ dispose(): void }>();
  model.scene.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    resources.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      resources.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) resources.add(value);
    }
    // SkeletonUtils gives instances independent bones; templates own bone textures.
    const skeleton = (mesh as import('three').SkinnedMesh).skeleton;
    if (skeleton) resources.add(skeleton);
  });
  resources.forEach(resource => resource.dispose());
}

/** Lazily constructed loader: importing this module never reads DOM globals. */
export async function readGlb(url: string): Promise<ModelTemplate> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`model-http-${response.status}`);
  const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), url.slice(0, url.lastIndexOf('/') + 1));
  return { scene: gltf.scene, animations: gltf.animations };
}

/** Default static particle-GLB adapter. Inject the host's cached/meshopt reader.
 * The reader must return a fresh, owned template: it is disposed after extracting
 * one geometry with its node transform baked in. The effect owns the result.
 * Opt in with readMesh; omitting that hook still skips mesh emitters as before. */
export async function readParticleMesh(url: string, readModel: ReadModel = readGlb): Promise<BufferGeometry> {
  const model = await readModel(url);
  try {
    const meshes: Mesh[] = [];
    model.scene.updateMatrixWorld(true);
    model.scene.traverse(object => { if ((object as Mesh).isMesh) meshes.push(object as Mesh); });
    if (meshes.length !== 1 || (meshes[0] as import('three').SkinnedMesh).isSkinnedMesh) {
      throw new Error('particle-mesh-requires-single-static-mesh');
    }
    return meshes[0].geometry.clone().applyMatrix4(meshes[0].matrixWorld);
  } finally { disposeModel(model); }
}

/** Templates share GPU resources; leases own independent transforms and skeletons.
 * release() relinquishes a lease; evict()/dispose() retire cached templates only
 * after their final lease releases. A disposed cache rejects new loads.
 */
export class ModelCache {
  private entries = new Map<string, Entry>();
  private closed = false;
  readonly manifest: AssetManifest;
  constructor(manifest: unknown, readonly root = DEFAULT_ASSET_ROOT, private read: ReadModel = readGlb) {
    assertManifest(manifest);
    this.manifest = structuredClone(manifest);
  }
  static async fromUrl(url: string, root = DEFAULT_ASSET_ROOT, read?: ReadModel): Promise<ModelCache> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`manifest-http-${response.status}`);
    return new ModelCache(await response.json(), root, read);
  }
  async load(id: string): Promise<ModelLease> {
    if (this.closed) throw new Error('model-cache-disposed');
    let entry = this.entries.get(id);
    if (!entry) {
      const created: Entry = { refs: 0, retired: false, placeholder: false, promise: Promise.resolve(undefined as never) };
      created.promise = Promise.resolve().then(() => {
        const definition = Object.hasOwn(this.manifest.models, id) ? this.manifest.models[id] : undefined;
        if (!definition) throw new Error('unknown-model');
        return this.read(assetUrl(this.root, definition.path));
      }).catch(() => { created.placeholder = true; return placeholder(); });
      entry = created;
      this.entries.set(id, entry);
    }
    entry.refs++;
    const current = entry;
    const model = await current.promise;
    const scene = clone(model.scene);
    let released = false;
    return { scene, animations: model.animations, placeholder: current.placeholder,
      castSequence: this.manifest.models[id]?.castSequence, castVariants: this.manifest.models[id]?.castVariants,
      animationNames: { ...(Object.hasOwn(this.manifest.models, id) ? this.manifest.models[id].animations : {}) },
      release: () => {
        if (released) return;
        released = true;
        scene.removeFromParent();
        scene.traverse(object => { const skeleton = (object as import('three').SkinnedMesh).skeleton; skeleton?.dispose(); });
        if (--current.refs === 0 && current.retired) disposeModel(model);
      } };
  }
  evict(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.entries.delete(id);
    entry.retired = true;
    if (entry.refs === 0) void entry.promise.then(disposeModel);
  }
  dispose(): void { this.closed = true; for (const id of this.entries.keys()) this.evict(id); }
}
