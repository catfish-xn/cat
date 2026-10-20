/**
 * 3D 外壳（three-loader.ts）与 3D chunk 之间的接口约定。实现是 placeholder-renderer.ts 的 `mountRenderer3d`：
 * 它组合 src/rendering3d/（Codex）的公共导出，并从 ../board-feed.ts 读取 2D 棋盘的只读画面数据。
 * 本文件只有类型，2D 主包不因此多出任何代码。
 */
export interface Renderer3dOptions {
  /** 素材根地址（以 / 结尾），null 表示未配置：只能画合成占位，不得请求任何素材。 */
  readonly assetBase: string | null;
}

export interface Renderer3d {
  /** 'assets'：素材清单可读；'placeholder'：未配置或读不到素材，画的是合成占位。 */
  readonly status: 'assets' | 'placeholder';
  /** 给外壳显示的一行说明，例如占位原因。 */
  readonly detail: string;
  /** 宿主尺寸变化（CSS 像素）。 */
  resize(width: number, height: number): void;
  /** 释放 WebGL 上下文、事件和缓存；之后实例不再使用。 */
  dispose(): void;
}

/** 在 host 内挂一个 canvas。WebGL 不可用或初始化失败时 reject，外壳据此留在 2D。 */
export type MountRenderer3d = (host: HTMLElement, options: Renderer3dOptions) => Promise<Renderer3d>;
