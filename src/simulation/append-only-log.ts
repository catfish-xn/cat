/** Private append storage. A checkpoint owns a fixed prefix, never the mutable
 * arena's length. Forks copy once; the usual single successor appends in O(1).
 * Publishing a checkpoint materializes an ordinary array, so data descriptors,
 * JSON/structuredClone and older checkpoints keep their original semantics. */
export interface AppendLog<T> {
  readonly entries: readonly T[];
  readonly length: number;
}
const snapshots = new WeakMap<AppendLog<unknown>, readonly unknown[]>();

export function createAppendLog<T>(values: readonly T[] = []): AppendLog<T> {
  return { entries: values.slice(), length: values.length };
}
export function appendLog<T>(before: AppendLog<T>, value: T): AppendLog<T> {
  const entries = before.length === before.entries.length ? before.entries as T[] : before.entries.slice(0, before.length);
  entries.push(value);
  return { entries, length: before.length + 1 };
}
export function logValues<T>(log: AppendLog<T>): readonly T[] {
  let values = snapshots.get(log) as readonly T[] | undefined;
  if (!values) { values = log.entries.slice(0, log.length); snapshots.set(log, values); }
  return values;
}
