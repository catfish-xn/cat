import { assertManifest, parseActionEffects, type ActionEffects, type ActionState, type AssetManifest } from './contracts';

/** Snapshot validated action bindings once, outside the render loop. Returns an
 * empty list for an unconfigured unit/action. Never guesses from effect names. */
export function createActionEffectResolver(manifest: AssetManifest, bindings: unknown = manifest.actionEffects ?? {}) {
  assertManifest(manifest);
  const actions: ActionEffects = parseActionEffects(bindings, manifest);
  const paths = new Map(Object.entries(manifest.effects ?? {}).map(([id, effect]) => [id, effect.path]));
  return (unit: string, action: ActionState): readonly { id: string; path: string }[] => {
    const ids = Object.hasOwn(actions, unit) && Object.hasOwn(actions[unit], action) ? actions[unit][action] ?? [] : [];
    return ids.map(id => ({ id, path: paths.get(id)! }));
  };
}
