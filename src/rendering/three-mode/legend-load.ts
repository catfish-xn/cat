/** One way to load a little legend for the tabletop, the carousel and the 外观 panel (3D chunk only). */
import type { ModelLease } from '../../rendering3d';

export const LEGEND_MODEL = 'little-legend-default';
/** Little legends' model ids all share this prefix (the 外观 panel draws them too). */
export const isLegendModel = (id: string): boolean => id.startsWith('little-legend-');

/**
 * The lease of `id`, or of the default 河灵 when `id` cannot be drawn: missing from the manifest, its load refused, or
 * a placeholder (that lease is released first). Rejects, or returns the default's placeholder, only when the default
 * fails too; callers then keep their stand-in.
 */
export async function loadLegendLease(load: (id: string) => Promise<ModelLease>, id: string, fallback = LEGEND_MODEL): Promise<ModelLease> {
  if (id !== fallback) {
    const lease = await load(id).catch(() => null);
    if (lease && !lease.placeholder) return lease;
    lease?.release();
  }
  return load(fallback);
}
