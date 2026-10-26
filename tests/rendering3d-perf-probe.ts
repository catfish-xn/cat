/** Browser measurement fixture; synthetic data only, no rules or copyrighted assets. */
import * as THREE from 'three';
import * as core from '../src/rendering3d';
import { mountRenderer3d, useBoardFeed } from '../src/rendering/three-mode/placeholder-renderer';
import type { BoardFeedListener, BoardFrame } from '../src/rendering/board-feed';
let listener: BoardFeedListener;
let gpu: THREE.WebGLRenderer;
const renderTimes: number[] = [];
const geometry = new THREE.BoxGeometry(24, 60, 22, 4, 8, 4), material = new THREE.MeshStandardMaterial({ color: 0x74accc });
core.ModelCache.prototype.load = async function () {
  const scene = new THREE.Group(); scene.add(new THREE.Mesh(geometry, material));
  // Animated synthetic model, with the same mixer path as a loaded unit.
  const track = new THREE.NumberKeyframeTrack('.rotation[y]', [0, 0.5, 1], [0, 0.1, 0]);
  const animations = ['idle', 'attack', 'cast'].map(name => new THREE.AnimationClip(name, 1, [track]));
  return { scene, animations, animationNames: {}, placeholder: false, release() { scene.removeFromParent(); } };
};
export async function setup() {
  document.body.replaceChildren(); document.body.dataset.m6Mode = 'active'; document.body.dataset.online = '';
  const host = document.createElement('div'); host.style.cssText = 'width:960px;height:640px'; document.body.append(host);
  useBoardFeed({ controls: () => null, subscribe(next) { listener = next; return () => {}; } });
  const mounted = await mountRenderer3d(host, { assetBase: '/perf-synthetic/' });
  gpu = (window as unknown as { __render3d: { renderer: THREE.WebGLRenderer } }).__render3d.renderer;
  const original = gpu.render.bind(gpu);
  gpu.render = (...args) => { const t = performance.now(); original(...args); renderTimes.push(performance.now() - t); };
  let round = 0, unitCount = 0, seq = 0;
  const pump = setInterval(() => { seq++; listener.events(Array.from({ length: unitCount }, (_, i) => ({
    type: 'cast', tick: seq, eventSeq: seq * 100 + i, sourceId: `r${round}-u${i}`, targetIds: [`r${round}-u${(i + 1) % unitCount}`],
  })) as never); }, 400);
  const frame = (units: number, rows = 8): BoardFrame => ({ rows, columns: 7, hexRadius: 34, origin: { x: 60, y: 60 },
    bench: [], fighting: true, dragging: null, pieces: Array.from({ length: units }, (_, i) => ({
      id: `r${round}-u${i}`, definitionId: i % 2 ? 'renata' : 'vex', team: i % 2 ? 'enemy' : 'player', starLevel: 2,
      alive: true, visible: true, x: 60 + i % 7 * 59, y: 60 + Math.floor(i / 7) * 70,
      meters: { hp: 1800 - seq % 300, maxHp: 2500, mana: 50, maxMana: 100, shield: 100 },
      items: Array.from({ length: 3 }, (_, n) => ({ id: `item-${n}`, icon: null })) })) });
  const feedPump = setInterval(() => listener.frame(frame(unitCount)), 50);
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const snapshot = () => ({ geometries: gpu.info.memory.geometries, textures: gpu.info.memory.textures,
    programs: gpu.info.programs?.length, calls: gpu.info.render.calls, triangles: gpu.info.render.triangles });
  const sample = async (units: number, ms = 2500) => {
    unitCount = units; listener.frame(frame(units)); await pause(400);
    const times: number[] = []; renderTimes.length = 0;
    let last = performance.now(), end = last + ms;
    while (performance.now() < end) { await new Promise(requestAnimationFrame); const now = performance.now(); times.push(now - last); last = now; }
    const stats = (values: number[]) => { values.sort((a,b) => a-b); return { n: values.length, p50: values[Math.floor(values.length * .5)], p95: values[Math.floor(values.length * .95)] }; };
    return { units, frameMs: stats(times), renderCpuMs: stats(renderTimes), ...snapshot() };
  };
  return { sample, snapshot, async churn() {
    for (let i = 0; i < 30; i++) { round++; listener.frame(frame(24, i % 2 ? 8 : 7)); await pause(40); }
    listener.frame(frame(24)); await pause(500); return snapshot();
  }, async clear() { unitCount = 0; clearInterval(feedPump); clearInterval(pump); listener.frame({ ...frame(0), fighting: false }); await pause(1500); return snapshot(); },
  dispose() { clearInterval(pump); clearInterval(feedPump); mounted.dispose(); geometry.dispose(); material.dispose(); } };
}
