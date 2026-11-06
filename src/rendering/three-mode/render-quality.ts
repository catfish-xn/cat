/**
 * 3D 画质档位：渲染分辨率按档位缩放（高 1、中 0.75、低 0.5 倍屏幕像素），默认"自动"。
 * 自动档从高开始，帧率连续 5 秒低于 30 就降一档（只降不升，刷新页面重来），所以配置差的电脑会自己变流畅。
 * 玩家选的档位存在 localStorage；读写失败（隐私模式等）时照常用自动档。只影响画面清晰度，不碰任何规则。
 * 2026-11-06 调查：软件渲染下分辨率降到 0.5 倍，备战约 +50% 帧率、战斗约 +25%，渲染填充是主要成本。
 */
export type QualityLevel = 'high' | 'medium' | 'low';
export type QualityChoice = 'auto' | QualityLevel;

export const QUALITY_SCALE: Readonly<Record<QualityLevel, number>> = { high: 1, medium: 0.75, low: 0.5 };
const LEVELS: readonly QualityLevel[] = ['high', 'medium', 'low'];
const CHOICES: readonly QualityChoice[] = ['auto', 'high', 'medium', 'low'];
const NAME: Readonly<Record<QualityChoice, string>> = { auto: '自动', high: '高', medium: '中', low: '低' };
export const QUALITY_STORAGE_KEY = 'cat.render3d.quality';
/** Auto steps down after this many one-second readings in a row below LOW_FPS. */
export const LOW_FPS = 30;
export const LOW_READINGS = 5;
/** No judgement while the match is still loading, nor right after a change (the next frames redo their buffers). */
export const WARMUP_MS = 8000;
export const SETTLE_MS = 3000;
/** A reading spanning more than this was a paused page (hidden tab, a modal), not a slow one. */
const MAX_READING_MS = 1500;
/** Device pixel ratio is capped at 2 (as before); the result never goes below half a CSS pixel. */
const MAX_DPR = 2, MIN_RATIO = 0.5;

export function pixelRatioFor(level: QualityLevel, devicePixelRatio: number): number {
  const base = Math.min(Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1, MAX_DPR);
  return Math.max(MIN_RATIO, base * QUALITY_SCALE[level]);
}

export function readQualityChoice(storage: Pick<Storage, 'getItem'> | null): QualityChoice {
  try {
    const value = storage?.getItem(QUALITY_STORAGE_KEY);
    return (CHOICES as readonly (string | null | undefined)[]).includes(value) ? value as QualityChoice : 'auto';
  } catch { return 'auto'; }
}

function writeQualityChoice(storage: Pick<Storage, 'setItem'> | null, choice: QualityChoice): void {
  try { storage?.setItem(QUALITY_STORAGE_KEY, choice); } catch { /* not kept: this visit only */ }
}

export interface RenderQuality {
  readonly choice: QualityChoice;
  /** The level drawn now: the player's, or what auto has come down to. */
  readonly level: QualityLevel;
  /** One FPS reading (frames over `spanMs`, taken at `now`). Returns true when auto changed the level. */
  reading(fps: number, spanMs: number, now: number): boolean;
  /** Next choice in the cycle 自动 → 高 → 中 → 低 → 自动; kept for later visits. */
  cycle(now: number): void;
  label(): string;
  title(): string;
}

export function createRenderQuality(options: {
  readonly storage: (Pick<Storage, 'getItem' | 'setItem'>) | null;
  readonly start: number;
  readonly hidden?: () => boolean;
}): RenderQuality {
  let choice = readQualityChoice(options.storage);
  let autoLevel: QualityLevel = 'high', lowRun = 0, settleUntil = options.start + WARMUP_MS;
  const level = (): QualityLevel => choice === 'auto' ? autoLevel : choice;
  return {
    get choice() { return choice; },
    get level() { return level(); },
    reading(fps, spanMs, now) {
      if (choice !== 'auto' || options.hidden?.() || spanMs > MAX_READING_MS || now < settleUntil) { lowRun = 0; return false; }
      lowRun = fps < LOW_FPS ? lowRun + 1 : 0;
      if (lowRun < LOW_READINGS) return false;
      lowRun = 0;
      const next = LEVELS[LEVELS.indexOf(autoLevel) + 1];
      if (!next) return false;
      autoLevel = next; settleUntil = now + SETTLE_MS;
      return true;
    },
    cycle(now) {
      choice = CHOICES[(CHOICES.indexOf(choice) + 1) % CHOICES.length]!;
      if (choice === 'auto') autoLevel = 'high';
      lowRun = 0; settleUntil = now + SETTLE_MS;
      writeQualityChoice(options.storage, choice);
    },
    label() { return `画质 ${NAME[choice]}`; },
    title() {
      return choice === 'auto'
        ? `画质自动：现在是${NAME[autoLevel]}（帧率持续低于 ${LOW_FPS} 会自动降一档）。点击切换`
        : `画质${NAME[choice]}：渲染分辨率 ${Math.round(QUALITY_SCALE[choice] * 100)}%。点击切换`;
    },
  };
}
