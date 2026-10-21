/**
 * The lobby's 外观 panel (planning/3d/tft-parity-carousel-scout-ui-2026-10-21.md A3): a grid of the little legends the
 * asset root has, each with a still rendered from its own model, and a turning preview of the one picked (it celebrates
 * on each pick, then idles). As in TFT it is chosen before a match, never in one. The pick is kept by the lobby
 * (legend-choice.ts, localStorage) and sent with `join`; nothing here reaches a rule. The panel's styles are injected
 * from this chunk so the 2D bundle carries only the lobby button.
 */
import {
  AmbientLight, AnimationMixer, Box3, DirectionalLight, Group, LoopOnce, LoopRepeat, PerspectiveCamera, Scene, Vector3, WebGLRenderer,
  type AnimationAction, type Object3D,
} from 'three';
import type { ModelCache, ModelLease } from '../../rendering3d';
import type { BoardFeed, LegendPicker } from '../board-feed';

/** 14.24 zh_cn names (docs/ASSETS3D_LITTLE_LEGENDS.md); an id without one shows the id. */
const LEGEND_LABEL: Readonly<Record<string, string>> = {
  default: '河灵', pengu: '羽翼骑士企鹅', silverwing: '银翼', choncc: '丘可', hauntling: '幽魂', molediver: '钻地鼹鼠', aoshin: '敖申',
};
const modelOf = (id: string) => `little-legend-${id}`;
/** Preview turn (radians a second) and the still's size (CSS px, drawn at 2x). */
const TURN_SPEED = 0.5, THUMB_PX = 72;
/** Models face +z; the stills look at them a little from the right and above, like the lobby's stage. */
const THUMB_YAW = -0.45;

const STYLE = `
.legend-picker { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px; background: #050b10b8; }
.legend-picker-panel { width: min(720px, 100%); max-height: calc(100dvh - 32px); overflow: auto; display: grid; gap: 14px; padding: 20px;
  border-radius: 12px; background: var(--c-surface, #14212c); color: var(--c-text, #e2eef1); box-shadow: 0 18px 48px #0009; }
.legend-picker-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.legend-picker-head h2 { margin: 0; font-size: 18px; }
.legend-picker-body { display: grid; grid-template-columns: minmax(200px, 260px) 1fr; gap: 16px; align-items: start; }
.legend-picker-stage { display: grid; gap: 6px; justify-items: center; padding: 10px; border-radius: 10px;
  background: radial-gradient(ellipse at 50% 70%, #24485a, #0d1821 72%); }
.legend-picker-stage canvas { width: 100%; aspect-ratio: 1; display: block; }
.legend-picker-name { font-size: 16px; font-weight: 700; }
.legend-picker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
.legend-picker-card { display: grid; justify-items: center; gap: 4px; padding: 8px 4px; border-radius: 8px; cursor: pointer;
  background: var(--c-surface-alt, #182a37); border: 2px solid transparent; color: inherit; font-size: 13px; }
.legend-picker-card:hover { border-color: var(--c-border-strong, #3b5566); }
.legend-picker-card[aria-pressed="true"] { border-color: var(--c-accent, #68ddd0); background: #1d3a44; }
.legend-picker-card:focus-visible { outline: 3px solid var(--c-focus, #ffd782); outline-offset: 2px; }
.legend-picker-thumb { width: ${THUMB_PX}px; height: ${THUMB_PX}px; border-radius: 50%; background: radial-gradient(circle at 50% 60%, #2c5566, #102029); object-fit: cover; }
.legend-picker-note { margin: 0; font-size: 12px; color: var(--c-text-muted, #9aaeb9); }
@media (max-width: 560px) { .legend-picker-body { grid-template-columns: 1fr; } .legend-picker-stage { max-width: 240px; justify-self: center; } }
`;
let styled = false;
function injectStyle() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const style = document.createElement('style'); style.dataset.owner = 'legend-picker'; style.textContent = STYLE;
  document.head.append(style);
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}

