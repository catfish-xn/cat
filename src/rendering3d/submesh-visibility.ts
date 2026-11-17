import type { Material, Mesh, Object3D } from 'three';
import type { SubmeshVisibility } from './contracts';

/** Frames per second of the clip frames that SubmeshVisibility events are written in. */
export const SUBMESH_EVENT_FPS = 30;

/** A model's meshes by material name: one submesh per material, as the exporter writes them. */
function meshesByName(root: Object3D, wanted: ReadonlySet<string>): Map<string, Mesh[]> {
  const found = new Map<string, Mesh[]>();
  root.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const name = (mesh.material as Material | undefined)?.name;
    if (!name || !wanted.has(name)) return;
    const list = found.get(name);
    if (list) list.push(mesh); else found.set(name, [mesh]);
  });
  return found;
}

/** Hide the submeshes a model starts without (a model that does not carry them is left as it is). */
export function hideInitialSubmeshes(root: Object3D, visibility: SubmeshVisibility | undefined): void {
  const hidden = new Set(visibility?.initiallyHidden ?? []);
  if (!hidden.size) return;
  for (const meshes of meshesByName(root, hidden).values()) for (const mesh of meshes) mesh.visible = false;
}

/**
 * Per-clip submesh visibility. Each clip starts from the model's default (every submesh shown except `initiallyHidden`)
 * and its events then show or hide submeshes from their frame to the clip's end; the source data repeats a stance's
 * submeshes in every clip of that stance, so nothing carries over from one clip into the next. Only submeshes named in
 * the model's visibility data are touched.
 */
export class SubmeshSwitch {
  private readonly meshes: Map<string, Mesh[]>;
  private readonly defaults: ReadonlySet<string>;
  private readonly events: Map<string, { seconds: number; show: readonly string[]; hide: readonly string[] }[]>;
  private shown = new Map<string, boolean>();
  private constructor(root: Object3D, visibility: SubmeshVisibility) {
    this.defaults = new Set(visibility.initiallyHidden ?? []);
    const named = new Set(this.defaults);
    this.events = new Map();
    for (const list of Object.values(visibility.events ?? {})) for (const event of list) for (const name of [...event.show, ...event.hide]) named.add(name);
    this.meshes = meshesByName(root, named);
    for (const [clip, list] of Object.entries(visibility.events ?? {})) {
      // A clip that shows a submesh this model lacks would only do half a swap (hide the body, show nothing): it
      // switches nothing until the model carries that submesh.
      if (list.some(event => event.show.some(name => !this.meshes.has(name)))) continue;
      this.events.set(clip, [...list].sort((a, b) => a.frame - b.frame)
        .map(event => ({ seconds: event.frame / SUBMESH_EVENT_FPS, show: event.show, hide: event.hide })));
    }
  }
  /** A switch for this model, or undefined when the model carries none of the named submeshes. */
  static create(root: Object3D, visibility: SubmeshVisibility | undefined): SubmeshSwitch | undefined {
    if (!visibility) return undefined;
    const created = new SubmeshSwitch(root, visibility);
    return created.meshes.size ? created : undefined;
  }
  /** Show each submesh as `clip` has it `seconds` into its playback (no clip: the model's default). */
  apply(clip: string | undefined, seconds: number): void {
    const shown = new Map<string, boolean>();
    for (const name of this.meshes.keys()) shown.set(name, !this.defaults.has(name));
    for (const event of (clip !== undefined ? this.events.get(clip) : undefined) ?? []) {
      if (event.seconds > seconds + 1e-6) break;
      for (const name of event.show) if (shown.has(name)) shown.set(name, true);
      for (const name of event.hide) if (shown.has(name)) shown.set(name, false);
    }
    for (const [name, visible] of shown) {
      if (this.shown.get(name) === visible) continue;
      for (const mesh of this.meshes.get(name)!) mesh.visible = visible;
    }
    this.shown = shown;
  }
}
