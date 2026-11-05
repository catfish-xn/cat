/** One way to load a little legend for the tabletop, the carousel and the 外观 panel (3D chunk only). */
import type { ModelLease } from '../../rendering3d';

/** Preferred cosmetic when no seat/browser legend applies (羽翼骑士企鹅); manifest may lack it. */
export const LEGEND_MODEL = 'little-legend-pengu';
/** 河灵 when pengu is absent or the player explicitly picked `default` in the 外观 panel. */
export const LEGEND_FALLBACK_MODEL = 'little-legend-default';
/** Little legends' model ids all share this prefix (the 外观 panel draws them too). */
export const isLegendModel = (id: string): boolean => id.startsWith('little-legend-');

/** The model id to draw when the manifest names neither a seat pick nor a browser pick. */
export function resolveDefaultLegend(hasModel: (id: string) => boolean = () => true): string {
  return hasModel(LEGEND_MODEL) ? LEGEND_MODEL : LEGEND_FALLBACK_MODEL;
}

const legendLoadChain = (requested: string): string[] => {
  const chain = [requested];
  if (requested !== LEGEND_MODEL) chain.push(LEGEND_MODEL);
  if (requested !== LEGEND_FALLBACK_MODEL) chain.push(LEGEND_FALLBACK_MODEL);
  return [...new Set(chain)];
};

/**
 * The lease of `id`, or of the default pengu / 河灵 when `id` cannot be drawn: missing from the manifest, its load
 * refused, or a placeholder (that lease is released first). Rejects, or returns the last candidate's placeholder, only
 * when every step fails; callers then keep their stand-in.
 */
export async function loadLegendLease(load: (id: string) => Promise<ModelLease>, id: string): Promise<ModelLease> {
  for (const candidate of legendLoadChain(id)) {
    const lease = await load(candidate).catch(() => null);
    if (lease && !lease.placeholder) return lease;
    lease?.release();
  }
  return load(LEGEND_FALLBACK_MODEL);
}
