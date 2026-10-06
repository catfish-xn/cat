/**
 * Per-viewer presentation preferences. Never part of Match, rules hashes or saves.
 * Storage may be unavailable (private mode, blocked site data): every access is guarded
 * and the game falls back to defaults without blocking play.
 */
const KEY = 'hex.m7.reducedMotion';
let cached: boolean | null = null;

function systemPrefersReduced(): boolean {
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
export function reducedMotion(): boolean {
  if (cached !== null) return cached;
  let stored: string | null = null;
  try { stored = localStorage.getItem(KEY); } catch { stored = null; }
  cached = stored === null ? systemPrefersReduced() : stored === '1';
  return cached;
}
export function setReducedMotion(value: boolean): void {
  cached = value;
  try { localStorage.setItem(KEY, value ? '1' : '0'); } catch { /* preference stays for this page only */ }
}
/** Test hook: forget the cached value. */
export function resetPreferenceCache(): void { cached = null; }
