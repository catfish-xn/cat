import { describe, expect, it } from 'vitest';
import { CombatFx, MAX_LIVE_BOARD_FX } from '../src/presentation/combat-fx';
import type { DisplayCombat } from '../src/presentation/combat-display';
import type { SceneCombatEvent } from '../src/presentation/combat-display';

class Shape {
  scene: object | null = {};
  alpha = 1;
  visible = true;
  active = true;
  depth = 0;
  type: string;
  x = 0;
  y = 0;
  radius = 0;
  fill = 0;
  width = 48;
  height = 16;
  content = '';
  constructor(type: string) { this.type = type; }
  clear() { return this; }
  setActive(value: boolean) { this.active = value; return this; }
  setVisible(value: boolean) { this.visible = value; return this; }
  setAlpha(value: number) { this.alpha = value; return this; }
  setDepth(value: number) { this.depth = value; return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setRadius(value: number) { this.radius = value; return this; }
  setFillStyle(color: number) { this.fill = color; return this; }
  setText(value: string) { this.content = value; return this; }
  setStyle() { return this; }
  setOrigin() { return this; }
  setStrokeStyle() { return this; }
  lineStyle() { return this; }
  beginPath() { return this; }
  arc() { return this; }
  strokePath() { return this; }
  strokeCircle() { return this; }
  lineBetween() { return this; }
  destroy() { this.scene = null; }
}
class Host {
  graphics = 0;
  circles = 0;
  texts = 0;
  attacks = 0;
  tweens: { onComplete?: () => void }[] = [];
  scene = {
    add: {
      graphics: () => { this.graphics++; return new Shape('Graphics'); },
      circle: (x: number, y: number, radius: number, color: number) => { this.circles++; return new Shape('Arc').setPosition(x, y).setRadius(radius).setFillStyle(color); },
      text: () => { this.texts++; return new Shape('Text'); },
    },
    tweens: { add: (tween: { onComplete?: () => void }) => { this.tweens.push(tween); } },
    scale: { width: 800, height: 600 },
  };
  center() { return { x: 10, y: 20 }; }
  view() { return { attack: () => { this.attacks++; }, hit() {}, setRing() {}, ghost: () => null }; }
  fade() {}
}
const combat = { units: [
  { id: 'a', definitionId: 'vex', team: 'player', starLevel: 1, hp: 1, maxHp: 1, mana: 0, maxMana: 1, shield: 0, alive: true, targetId: null, cell: { row: 0, col: 0 }, attackRange: 1, enforcerWanted: false, itemStacks: [] },
  { id: 'b', definitionId: 'vex', team: 'enemy', starLevel: 1, hp: 1, maxHp: 1, mana: 0, maxMana: 1, shield: 0, alive: true, targetId: null, cell: { row: 1, col: 0 }, attackRange: 1, enforcerWanted: false, itemStacks: [] },
] } as unknown as DisplayCombat;
const slash = { type: 'attack', attackerId: 'a', targetId: 'b' } as SceneCombatEvent;

describe('late-game board effect pool', () => {
  it('reuses one slash graphic across fades and still lunges every attack', () => {
    const host = new Host(), fx = new CombatFx(host as never);
    for (let i = 0; i < 30; i++) {
      fx.show([slash], combat);
      host.tweens.at(-1)?.onComplete?.();
    }
    expect(host.graphics).toBe(1); expect(host.attacks).toBe(30); expect(MAX_LIVE_BOARD_FX).toBe(48);
  });
  it('drops decorative shapes past the live cap without dropping the attack lunge', () => {
    const host = new Host(), fx = new CombatFx(host as never);
    fx.show(Array.from({ length: 80 }, () => slash), combat);
    expect(host.graphics).toBe(MAX_LIVE_BOARD_FX); expect(host.attacks).toBe(80);
    fx.releaseAll();
    fx.show([slash], combat);
    expect(host.graphics).toBe(MAX_LIVE_BOARD_FX + 1);
  });
  it('reuses one revive label after its fade', () => {
    const host = new Host(), fx = new CombatFx(host as never);
    const revive = { type: 'unitRevived', unitId: 'a', hp: 12 } as SceneCombatEvent;
    fx.show([revive], combat);
    expect(host.texts).toBe(1);
    expect(host.tweens.at(-1)?.onComplete).toBeTypeOf('function');
    host.tweens.at(-1)?.onComplete?.();
    fx.show([revive], combat);
    host.tweens.at(-1)?.onComplete?.();
    expect(host.texts).toBe(1);
    expect(host.scene.add).toBeTruthy();
  });
});
