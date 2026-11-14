/** #430 anvil UI: the armory countdown, the shop-row routing of a sold anvil's pick, and the bench piece without stars or cost. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Unit } from '../../src/simulation/units';

/** Phaser is display only here: game objects record what the piece shows; no Match state is mocked. */
const fake = vi.hoisted(() => {
  class Shown {
    text = ''; visible = true;
    setText(value: string) { this.text = value; return this; }
    setVisible(value: boolean) { this.visible = value; return this; }
  }
  const object = () => {
    const shown = new Shown();
    const proxy: unknown = new Proxy(shown, { get: (target, key) => key in target ? (target as unknown as Record<PropertyKey, unknown>)[key] : () => proxy });
    return proxy as Shown;
  };
  const scene = () => ({
    add: { circle: object, graphics: object, text: object, image: object, container: object },
    textures: { exists: () => false },
    load: { once: () => undefined, image: () => undefined, isLoading: () => true, start: () => undefined },
    tweens: { add: () => undefined, killTweensOf: () => undefined },
  });
  return { scene };
});
vi.mock('phaser', () => ({ default: { Math: { Vector2: class { constructor(readonly x: number, readonly y: number) {} } } } }));

import { armorySecondsLeft, forgetServerNow, isAnvilArmory, noteServerNow } from '../../src/presentation/anvil-display';
import { isShopChoice } from '../../src/presentation/choice-fallback';
import { UnitView } from '../../src/presentation/unit-view';
import { unitAnomalies } from '../../src/presentation/anomaly-display';

afterEach(() => { forgetServerNow(); vi.restoreAllMocks(); });

describe('armorySecondsLeft', () => {
  const choice = { choiceId: '["anvil","unit-7"]', generation: 3 };
  it('counts down the server deadline of this choiceId and generation', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1_000);
    noteServerNow(50_000);
    expect(armorySecondsLeft({ pendingChoice: choice, choiceDeadline: { ...choice, endsAt: 80_000 } })).toBe(30);
    expect(armorySecondsLeft({ pendingChoice: choice, choiceDeadline: { ...choice, endsAt: 79_001 } })).toBe(30);
    expect(armorySecondsLeft({ pendingChoice: choice, choiceDeadline: { ...choice, endsAt: 40_000 } })).toBe(0);
  });
  it('is null for another choiceId or generation, without a deadline or choice, and before the server clock', () => {
    noteServerNow(50_000);
    expect(armorySecondsLeft({ pendingChoice: choice, choiceDeadline: { ...choice, choiceId: '["anvil","unit-8"]', endsAt: 80_000 } })).toBeNull();
    expect(armorySecondsLeft({ pendingChoice: choice, choiceDeadline: { ...choice, generation: 2, endsAt: 80_000 } })).toBeNull();
    expect(armorySecondsLeft({ pendingChoice: choice })).toBeNull();
    expect(armorySecondsLeft({ pendingChoice: null, choiceDeadline: { ...choice, endsAt: 80_000 } })).toBeNull();
    forgetServerNow();
    expect(armorySecondsLeft({ pendingChoice: choice, choiceDeadline: { ...choice, endsAt: 80_000 } })).toBeNull();
  });
});

describe('a sold anvil opens its armory in the shop row', () => {
  it('isShopChoice is true for the anvil-unit forge and false for other forges', () => {
    const armory = { kind: 'forge', payload: { kind: 'forge', source: 'anvil-unit', timeoutMs: 30_000 } };
    expect(isAnvilArmory(armory)).toBe(true);
    expect(isShopChoice(armory)).toBe(true);
    for (const other of [{ kind: 'forge' }, { kind: 'forge', payload: { source: 'opening-encounter' } }, { kind: 'component', payload: { source: 'anvil-unit' } }]) {
      expect(isAnvilArmory(other)).toBe(false);
      expect(isShopChoice(other)).toBe(false);
    }
  });
});

describe('bench piece', () => {
  const unit = (definitionId: string): Unit => ({ id: 'unit-9', definitionId, team: 'player', starLevel: 1, location: { kind: 'bench', slot: 0 } } as unknown as Unit);
  const shown = (view: UnitView) => view as unknown as { star: { text: string; visible: boolean }; costBadge: { visible: boolean }; costText: { visible: boolean } };
  it.each(['board', 'bench'] as const)('keeps an obtained anomaly mark on a %s piece through identity refresh and clears it on removal', place => {
    const hero = { ...unit('vex'), location: place === 'bench' ? { kind: 'bench', slot: 0 } : { kind: 'board', cell: { row: 4, col: 0 } } } as Unit;
    const view = new UnitView(fake.scene() as never, hero, 0, 0);
    const mark = (view as unknown as { anomalyMark: { text: string; visible: boolean } }).anomalyMark;
    expect(mark.visible).toBe(false);
    view.setAnomalies(unitAnomalies('the-finisher', []));
    expect(mark.visible).toBe(true); expect(mark.text).toBe('异');
    view.update({ ...hero, starLevel: 2 }, []);
    expect(mark.visible).toBe(true); expect(view.anomalies).toEqual([{ id: 'the-finisher', source: 'native' }]);
    view.setAnomalies(unitAnomalies(undefined, ['TFT13_AnotherAnomaly_Item:the-finisher']));
    expect(mark.visible).toBe(true); expect(mark.text).toBe('异·复');
    view.setAnomalies([]);
    expect(mark.visible).toBe(false); expect(view.anomalies).toEqual([]);
  });
  it('an anvil shows neither stars nor a cost; a hero keeps both', () => {
    const scene = fake.scene() as never;
    const anvil = shown(new UnitView(scene, unit('TFT_ArmoryKeyCompleted'), 0, 0));
    expect(anvil.star.text).toBe('');
    expect(anvil.star.visible).toBe(false);
    expect(anvil.costBadge.visible).toBe(false);
    expect(anvil.costText.visible).toBe(false);
    const hero = shown(new UnitView(scene, unit('vex'), 0, 0));
    expect(hero.star.text).toBe('★');
    expect(hero.star.visible).toBe(true);
    expect(hero.costBadge.visible).toBe(true);
    expect(hero.costText.visible).toBe(true);
  });
});
