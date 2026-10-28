import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: {} }));
import type { UnitView } from '../src/presentation/unit-view';
import { loadConfiscationDisplay } from '../src/rendering/online/confiscation-display';
import ConfiscationDisplay, { syncCombatEquipment } from '../src/presentation/confiscation-display';
import { enforcerConfiscates } from '../src/simulation/strategy-snapshot';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { deriveTraits } from '../src/simulation/trait-snapshot';
import { combatEquipmentDisplay } from '../src/presentation/battle-equipment';
import { createMatch, startMatchCombat } from '../src/simulation/match';
import { toCombatViewState, type CombatViewState } from '../src/presentation/combat-display';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import type { PlayerView, PublicBoard } from '../src/server/protocol';

const dependencies = { enforcerConfiscates, units: UNIT_DEFINITIONS, items: ITEM_DEFINITIONS, deriveTraits, combatEquipmentDisplay };
const emblem = Object.values(EMBLEM_ITEMS).find(item => item.emblemTrait === 'enforcer')!.id;
const empty = { reserved: 0, temporary: [] };
const enforcers = ['maddie', 'loris', 'caitlyn', 'camille', 'steb', 'twistedfate', 'vi'];
const army = (ten = true): PublicBoard => ({ units: [...enforcers, ...(ten ? ['corki', 'ekko', 'powder'] : [])].map((definitionId, index) => ({
  definitionId, starLevel: 1, cell: { col: index % 7, row: 4 + Math.floor(index / 7) }, items: index >= 7 ? [emblem, 'belt'] : [],
})) });
const victim: PublicBoard = { units: [{ definitionId: 'corki', starLevel: 1, cell: { col: 3, row: 4 }, items: ['deathblade', emblem] },
  { definitionId: 'training-dummy', starLevel: 1, cell: { col: 4, row: 4 }, items: ['deathblade'], summon: true }] };
function fixture(left = victim, right = army()) {
  const start = startMatchCombat(createMatch(42));
  if (!start.ok || !start.state.combat) throw Error('fixture combat');
  const base = toCombatViewState(start.state.combat);
  const units = [left, right].flatMap((board, side) => board.units.map((unit, index) => ({ ...base.units[0],
    id: `${side}:${index}`, definitionId: unit.definitionId, starLevel: 1 as const,
    team: side === 0 ? 'player' as const : 'enemy' as const,
    cell: { col: unit.cell.col, row: side === 0 ? unit.cell.row : base.board.rows - 1 - unit.cell.row },
  })));
  const initial: CombatViewState = { ...base, combatId: 'test-confiscation', units };
  const view = { mySeatId: 'me', opponentSeatId: 'other', phase: { kind: 'combat', round: 5 },
    seats: [{ seatId: 'me', publicBoard: left }, { seatId: 'other', publicBoard: right }] } as unknown as PlayerView;
  const display = new ConfiscationDisplay(dependencies); display.observe(view); display.capture(initial);
  return { display, initial, view };
}

