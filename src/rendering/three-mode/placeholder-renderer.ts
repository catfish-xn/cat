/**
 * 合成占位 3D 棋盘：只用 three.js 自带几何体，不读任何素材文件。src/rendering3d/ 交付前，它是
 * MountRenderer3d 的唯一实现，用来证明 3D chunk 能按需加载、能在公开站无素材时正常显示。
 * 只在请求时渲染（挂载、尺寸变化），没有常驻动画循环。
 */
import {
  AmbientLight, Color, CylinderGeometry, DirectionalLight, Mesh, MeshStandardMaterial,
  PerspectiveCamera, Scene, WebGLRenderer,
} from 'three';
import type { MountRenderer3d, Renderer3d } from './contract';

const ROWS = 8, COLUMNS = 7, HEX_RADIUS = 1, MANIFEST_TIMEOUT_MS = 4000;

async function probeManifest(assetBase: string | null): Promise<{ status: Renderer3d['status']; detail: string }> {
  if (!assetBase) return { status: 'placeholder', detail: '未配置 3D 素材，显示占位棋盘' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${assetBase}manifest.json`, { signal: controller.signal });
    return response.ok
      ? { status: 'assets', detail: '已找到素材清单（模型接入待 3D 模块交付）' }
      : { status: 'placeholder', detail: `素材清单读取失败（HTTP ${response.status}），显示占位棋盘` };
  } catch {
    return { status: 'placeholder', detail: '素材地址无法访问，显示占位棋盘' };
  } finally { clearTimeout(timer); }
}

export const mountRenderer3d: MountRenderer3d = async (host, options) => {
  const renderer = new WebGLRenderer({ antialias: true });
  const { status, detail } = await probeManifest(options.assetBase);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = 'render3d-canvas';
  host.append(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color('#101923');
  scene.add(new AmbientLight(0xffffff, 0.55));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(-6, 14, 8);
  scene.add(sun);

  const geometry = new CylinderGeometry(HEX_RADIUS * 0.94, HEX_RADIUS * 0.94, 0.18, 6);
  const own = new MeshStandardMaterial({ color: '#2d5c7a', roughness: 0.8 });
  const enemy = new MeshStandardMaterial({ color: '#6a3d4a', roughness: 0.8 });
  const width = Math.sqrt(3) * HEX_RADIUS, height = 1.5 * HEX_RADIUS;
  for (let row = 0; row < ROWS; row++) for (let column = 0; column < COLUMNS; column++) {
    const tile = new Mesh(geometry, row < ROWS / 2 ? enemy : own); // six segments start at +z: pointy-top, matching the 2D board
    tile.position.set((column - (COLUMNS - 1) / 2) * width + (row % 2 ? width / 4 : -width / 4), 0, (row - (ROWS - 1) / 2) * height);
    scene.add(tile);
  }

  const camera = new PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 17, 12);
  camera.lookAt(0, 0, 0.6);

  const resize = (w: number, h: number) => {
    if (w <= 0 || h <= 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  resize(host.clientWidth, host.clientHeight);

  return {
    status, detail, resize,
    dispose() {
      geometry.dispose(); own.dispose(); enemy.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
};
