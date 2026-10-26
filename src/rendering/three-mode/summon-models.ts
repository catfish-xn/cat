import type { AssetManifest } from '../../rendering3d';

/**
 * The encounter and augment summon use the client's TFT_BlueGolem character.
 * Reuse an explicitly supplied model, including its clips and scale. Never guess
 * a GLB path or substitute the immobile TFT_TrainingDummy / PvE Krug.
 * Asset publishers may provide models.TFT_BlueGolem, or either gameplay id.
 * This changes only the in-memory manifest; source assets stay outside the repo.
 * The external GLB must be converted from TFT_BlueGolem's base skin SKN/SKL,
 * diffuse texture and sru_blue_*.anm clips, using the skin's own file references.
 */
export function registerGolemModels(manifest: AssetManifest): void {
  const ids = ['trainer-golem', 'augment-golem', 'TFT_BlueGolem'] as const;
  const model = ids.flatMap(id => Object.hasOwn(manifest.models, id) ? [manifest.models[id]] : [])[0];
  if (!model) return;
  for (const id of ids) if (!Object.hasOwn(manifest.models, id)) manifest.models[id] = { ...model };
}
