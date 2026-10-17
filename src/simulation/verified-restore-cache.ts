import { canonicalContent, CONTENT_DIGEST, digestContent } from './content';
import { M8_VERSION } from './m8/version';
import { G23_POLICY } from './content/g2-3-policy';

/** Exact verified inputs only. Hash is an index, never an equality proof. */
export function verifiedRestoreKey(input: unknown): string {
  return canonicalContent({ identity: { version: M8_VERSION, policyRevision: G23_POLICY.revision,
    contentDigest: CONTENT_DIGEST }, input });
}
/** Bounds apply to retained canonical UTF-16 payload bytes; object overhead is not a heap measurement. */
export class VerifiedRestoreCache<T> {
  private readonly entries = new Map<string, { key: string; value: T; bytes: number }>();
  private bytes = 0;
  constructor(private readonly maxEntries = 8, private readonly maxBytes = 8 * 1024 * 1024) {}
  get(key: string): T | undefined {
    const hash = digestContent(key), entry = this.entries.get(hash);
    if (!entry || entry.key !== key) return undefined;
    this.entries.delete(hash); this.entries.set(hash, entry);
    return structuredClone(entry.value);
  }
  put(key: string, value: T): void {
    const copy = structuredClone(value);
    const bytes = 2 * (key.length + canonicalContent(copy).length);
    if (bytes > this.maxBytes || this.maxEntries < 1) return;
    const hash = digestContent(key), old = this.entries.get(hash);
    if (old) { this.bytes -= old.bytes; this.entries.delete(hash); }
    while (this.entries.size >= this.maxEntries || this.bytes + bytes > this.maxBytes) {
      const oldest = this.entries.keys().next().value!;
      this.bytes -= this.entries.get(oldest)!.bytes; this.entries.delete(oldest);
    }
    this.entries.set(hash, { key, value: copy, bytes }); this.bytes += bytes;
  }
}