/** Scales a model to `height`, feet on y=0, centered on x/z; returns its box after fitting. */
function fitModel(body: Object3D, height: number): Box3 {
  const box = new Box3().setFromObject(body), size = box.getSize(new Vector3()), center = box.getCenter(new Vector3());
  const scale = size.y > 0 ? height / size.y : 1;
  body.scale.multiplyScalar(scale);
  body.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  return new Box3().setFromObject(body);
}
/** Frames a fitted box with the camera on its +z side. */
function frame(camera: PerspectiveCamera, box: Box3, yaw = 0) {
  const size = box.getSize(new Vector3()), center = box.getCenter(new Vector3());
  const radius = Math.max(size.y * 0.72, Math.max(size.x, size.z) * 0.68);
  const distance = radius / Math.tan(camera.fov * Math.PI / 360);
  camera.position.set(Math.sin(yaw) * distance, center.y + size.y * 0.18, Math.cos(yaw) * distance);
  camera.lookAt(center.x, center.y, center.z);
}

/**
 * Registers the panel with the lobby (board-feed) while this 3D layer lives: it lists the legends `cache`'s manifest
 * names (always the default) and draws them from the same cache. Returns the withdrawal, which also closes an open panel.
 */
export function offerLegendPicker(feed: BoardFeed | null, cache: ModelCache): () => void {
  if (!feed?.provideLegendPicker || typeof document === 'undefined') return () => {};
  let close: (() => void) | null = null;
  const picker: LegendPicker = (host, options) => {
    close?.();
    close = openPicker(host, cache, options.choices.filter(id => id === 'default' || Object.hasOwn(cache.manifest.models, modelOf(id))),
      options.current, options.pick, () => { close = null; options.closed(); });
    return () => close?.();
  };
  feed.provideLegendPicker(picker);
  return () => { feed.provideLegendPicker?.(null); close?.(); };
}

