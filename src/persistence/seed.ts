export type SeedResult = { readonly ok: true; readonly seed: number } | { readonly ok: false; readonly reason: string };
export function parseSeed(text: string): SeedResult {
  const value = text.trim();
  if (!/^\d+$/.test(value)) return { ok: false, reason: '请输入 0 至 4294967295 的十进制整数种子' };
  const seed = Number(value);
  return Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffff_ffff
    ? { ok: true, seed } : { ok: false, reason: '种子必须在 0 至 4294967295 之间' };
}
/** Outside domain simulation; called once only when the user creates a new run. */
export function createSeed(): number { return crypto.getRandomValues(new Uint32Array(1))[0]; }
export function createRunId(): string { return crypto.randomUUID(); }
