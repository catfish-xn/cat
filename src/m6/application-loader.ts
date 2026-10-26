import type { MatchApplication } from './application';

let application: typeof MatchApplication | null = null;
let pending: Promise<void> | null = null;

/** Solo save/restore/replay validation is unnecessary for the online client.
 * Complete this before constructing the scene in solo mode; commands stay synchronous. */
export function loadSoloApplication(): Promise<void> {
  return pending ??= import('./application').then(module => { application = module.MatchApplication; }).catch(error => {
    pending = null;
    throw error;
  });
}

export function createSoloApplication(...args: ConstructorParameters<typeof MatchApplication>): MatchApplication {
  if (!application) throw new Error('Solo application must be loaded before scene construction');
  return new application(...args);
}
