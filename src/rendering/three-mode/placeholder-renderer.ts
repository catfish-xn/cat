/**
 * The 3D chunk's MountRenderer3d. The file keeps its original name because three-loader.ts imports it and
 * tests/rendering3d-mode.test.ts mocks that path; it is no longer only a placeholder.
 *
 * It draws the BoardScene feed (board-feed.ts) with the src/rendering3d core: hex board and bench, one piece per
 * 2D token at the same logical position (x→x, y→z), ModelCache leases with UnitActionState/UnitAnimationMixer
 * driven by display combat events. Without an asset root, or when the manifest cannot be read, pieces are
 * team-coloured pawns; a unit missing from a readable manifest shows the core's magenta placeholder box.
 * Pointer input on the 3D board is replayed through BoardControls (pick() for units, the board plane for drop points):
 * BoardScene runs its own drag rules and session commands, so this layer never issues a command or reads rules itself.
 */
import {
  AmbientLight, Box3, BoxGeometry, Color, CylinderGeometry, DirectionalLight, Group, Mesh, MeshStandardMaterial,
  PerspectiveCamera, Plane, Raycaster, RingGeometry, Scene, SphereGeometry, Vector2, Vector3, WebGLRenderer, type Object3D,
} from 'three';
import { ModelCache, UnitActionState, UnitAnimationMixer, hexCenter, pick, type AnimationEvent, type HexGrid, type ModelLease } from '../../rendering3d';
import type { BoardDropHint, BoardFeed, BoardFrame, BoardPiece } from '../board-feed';
import type { DisplayCombatEvent } from '../../presentation/combat-display';
import type { MountRenderer3d, Renderer3d } from './contract';

const MANIFEST_TIMEOUT_MS = 4000;
/** Piece height in board units (2D logical pixels); a hex is 2 × hexRadius (68) tall. */
const PIECE_HEIGHT = 56, PIECE_WIDTH = 40;
/** Seconds for a piece to glide to a new token position; the 2D tween itself is 0.22 s. */
const FOLLOW_SECONDS = 0.12;
const TEAM_COLOR = { player: '#3d8fd1', enemy: '#d1504a' } as const;
const ANIMATION_EVENTS = new Set(['movement', 'death', 'unitRevived', 'attack', 'cast', 'packetDamage', 'heal']);
/** CSS pixels before a press becomes a drag; BoardScene's own threshold is 6. */
const DRAG_THRESHOLD = 6;
/** The dragged piece floats this far above the board. */
const DRAG_LIFT = 10;
const DROP_COLOR = { allowed: '#68ddd0', refused: '#f08080' } as const;

// Injected by three-loader.ts: a static import would make Rollup move board-feed.ts (also used by BoardScene)
// into this chunk and the 2D entry would then load the whole 3D chunk.
let feed: BoardFeed | null = null;
export function useBoardFeed(next: BoardFeed): void { feed = next; }

type Models = { cache: ModelCache; status: 'assets'; detail: string } | { cache: null; status: 'placeholder'; detail: string };