function openPicker(host: HTMLElement, cache: ModelCache, choices: readonly string[], current: string, pick: (id: string) => void, closed: () => void): () => void {
  injectStyle();
  let selected = choices.includes(current) ? current : 'default', disposed = false;

  const root = element('div', '', 'legend-picker'); root.dataset.debug = 'legend-picker';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', '外观 · 小小英雄');
  const panel = element('div', '', 'legend-picker-panel');
  const head = element('div', '', 'legend-picker-head');
  const done = element('button', '完成'); done.type = 'button'; done.dataset.debug = 'legend-picker-done';
  head.append(element('h2', '外观 · 小小英雄'), done);
  const body = element('div', '', 'legend-picker-body');
  const stage = element('div', '', 'legend-picker-stage');
  const name = element('div', '', 'legend-picker-name'); name.dataset.debug = 'legend-picker-name';
  const grid = element('div', '', 'legend-picker-grid'); grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', '小小英雄');
  body.append(stage, grid);
  panel.append(head, body, element('p', '对局中其他玩家会看到你选的小小英雄；进入对局后不能更换。', 'legend-picker-note'));
  root.append(panel); host.append(root);

  // One renderer: the preview canvas, and the stills drawn into it once before the preview starts.
  let renderer: WebGLRenderer | null = null;
  try { renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); }
  catch { renderer = null; }
  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 1.1));
  const sun = new DirectionalLight(0xffffff, 1.8); sun.position.set(-2, 4, 3); scene.add(sun);
  const fill = new DirectionalLight(0xbfe6ff, 0.7); fill.position.set(2, 1, 4); scene.add(fill);
  const camera = new PerspectiveCamera(30, 1, 0.1, 1000);
  const turntable = new Group(); scene.add(turntable);
  if (renderer) { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); stage.prepend(renderer.domElement); }
  stage.append(name);

  const cards = new Map<string, { button: HTMLButtonElement; thumb: HTMLImageElement }>();
  for (const id of choices) {
    const button = element('button', '', 'legend-picker-card'); button.type = 'button'; button.dataset.debug = `legend-picker:${id}`; button.dataset.legend = id;
    const thumb = element('img', '', 'legend-picker-thumb'); thumb.alt = ''; thumb.width = THUMB_PX; thumb.height = THUMB_PX;
    button.append(thumb, element('span', LEGEND_LABEL[id] ?? id));
    button.addEventListener('click', () => choose(id));
    cards.set(id, { button, thumb }); grid.append(button);
  }

  // --- preview -----------------------------------------------------------------------------------------------------
  let lease: ModelLease | null = null, mixer: AnimationMixer | null = null, idle: AnimationAction | null = null, token = 0;
  let raf = 0, last = performance.now(), previewing = false;
  const clipOf = (model: ModelLease, action: string) => {
    const names = model.animationNames as Readonly<Record<string, string | undefined>>;
    return model.animations.find(clip => clip.name === (names[action] ?? action)) ?? null;
  };
  const dropPreview = () => { mixer?.stopAllAction(); if (lease) mixer?.uncacheRoot(lease.scene); mixer = null; idle = null; lease?.release(); lease = null; turntable.clear(); };
  const show = (id: string, celebrate: boolean) => {
    const mine = ++token;
    if (!renderer) return;
    void cache.load(modelOf(id)).then(next => {
      if (disposed || mine !== token || next.placeholder) { next.release(); return; }
      dropPreview();
      lease = next;
      const box = fitModel(next.scene, 1);
      turntable.add(next.scene); turntable.rotation.y = 0;
      frame(camera, box);
      mixer = new AnimationMixer(next.scene);
      const idleClip = clipOf(next, 'idle'), cheer = celebrate ? clipOf(next, 'celebrate') : null;
      if (idleClip) idle = mixer.clipAction(idleClip).setLoop(LoopRepeat, Infinity);
      if (cheer) {
        const action = mixer.clipAction(cheer).setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play();
        mixer.addEventListener('finished', () => { if (idle) { idle.reset().play(); idle.crossFadeFrom(action, 0.25, false); } });
      } else idle?.play();
    }).catch(() => { /* the card stays selectable; the stage just keeps what it had */ });
  };
  const choose = (id: string) => {
    if (disposed) return;
    selected = id;
    for (const [key, card] of cards) card.button.setAttribute('aria-pressed', String(key === id));
    name.textContent = LEGEND_LABEL[id] ?? id;
    pick(id);
    // While the stills are still drawn the stage is theirs; the preview opens on the latest pick afterwards.
    if (previewing) show(id, true);
  };

  // --- stills (one at a time, then the preview of the current pick) ------------------------------------------------
  const stills = async () => {
    if (!renderer) return;
    renderer.setSize(THUMB_PX * 2, THUMB_PX * 2, false);
    for (const id of choices) {
      if (disposed) return;
      const still = await cache.load(modelOf(id)).catch(() => null);
      if (!still) continue;
      if (disposed || still.placeholder) { still.release(); if (disposed) return; continue; }
      const box = fitModel(still.scene, 1);
      turntable.add(still.scene); frame(camera, box, THUMB_YAW);
      // Stills stand in their idle's first pose, not the bind pose.
      const clip = clipOf(still, 'idle'), pose = clip ? new AnimationMixer(still.scene) : null;
      if (pose && clip) { pose.clipAction(clip).play(); pose.update(0); }
      renderer.render(scene, camera);
      const card = cards.get(id);
      if (card) card.thumb.src = renderer.domElement.toDataURL('image/png');
      pose?.stopAllAction(); if (pose) pose.uncacheRoot(still.scene);
      still.release(); turntable.clear();
    }
  };
  const resizePreview = () => {
    if (!renderer) return;
    const width = Math.max(1, renderer.domElement.clientWidth || 240);
    renderer.setSize(width, width, false);
    camera.aspect = 1; camera.updateProjectionMatrix();
  };

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const seconds = Math.min(0.1, (now - last) / 1000); last = now;
    if (!renderer || !previewing) return;
    mixer?.update(seconds);
    turntable.rotation.y += TURN_SPEED * seconds;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);
  void stills().finally(() => {
    if (disposed) return;
    previewing = true; resizePreview(); show(selected, false);
  });

  for (const [key, card] of cards) card.button.setAttribute('aria-pressed', String(key === selected));
  name.textContent = LEGEND_LABEL[selected] ?? selected;

  const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') dispose(); };
  const onBackdrop = (event: MouseEvent) => { if (event.target === root) dispose(); };
  document.addEventListener('keydown', onKey);
  root.addEventListener('click', onBackdrop);
  done.addEventListener('click', () => dispose());
  window.addEventListener('resize', resizePreview);
  cards.get(selected)?.button.focus();

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey); window.removeEventListener('resize', resizePreview);
    dropPreview();
    renderer?.dispose(); renderer?.forceContextLoss(); root.remove();
    closed();
  }
  return dispose;
}