describe('v26 confiscation presentation', () => {
  it('stamps a victim whose frame has no replacement loadout, retains emblems, and leaves all source data untouched', () => {
    const { display, initial, view } = fixture();
    const before = JSON.stringify({ initial, view });
    expect(display.gear(initial.combatId, '0:0', ['deathblade', emblem], { reserved: 2, temporary: ['belt'] }))
      .toEqual({ equipped: [emblem], extras: empty, confiscated: true });
    expect(display.gear(initial.combatId, '0:0', [emblem], empty).confiscated).toBe(true);
    expect(display.gear(initial.combatId, '0:1', ['deathblade'], empty).confiscated).toBe(false); // non-champion
    expect(display.gear(initial.combatId, '1:0', ['deathblade'], empty).confiscated).toBe(false); // unaffected side
    expect(JSON.stringify({ initial, view })).toBe(before);
  });
  it('does not label lower tiers or missing/legacy public data as confiscation', () => {
    const { display, initial } = fixture(victim, army(false));
    expect(display.gear(initial.combatId, '0:0', ['deathblade'], empty).confiscated).toBe(false);
    const unknown = new ConfiscationDisplay(dependencies); unknown.capture(initial);
    expect(unknown.gear(initial.combatId, '0:0', ['deathblade'], empty).equipped).toEqual(['deathblade']);
  });
  it('supports mutual confiscation and latches the stamp when gear arrives during combat', () => {
    const { display, initial } = fixture(army(), army());
    for (const side of [0, 1]) {
      expect(display.gear(initial.combatId, `${side}:0`, [], empty).confiscated).toBe(false);
      expect(display.gear(initial.combatId, `${side}:0`, ['belt'], empty).equipped).toEqual([]);
      expect(display.gear(initial.combatId, `${side}:0`, [], empty).confiscated).toBe(true);
      expect(display.gear(initial.combatId, `${side}:7`, [emblem], empty)).toEqual({ equipped: [emblem], extras: empty, confiscated: true });
    }
  });
  it('freezes combat formations and clears the notice at a new round', () => {
    const { display, initial, view } = fixture();
    display.observe({ ...view, seats: [] });
    expect(display.gear(initial.combatId, '0:0', [], empty).confiscated).toBe(true);
    display.observe({ ...view, phase: { ...view.phase, round: 6, kind: 'preparation' } });
    expect(display.gear(initial.combatId, '0:0', ['deathblade'], empty).confiscated).toBe(false);
  });
  it('identifies a watched opponent from its unique opening formation', () => {
    const { initial, view } = fixture();
    const display = new ConfiscationDisplay(dependencies);
    display.observe({ ...view, mySeatId: 'spectator', opponentSeatId: null }); display.capture(initial, 'me');
    expect(display.gear(initial.combatId, '0:0', [], empty).confiscated).toBe(true);
  });
  it('keeps the first combat view when settlement arrives before the replay or the first gear read', () => {
    const { initial, view } = fixture();
    const display = new ConfiscationDisplay(dependencies);
    display.observe(view);
    display.observe({ ...view, seats: [], phase: { ...view.phase, kind: 'settlement' } });
    display.capture(initial);
    expect(display.gear(initial.combatId, '0:0', [emblem], empty)).toEqual({ equipped: [emblem], extras: empty, confiscated: true });
    display.observe({ ...view, seats: [], phase: { ...view.phase, kind: 'ended' } });
    expect(display.gear(initial.combatId, '0:0', [], empty).confiscated).toBe(true);
    display.observe({ ...view, phase: { ...view.phase, round: 6, kind: 'preparation' } });
    display.capture({ ...initial, combatId: 'next-round' });
    expect(display.gear('next-round', '0:0', ['deathblade'], empty)).toEqual({ equipped: ['deathblade'], extras: empty, confiscated: false });
  });
  it('treats public trait selector failures as unknown and does not retry them every frame', () => {
    const { initial, view } = fixture();
    for (const failAt of [1, 2]) {
      const selector = vi.fn<typeof deriveTraits>((...args) => {
        if (selector.mock.calls.length === failAt) throw new RangeError('invalid public formation');
        return deriveTraits(...args);
      });
      const display = new ConfiscationDisplay({ ...dependencies, deriveTraits: selector });
      display.observe(view); display.capture(initial);
      const equipped = ['deathblade', emblem], extras = { reserved: 2, temporary: ['belt'] };
      for (let frame = 0; frame < 3; frame++) {
        const gear = display.gear(initial.combatId, '0:0', equipped, extras);
        expect(gear).toEqual({ equipped, extras, confiscated: false });
        expect(gear.equipped).toBe(equipped); expect(gear.extras).toBe(extras);
      }
      expect(selector).toHaveBeenCalledTimes(failAt);
    }
  });
  it('ignores missing and empty combat ids without reading public traits', () => {
    const { initial, view } = fixture();
    const selector = vi.fn(deriveTraits), display = new ConfiscationDisplay({ ...dependencies, deriveTraits: selector });
    display.observe(view);
    for (const combatId of [undefined, '']) {
      display.capture({ ...initial, combatId });
      expect(display.gear(combatId, '0:0', ['deathblade'], empty)).toEqual({ equipped: ['deathblade'], extras: empty, confiscated: false });
    }
    expect(selector).not.toHaveBeenCalled();
  });
  it('confiscates unknown item definitions just like the authoritative snapshot, while retaining known emblems', () => {
    const left: PublicBoard = { units: [{ ...victim.units[0], items: ['future-item', emblem] }] };
    const { display, initial } = fixture(left);
    expect(ITEM_DEFINITIONS['future-item']).toBeUndefined();
    expect(display.gear(initial.combatId, '0:0', [emblem], empty)).toEqual({ equipped: [emblem], extras: empty, confiscated: true });
    expect(display.gear(initial.combatId, '0:0', ['future-item', emblem], { reserved: 2, temporary: ['future-temporary', emblem] }))
      .toEqual({ equipped: [emblem], extras: { reserved: 0, temporary: [emblem] }, confiscated: true });
  });
  it('buffers combat and settlement pushes until the lazy display loads, then creates and clears the moving-body stamp', async () => {
    const { initial, view } = fixture();
    const tag = { visible: true, setVisible: vi.fn(function (this: { visible: boolean }, on: boolean) { this.visible = on; }), setOrigin: vi.fn() };
    tag.setOrigin.mockReturnValue(tag);
    const drawn = { equipped: ['deathblade', emblem], extras: empty, body: { add: vi.fn() }, update: vi.fn(),
      token: { scene: { add: { text: vi.fn(() => tag) } } }, confiscationTag: undefined };
    const views = new Map([['0:0', drawn as unknown as UnitView]]);
    let display: ConfiscationDisplay | undefined;
    const pending = loadConfiscationDisplay(dependencies).then(value => display = value);
    void pending.then(value => value?.observe(view));
    void pending.then(value => value?.observe({ ...view, seats: [], phase: { ...view.phase, kind: 'settlement' } }));
    void pending.then(value => value?.capture(initial));
    expect(display?.sync(initial, views) ?? false).toBe(false); // The normal authoritative gear path remains active.
    expect(drawn.update).not.toHaveBeenCalled(); expect(drawn.token.scene.add.text).not.toHaveBeenCalled();
    await vi.dynamicImportSettled();
    expect(display!.sync(initial, views)).toBe(true);
    expect(drawn.update).toHaveBeenCalledWith(expect.objectContaining({ id: '0:0' }), [emblem], [], empty, 1, initial.units[0].itemStacks);
    expect(drawn.body.add).toHaveBeenCalledWith(tag); expect(tag.visible).toBe(true);
    display!.sync({ ...initial, units: initial.units.map(unit => ({ ...unit, alive: false })) }, views);
    expect(tag.visible).toBe(false); expect(drawn.token.scene.add.text).toHaveBeenCalledTimes(1);
  });

  it('keeps the normal loadout synchronizer free of confiscation inference and leaves legacy opening gear untouched', () => {
    const { initial } = fixture();
    const drawn = { equipped: ['deathblade', emblem], extras: { reserved: 2, temporary: ['belt'] }, update: vi.fn() };
    const views = new Map([['0:0', drawn as unknown as UnitView]]);
    syncCombatEquipment({ ...initial, units: [{ ...initial.units[0], equipment: undefined }] }, views, combatEquipmentDisplay);
    expect(drawn.update).not.toHaveBeenCalled();
    syncCombatEquipment({ ...initial, units: [{ ...initial.units[0], equipment: [] }] }, views, combatEquipmentDisplay);
    expect(drawn.update).toHaveBeenLastCalledWith(expect.objectContaining({ id: '0:0' }), [], [], empty, 1, initial.units[0].itemStacks);
    expect(drawn.equipped).toEqual(['deathblade', emblem]); // No mutation of the supplied opening array.
  });

  it('leaves the optional display unavailable when its chunk fails, so the normal gear path stays active', async () => {
    vi.doMock('../src/presentation/confiscation-display', () => { throw new Error('UI chunk unavailable'); });
    try { await expect(loadConfiscationDisplay(dependencies)).resolves.toBeUndefined(); }
    finally { vi.doUnmock('../src/presentation/confiscation-display'); }
  });

});