async function openModels(assetBase: string | null): Promise<Models> {
  if (!assetBase) return { cache: null, status: 'placeholder', detail: '未配置 3D 素材，显示占位棋子' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${assetBase}manifest.json`, { signal: controller.signal });
    if (!response.ok) return { cache: null, status: 'placeholder', detail: `素材清单读取失败（HTTP ${response.status}），显示占位棋子` };
    const cache = new ModelCache(await response.json(), assetBase);
    return { cache, status: 'assets', detail: `已读取素材清单（${Object.keys(cache.manifest.models).length} 个模型）` };
  } catch {
    return { cache: null, status: 'placeholder', detail: '素材地址无法访问或清单格式不符，显示占位棋子' };
  } finally { clearTimeout(timer); }
}

interface PieceView {
  readonly root: Group; readonly ring: Mesh; state: UnitActionState;
  body: Object3D | null; lease: ModelLease | null; mixer: UnitAnimationMixer | null; team: BoardPiece['team'];
  definitionId: string; target: Vector3; placed: boolean; disposed: boolean;
}

/** Normalises any model to PIECE_HEIGHT × PIECE_WIDTH at most, feet on y=0 (D7 keeps League units; see planning/3d). */
function fit(body: Object3D): Object3D {
  const box = new Box3().setFromObject(body), size = box.getSize(new Vector3());
  const scale = Math.min(size.y > 0 ? PIECE_HEIGHT / size.y : Infinity, Math.max(size.x, size.z) > 0 ? PIECE_WIDTH / Math.max(size.x, size.z) : Infinity);
  if (!Number.isFinite(scale)) return body;
  body.scale.multiplyScalar(scale);
  body.position.y -= box.min.y * scale;
  return body;
}

export const mountRenderer3d: MountRenderer3d = async (host, options) => {
  const renderer = new WebGLRenderer({ antialias: true });
  const models = await openModels(options.assetBase);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = 'render3d-canvas';
  host.append(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color('#101923');
  scene.add(new AmbientLight(0xffffff, 0.6));
  const sun = new DirectionalLight(0xffffff, 1.5);
  sun.position.set(-200, 600, 300);
  scene.add(sun);
  const camera = new PerspectiveCamera(36, 1, 1, 5000);

  // Shared geometry/materials owned by this renderer; model templates are owned by the ModelCache.
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(resource: T): T => { owned.push(resource); return resource; };
  const pawnBody = own(new CylinderGeometry(9, 13, 34, 16)), pawnHead = own(new SphereGeometry(10, 16, 12));
  const ringGeometry = own(new RingGeometry(18, 23, 32));
  const teamMaterial = {
    player: own(new MeshStandardMaterial({ color: TEAM_COLOR.player, roughness: 0.6 })),
    enemy: own(new MeshStandardMaterial({ color: TEAM_COLOR.enemy, roughness: 0.6 })),
  };
  const ringMaterial = {
    player: own(new MeshStandardMaterial({ color: TEAM_COLOR.player, emissive: TEAM_COLOR.player, emissiveIntensity: 0.4 })),
    enemy: own(new MeshStandardMaterial({ color: TEAM_COLOR.enemy, emissive: TEAM_COLOR.enemy, emissiveIntensity: 0.4 })),
  };

  const boardGroup = new Group(), boardBox = new Box3();
  // Look from the player's side with a TFT-like tilt; back off until board and bench fit both ways.
  const VIEW = new Vector3(0, 1.32, 0.98).normalize();
  const frameCamera = () => {
    if (boardBox.isEmpty()) return;
    const center = boardBox.getCenter(new Vector3()), size = boardBox.getSize(new Vector3());
    const tan = Math.tan(camera.fov * Math.PI / 360);
    const distance = Math.max(size.x * 0.54 / (tan * camera.aspect), size.z * 0.66 * VIEW.y / tan + size.z * 0.5 * VIEW.z);
    camera.position.copy(center).addScaledVector(VIEW, distance);
    camera.lookAt(center);
  };
  scene.add(boardGroup);
  let boardKey = '';
  const buildBoard = (frame: BoardFrame) => {
    const key = `${frame.rows}x${frame.columns}@${frame.hexRadius},${frame.origin.x},${frame.origin.y}|${frame.bench.length}`;
    if (key === boardKey) return;
    boardKey = key;
    boardGroup.clear();
    const tile = own(new CylinderGeometry(frame.hexRadius * 0.95, frame.hexRadius * 0.95, 6, 6)); // six segments start at +z: pointy-top
    const own0 = own(new MeshStandardMaterial({ color: '#2d5c7a', roughness: 0.85 }));
    const foe = own(new MeshStandardMaterial({ color: '#5a3a48', roughness: 0.85 }));
    const grid = { rows: frame.rows, columns: frame.columns, radius: frame.hexRadius, origin: frame.origin };
    for (let row = 0; row < frame.rows; row++) for (let col = 0; col < frame.columns; col++) {
      const mesh = new Mesh(tile, row < frame.rows / 2 ? foe : own0);
      mesh.position.copy(hexCenter({ col, row }, grid)).setY(-3);
      boardGroup.add(mesh);
    }
    const slot = own(new BoxGeometry(48, 4, 56)), slotMaterial = own(new MeshStandardMaterial({ color: '#25313d', roughness: 0.9 }));
    for (const point of frame.bench) {
      const mesh = new Mesh(slot, slotMaterial);
      mesh.position.set(point.x, -2, point.y);
      boardGroup.add(mesh);
    }
    boardBox.setFromObject(boardGroup);
    frameCamera();
  };

  const pieces = new Map<string, PieceView>();
  const attachBody = (view: PieceView) => {
    if (view.body) { view.root.remove(view.body); view.body = null; }
    view.mixer?.dispose(); view.mixer = null; view.lease?.release(); view.lease = null;
    if (!models.cache) {
      const pawn = new Group();
      const body = new Mesh(pawnBody, teamMaterial[view.team]); body.position.y = 17;
      const head = new Mesh(pawnHead, teamMaterial[view.team]); head.position.y = 42;
      pawn.add(body, head);
      view.body = fit(pawn); view.root.add(pawn);
      return;
    }
    const definitionId = view.definitionId;
    void models.cache.load(definitionId).then(lease => {
      if (view.disposed || view.definitionId !== definitionId) { lease.release(); return; }
      view.lease = lease;
      view.body = fit(lease.scene); view.root.add(lease.scene);
      view.mixer = new UnitAnimationMixer(lease.scene, lease.animations, lease.animationNames);
      view.mixer.apply(view.state.output);
    }).catch(() => { /* a disposed cache rejects late loads; the piece stays without a body */ });
  };
  const createPiece = (piece: BoardPiece): PieceView => {
    const root = new Group();
    const ring = new Mesh(ringGeometry, ringMaterial[piece.team]);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.5;
    root.add(ring);
    scene.add(root);
    const view: PieceView = { root, ring, state: new UnitActionState(piece.id), body: null, lease: null, mixer: null, team: piece.team,
      definitionId: piece.definitionId, target: new Vector3(piece.x, 0, piece.y), placed: false, disposed: false };
    attachBody(view);
    return view;
  };
  // UnitActionState stays on death until unitRevived and ignores later events, so a unit that died must start the
  // next combat or preparation fresh. A new mixer too: the old one caches the last applied revision.
  const resetAction = (view: PieceView, id: string) => {
    view.state = new UnitActionState(id);
    view.mixer?.dispose(); view.mixer = null;
    if (view.lease) { view.mixer = new UnitAnimationMixer(view.lease.scene, view.lease.animations, view.lease.animationNames); view.mixer.apply(view.state.output); }
  };
  const removePiece = (view: PieceView) => {
    view.disposed = true;
    view.mixer?.dispose(); view.lease?.release();
    view.root.removeFromParent();
  };

  let fighting: boolean | null = null;
  const onFrame = (frame: BoardFrame) => {
    buildBoard(frame);
    grid = { rows: frame.rows, columns: frame.columns, radius: frame.hexRadius, origin: frame.origin };
    // BoardScene cancelled the drag itself (blur, resize, D/F, phase change, a command): let go of the pointer too.
    if (dragging && frame.dragging !== dragging) endDrag();
    if (fighting !== null && fighting !== frame.fighting) for (const [id, view] of pieces) resetAction(view, id);
    fighting = frame.fighting;
    const seen = new Set<string>();
    for (const piece of frame.pieces) {
      if (!piece.definitionId || (piece.team !== 'player' && piece.team !== 'enemy')) continue;
      seen.add(piece.id);
      let view = pieces.get(piece.id);
      if (!view) { view = createPiece(piece); pieces.set(piece.id, view); }
      if (view.definitionId !== piece.definitionId || view.team !== piece.team) {
        view.definitionId = piece.definitionId; view.team = piece.team; view.ring.material = ringMaterial[piece.team]; attachBody(view);
      }
      if (piece.visible && !view.root.visible) resetAction(view, piece.id);
      view.root.visible = piece.visible;
      view.target.set(piece.x, 0, piece.y);
      if (!view.placed) { view.root.position.copy(view.target); view.placed = true; }
    }
    for (const [id, view] of pieces) if (!seen.has(id)) { removePiece(view); pieces.delete(id); }
  };
  const onEvents = (events: readonly DisplayCombatEvent[]) => {
    for (const event of events) {
      if (!ANIMATION_EVENTS.has(event.type)) continue;
      // Display events carry the replay field names UnitActionState reads; each state ignores other units' events.
      for (const view of pieces.values()) { const output = view.state.consume(event as unknown as AnimationEvent); view.mixer?.apply(output); }
    }
  };
  const unsubscribe = feed?.subscribe({ frame: onFrame, events: onEvents }) ?? (() => {});

  // Pointer → BoardControls. A press on my unit selects it; moving past the threshold drags it through BoardScene,
  // which moves the 2D token (this piece follows it via the frame) and answers where a release would land.
  const canvas = renderer.domElement;
  const marker = new Mesh(own(new RingGeometry(26, 33, 6, 1, Math.PI / 2)), own(new MeshStandardMaterial({ color: DROP_COLOR.allowed,
    emissive: DROP_COLOR.allowed, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 })));
  marker.rotation.x = -Math.PI / 2; marker.position.y = 1; marker.visible = false;
  scene.add(marker);
  const groundPlane = new Plane(new Vector3(0, 1, 0), 0), ray = new Raycaster();
  let grid: HexGrid | null = null;
  let press: { id: string; pointerId: number; x: number; y: number } | null = null, dragging: string | null = null;
  const viewport = () => { const rect = canvas.getBoundingClientRect(); return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }; };
  const unitAt = (event: PointerEvent): string | null => {
    const area = viewport();
    if (!grid || area.width <= 0 || area.height <= 0) return null;
    const units = [...pieces].filter(([, view]) => view.team === 'player').map(([unitId, view]) => ({ unitId, object: view.root }));
    const hit = pick({ x: event.clientX, y: event.clientY }, area, camera, grid, units);
    return hit?.kind === 'unit' ? hit.unitId : null;
  };
  const boardPoint = (event: PointerEvent): { x: number; y: number } | null => {
    const area = viewport();
    if (area.width <= 0 || area.height <= 0) return null;
    ray.setFromCamera(new Vector2((event.clientX - area.left) / area.width * 2 - 1, 1 - (event.clientY - area.top) / area.height * 2), camera);
    const point = ray.ray.intersectPlane(groundPlane, new Vector3());
    return point ? { x: point.x, y: point.z } : null;
  };
  const showHint = (hint: BoardDropHint) => {
    marker.visible = !!hint.target;
    if (!hint.target) return;
    marker.position.set(hint.target.x, 1, hint.target.y);
    const color = hint.allowed ? DROP_COLOR.allowed : DROP_COLOR.refused;
    const material = marker.material as MeshStandardMaterial;
    material.color.set(color); material.emissive.set(color);
  };
  const endDrag = () => {
    if (press && canvas.hasPointerCapture(press.pointerId)) canvas.releasePointerCapture(press.pointerId);
    dragging = null; press = null; marker.visible = false; canvas.style.cursor = '';
  };
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || press) return;
    const id = unitAt(event);
    if (!id) return;
    press = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const onPointerMove = (event: PointerEvent) => {
    const controls = feed?.controls();
    if (!press || event.pointerId !== press.pointerId) {
      if (press) return;
      const id = unitAt(event);
      controls?.hover(id);
      canvas.style.cursor = id ? 'grab' : '';
      return;
    }
    if (!dragging && Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_THRESHOLD) return;
    if (!dragging) {
      if (!controls?.dragStart(press.id)) { endDrag(); return; }
      dragging = press.id; canvas.style.cursor = 'grabbing';
    }
    const point = boardPoint(event);
    if (point && controls) showHint(controls.dragMove(point));
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.pointerId) return;
    const controls = feed?.controls();
    if (dragging) controls?.dragEnd(boardPoint(event), { x: event.clientX, y: event.clientY });
    else controls?.select(press.id);
    endDrag();
  };
  const onPointerCancel = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.pointerId) return;
    if (dragging) feed?.controls()?.dragCancel();
    endDrag();
  };
  const onPointerLeave = () => { if (!press) { feed?.controls()?.hover(null); canvas.style.cursor = ''; } };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('lostpointercapture', onPointerCancel);
  canvas.addEventListener('pointerleave', onPointerLeave);

  let width = 0, frameId = 0, last = performance.now();
  const resize = (w: number, h: number) => {
    if (w <= 0 || h <= 0) return;
    width = w;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    frameCamera();
  };
  const tick = (now: number) => {
    frameId = requestAnimationFrame(tick);
    const seconds = Math.min(Math.max((now - last) / 1000, 0), 0.25);
    last = now;
    const follow = 1 - Math.exp(-seconds / FOLLOW_SECONDS);
    for (const [id, view] of pieces) {
      if (id === dragging) view.root.position.copy(view.target).setY(DRAG_LIFT); // follows the pointer exactly
      else {
        view.root.position.y = 0;
        const step = view.target.clone().sub(view.root.position);
        if (step.lengthSq() > 0.25) view.root.rotation.y = Math.atan2(step.x, step.z);
        else view.root.rotation.y = view.team === 'player' ? Math.PI : 0; // models face +z; the player's side looks up the board
        view.root.position.addScaledVector(step, follow);
      }
      const output = view.state.update(seconds);
      if (view.mixer) { view.mixer.apply(output); view.mixer.update(seconds); }
    }
    if (width > 0) renderer.render(scene, camera);
  };
  resize(host.clientWidth, host.clientHeight);
  frameId = requestAnimationFrame(tick);

  const renderer3d: Renderer3d = {
    status: models.status, detail: models.detail, resize,
    dispose() {
      cancelAnimationFrame(frameId); unsubscribe();
      if (dragging) feed?.controls()?.dragCancel();
      feed?.controls()?.hover(null); endDrag();
      for (const [type, handler] of [['pointerdown', onPointerDown], ['pointermove', onPointerMove], ['pointerup', onPointerUp],
        ['pointercancel', onPointerCancel], ['lostpointercapture', onPointerCancel], ['pointerleave', onPointerLeave]] as const)
        canvas.removeEventListener(type, handler as EventListener);
      for (const view of pieces.values()) removePiece(view);
      pieces.clear(); boardGroup.clear();
      models.cache?.dispose();
      for (const resource of owned) resource.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
  return renderer3d;
};
