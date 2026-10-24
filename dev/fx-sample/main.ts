/**
 * Dev-only review page for the skill feel sample (src/rendering/three-mode/skill-feel.ts); not part of any build.
 * `npx vite`, then /dev/fx-sample/?hero=jinx (jinx | jayce | renata | vi), add &skillfx=off for the old look.
 * &crowd=1 puts all four samples twice against eight enemies casting and attacking nonstop (frame-rate check).
 * &assets=/path/ names the 3D asset root (default /assets3d-local/v8/). Keys: A attack, S cast; it also loops on its own.
 */
import { useBoardFeed, mountRenderer3d } from '../../src/rendering/three-mode/placeholder-renderer';
import type { BoardFeedListener, BoardPiece, BoardFrame } from '../../src/rendering/board-feed';

const params = new URLSearchParams(location.search);
const hero = params.get('hero') ?? 'jinx', crowd = params.get('crowd') === '1';
let listener!: BoardFeedListener;
const r = 34, origin = { x: 35, y: 50 };
const at = (col: number, row: number) => ({ x: origin.x + Math.sqrt(3) * r * (col + (row % 2) / 2), y: origin.y + r * 1.5 * row });
const unit = (id: string, definitionId: string, team: 'player' | 'enemy', col: number, row: number, mana = 0): BoardPiece =>
  ({ id, definitionId, team, starLevel: 2, ...at(col, row), alive: true, visible: true, meters: { hp: 800, maxHp: 1000, mana, maxMana: 60, shield: 0 } });
const frame = (pieces: BoardPiece[], fighting: boolean): BoardFrame => ({ rows: 8, columns: 7, hexRadius: r, origin, bench: [], pieces, fighting, dragging: null });
useBoardFeed({ subscribe(next) { listener = next; return () => {}; }, controls: () => null, legendControls: () => null } as never);
await mountRenderer3d(document.getElementById('host')!, { assetBase: params.get('assets') ?? '/assets3d-local/v8/' });

const SAMPLES = ['jinx', 'jayce', 'renata', 'vi'];
const casters = crowd ? SAMPLES.flatMap((id, i) => [unit(`c${i}`, id, 'player', 1 + i, id === 'vi' ? 4 : 5), unit(`d${i}`, id, 'player', 1 + i, 6)])
  : [unit('c0', hero, 'player', 3, hero === 'vi' ? 3 : 5)];
const enemies = crowd ? Array.from({ length: 8 }, (_, i) => unit(`e${i}`, 'darius', 'enemy', i % 7, i < 7 ? 2 : 1))
  : [unit('e0', 'darius', 'enemy', 3, 2), unit('e1', 'darius', 'enemy', 2, 2), unit('e2', 'darius', 'enemy', 4, 1)];
const board = (mana: number) => [...casters.map(c => ({ ...c, meters: { ...c.meters!, mana } })), ...enemies];
let tick = 1;
const cast = (source = casters[0]!) => { tick += 10; listener.events([{ type: 'cast', tick, eventSeq: tick, sourceId: source.id, targetIds: [enemies[0]!.id, enemies[1]!.id] } as never]); };
const attack = (source = casters[0]!) => { tick += 10; listener.events([{ type: 'attack', tick, eventSeq: tick, attackerId: source.id, targetId: enemies[tick % enemies.length]!.id } as never]); };

listener.frame(frame(board(0), false)); // preparation: models load and the sample casts are prewarmed
document.getElementById('bar')!.textContent = `${crowd ? '全部样板 ×2' : hero}　特效：${params.get('skillfx') === 'off' ? '改前（skillfx=off）' : '改后'}　A 普攻 / S 技能，自动循环`;
setTimeout(() => {
  listener.frame(frame(board(60), true));
  addEventListener('keydown', e => { if (e.key === 'a') attack(); if (e.key === 's') cast(); });
  // Loop: three attacks, then a cast (crowd: every caster, staggered).
  let step = 0;
  setInterval(() => {
    step++;
    if (crowd) { casters.forEach((c, i) => (step + i) % 4 === 0 ? cast(c) : attack(c)); return; }
    if (step % 4 === 0) { cast(); listener.frame(frame(board(0), true)); } else { attack(); if (step % 4 === 3) listener.frame(frame(board(60), true)); }
  }, 700);
}, 8000);
