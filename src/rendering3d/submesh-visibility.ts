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

const namedIn = (visibility: SubmeshVisibility) => new Set([...(visibility.initiallyHidden ?? []),
  ...Object.values(visibility.events ?? {}).flatMap(list => list.flatMap(event => [...event.show, ...event.hide]))]);
const lacking = (list: readonly { show: readonly string[] }[], has: (name: string) => boolean) =>
  [...new Set(list.flatMap(event => event.show.filter(name => !has(name))))];

/**
 * The clips that switch nothing on this model because they show a submesh it lacks (the geometry switch was off when
 * it was built), with the names it lacks. The model cache prints them when it loads a model.
 */
export function unswitchedClips(root: Object3D, visibility: SubmeshVisibility | undefined): { clip: string; missing: string[] }[] {
  if (!visibility?.events) return [];
  const meshes = meshesByName(root, namedIn(visibility));
  return Object.entries(visibility.events).map(([clip, list]) => ({ clip, missing: lacking(list, name => meshes.has(name)) }))
    .filter(entry => entry.missing.length);
}

/**
 * Submeshes kept at their default per model: a clip that would show one of them switches nothing, and the geometry stays
 * in the model. drmundo: his ultimate body follows his timed form (TIMED_FORMS), not his clips (Fable 2026-11-17).
 */
export const HELD_SUBMESHES: Readonly<Record<string, readonly string[]>> = { drmundo: ['BodyUlt'] };

/** The model's visibility without the clips that show a held submesh (the visibility itself when nothing is held). */
export function withoutHeld(visibility: SubmeshVisibility | undefined, held: readonly string[] | undefined): SubmeshVisibility | undefined {
  if (!visibility?.events || !held?.length) return visibility;
  const events = Object.fromEntries(Object.entries(visibility.events).filter(([, list]) => !list.some(event => event.show.some(name => held.includes(name)))));
  return { ...visibility, events };
}

/**
 * Timed forms per model: while one is on (rule events say when, see timed-form-events.ts) its submeshes are shown and
 * hidden over whatever clip plays. drmundo: his ultimate body from his first heal to his closing blast (Fable 2026-11-17).
 */
export const TIMED_FORMS: Readonly<Record<string, { readonly show: readonly string[]; readonly hide: readonly string[] }>> = {
  drmundo: { show: ['BodyUlt'], hide: ['BodyNormal'] },
};

/** Hide the submeshes a model starts without (a model that does not carry them is left as it is). */
export function hideInitialSubmeshes(root: Object3D, visibility: SubmeshVisibility | undefined): void {
  const hidden = new Set(visibility?.initiallyHidden ?? []);
  if (!hidden.size) return;
  for (const meshes of meshesByName(root, hidden).values()) for (const mesh of meshes) mesh.visible = false;
}

/**
 * Per-clip submesh visibility. Each clip starts from the model's default (every submesh shown except `initiallyHidden`)
 * and its events then show or hide submeshes from their frame to the clip's end; nothing carries over from one clip
 * into the next (Fable 2026-11-17). Only submeshes named in
 * the model's visibility data are touched.
 */
export class SubmeshSwitch {
  private readonly meshes: Map<string, Mesh[]>;
  private readonly defaults: ReadonlySet<string>;
  private readonly events: Map<string, { seconds: number; show: readonly string[]; hide: readonly string[] }[]>;
  private shown = new Map<string, boolean>();
  private form?: { readonly show: readonly string[]; readonly hide: readonly string[] };
  private constructor(root: Object3D, visibility: SubmeshVisibility, form?: { readonly show: readonly string[]; readonly hide: readonly string[] }) {
    this.defaults = new Set(visibility.initiallyHidden ?? []);
    this.events = new Map();
    this.formDef = form; this.formNames = form && [...form.show, ...form.hide];
    this.meshes = meshesByName(root, new Set([...namedIn(visibility), ...(this.formNames ?? [])]));
    for (const [clip, list] of Object.entries(visibility.events ?? {})) {
      // A clip that shows a submesh this model lacks would only do half a swap (hide the body, show nothing): it
      // switches nothing until the model carries that submesh (see unswitchedClips).
      if (lacking(list, name => this.meshes.has(name)).length) continue;
      this.events.set(clip.toLowerCase(), [...list].sort((a, b) => a.frame - b.frame)
        .map(event => ({ seconds: event.frame / SUBMESH_EVENT_FPS, show: event.show, hide: event.hide })));
    }
  }
  /** A switch for this model, or undefined when the model carries none of the named submeshes. */
  static create(root: Object3D, visibility: SubmeshVisibility | undefined, form?: { readonly show: readonly string[]; readonly hide: readonly string[] }): SubmeshSwitch | undefined {
    if (!visibility && !form) return undefined;
    const created = new SubmeshSwitch(root, visibility ?? {}, form);
    return created.meshes.size ? created : undefined;
  }
  /**
   * Turn the model's timed form on or off; it overrides every clip while on. A form whose submeshes the model does not
   * all carry stays off (no half a body).
   */
  setForm(on: boolean): void { this.form = on && this.formNames && this.formNames.every(name => this.meshes.has(name)) ? this.formDef : undefined; }
  get formOn(): boolean { return this.form !== undefined; }
  private formDef?: { readonly show: readonly string[]; readonly hide: readonly string[] };
  private formNames?: readonly string[];
  /** Show each submesh as `clip` has it `seconds` into its playback (no clip: the model's default). Clip names compare
   * case-insensitively: the manifest keys clips by their lowercase source name. */
  apply(clip: string | undefined, seconds: number): void {
    const shown = new Map<string, boolean>();
    for (const name of this.meshes.keys()) shown.set(name, !this.defaults.has(name));
    for (const event of (clip !== undefined ? this.events.get(clip.toLowerCase()) : undefined) ?? []) {
      if (event.seconds > seconds + 1e-6) break;
      for (const name of event.show) if (shown.has(name)) shown.set(name, true);
      for (const name of event.hide) if (shown.has(name)) shown.set(name, false);
    }
    for (const name of this.form?.show ?? []) shown.set(name, true);
    for (const name of this.form?.hide ?? []) shown.set(name, false);
    for (const [name, visible] of shown) {
      if (this.shown.get(name) === visible) continue;
      for (const mesh of this.meshes.get(name)!) mesh.visible = visible;
    }
    this.shown = shown;
  }
}
