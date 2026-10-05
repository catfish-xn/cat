/** Content is immutable data. Runtime snapshots receive their own copies. */
export function freezeContent<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeContent(child);
    Object.freeze(value);
  }
  return value;
}
