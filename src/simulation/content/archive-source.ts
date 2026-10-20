import { freezeContent } from './freeze';

/** Reassemble complete archived rows for offline identity/provenance checks only. */
export function restoreArchiveColumns<
  R extends Record<string, object>,
  A extends { [K in keyof R]: object },
>(runtime: R, archive: A): { readonly [K in keyof R]: R[K] & A[K] } {
  const ids = Object.keys(runtime);
  if (ids.length !== Object.keys(archive).length || ids.some(id => !Object.hasOwn(archive, id)))
    throw new Error('Archive/runtime row identities differ');
  const rows = Object.fromEntries(ids.map(id => {
    const notes = archive[id as keyof R];
    if (Object.keys(notes).some(key => Object.hasOwn(runtime[id], key)))
      throw new Error(`Archive/runtime columns overlap: ${id}`);
    return [id, { ...runtime[id], ...notes }];
  }));
  return freezeContent(rows) as { readonly [K in keyof R]: R[K] & A[K] };
}
