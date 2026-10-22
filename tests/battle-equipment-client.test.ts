import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMatch, deployMatchUnit, openMatchCombatStream } from '../src/simulation/match';
import { toCombatViewState, applyCombatReplayTick, type CombatReplay, type CombatViewUnit } from '../src/presentation/combat-display';
import { combatEquipmentDisplay } from '../src/presentation/battle-equipment';
import { BATTLE_EQUIPMENT_SUBMITTED, equipSuccessText, equipmentFailureText, NO_GEAR_EXTRAS } from '../src/presentation/equipment-feedback';
import { RemoteSession, REPLAY_OPENING_MS } from '../src/rendering/online/remote-session';
import { MatchSession } from '../src/rendering/match-session';
import type { GameClient } from '../src/rendering/online/protocol';
import { createUnitOverhead, DEFAULT_METER_COLORS } from '../src/rendering/three-mode/unit-overhead';

const sessions: MatchSession[] = [];
afterEach(() => { for (const session of sessions.splice(0)) session.dispose(); });

function fixture(side: 'pve' | 'a' | 'b' = 'pve') {
  const start = createMatch(42), id = start.preparation.units.find(unit => unit.team === 'player')!.id;
  const deployed = deployMatchUnit(start, id, { kind: 'board', cell: { col: 3, row: 6 } });
  if (!deployed.ok) throw Error(deployed.reason);
  const state = { ...deployed.state, items: ['sword', 'bow'].map((definitionId, i) => ({ id: `item-${i}`, definitionId, location: { kind: 'inventory' as const } })), nextItemSerial: 3 };
  const opened = openMatchCombatStream(state); if (!opened.ok) throw Error(opened.reason);
  const combatId = side === 'pve' ? id : JSON.stringify(['battle', side, 'unit', id]);
  const initial = toCombatViewState(opened.state.combat!);
  const view = { ...initial, units: initial.units.map(unit => unit.id === id ? { ...unit, id: combatId } : unit) };
  const replay: CombatReplay = { initial: view, terminal: view, ticks: [{ tick: view.tick, events: [] }] };
  let commandId = 0;
  const send = vi.fn<GameClient['send']>(() => ({ ok: 'pending', commandId: ++commandId }));
  const client: GameClient = { transport: 'websocket', listen: () => () => {}, joinQueue() {}, leaveQueue() {}, startMatch() {}, reset() {}, dispose() {}, send };
  const mapping = side === 'pve' ? [] : [{ combatId, originalId: id }];
  const session = new RemoteSession(client, state, () => 0); session.receiveReplay(replay, mapping); sessions.push(session);
  return { state, opened, id, combatId, replay, session, send, mapping, client };
}
const gear = (unit: CombatViewUnit) => combatEquipmentDisplay(unit.equipment, ['belt'], NO_GEAR_EXTRAS);

describe('battle equipment client commands and notices', () => {
  it.each(['pve', 'a', 'b'] as const)('%s uses the permanent ID, sends only the existing equip command and waits for the receipt', side => {
    const { session, id, combatId, send } = fixture(side), before = session.state;
    expect(session.equipmentTargetId(combatId)).toBe(id);
    expect(session.equip('item-0', combatId, 0).ok).toBe(false);
    expect(send).toHaveBeenCalledWith({ type: 'equip', itemId: 'item-0', unitId: id, slot: 0 });
    expect(session.takeNotice()).toEqual({ kind: 'pending', commandId: 1 });
    expect(session.state).toBe(before);
    expect(equipSuccessText(session.phase, null)).toBe(BATTLE_EQUIPMENT_SUBMITTED);
    expect(equipSuccessText(session.phase, '巨人杀手')).toBe('已提交，下一拍生效');
    session.dispose();
  });
  it('bench and finished-battle notices retain next-battle timing', () => {
    expect(equipSuccessText('combat', null, false)).toBe('装备已穿戴 · 下场生效');
    expect(equipSuccessText('preparation', null, false)).toBe('装备已穿戴');
  });
  it('two drops before a receipt send two intents without locally consuming or combining items', () => {
    const { session, combatId, send } = fixture('b'), before = session.state;
    session.equip('item-0', combatId, 0); session.equip('item-1', combatId, 0);
    expect(send).toHaveBeenCalledTimes(2); expect(session.state).toBe(before);
    expect(session.state.items.every(item => item.location.kind === 'inventory')).toBe(true);
    session.dispose();
  });
  it.each(['enemy', 'mirror', 'summon', 'removed', 'watch', 'spectator'])('does not submit to %s', kind => {
    const { session, combatId, replay, send, mapping, state } = fixture('b');
    let target = combatId;
    if (kind === 'watch') session.watchReplay('other-seat', replay);
    else if (kind === 'spectator') session.spectating = true;
    else {
      target = kind === 'removed' ? combatId : kind;
      const unit = replay.initial.units.find(unit => unit.id === combatId)!;
      const units = kind === 'removed' ? replay.initial.units.filter(unit => unit.id !== combatId)
        : [...replay.initial.units, { ...unit, id: kind, team: kind === 'enemy' ? 'enemy' as const : 'player' as const }];
      session.receiveReplay({ ...replay, initial: { ...replay.initial, units } }, mapping);
    }
    expect(session.equipmentTargetId(target)).toBeUndefined();
    expect(session.equip('item-0', target, 0)).toMatchObject({ ok: false, reason: 'battle-unit-unavailable' });
    expect(send).not.toHaveBeenCalled(); expect(session.state.items).toEqual(state.items); session.dispose();
  });
  it('a dead permanent instance remains a valid target', () => {
    const { session, replay, mapping, combatId, id } = fixture('b');
    const units = replay.initial.units.map(unit => unit.id === combatId ? { ...unit, alive: false, hp: 0 } : unit);
    session.receiveReplay({ ...replay, initial: { ...replay.initial, units } }, mapping);
    expect(session.equipmentTargetId(combatId)).toBe(id); session.dispose();
  });
  it.each(['battle-unit-unavailable', 'battle-input-invalid', 'item-slot-occupied'] as const)('names %s in Chinese and leaves the inventory intact', reason => {
    const { session, combatId, send } = fixture(), before = session.state;
    send.mockReturnValue({ ok: false, state: before, reason });
    expect(session.equip('item-0', combatId, 0)).toMatchObject({ ok: false, reason });
    expect(session.takeNotice()).toBeNull(); expect(session.state).toBe(before);
    expect(equipmentFailureText(reason)).toMatch(/[\u4e00-\u9fff]/); session.dispose();
  });
});

describe('battle equipment public frames', () => {
  it('an asset receipt does not update icons; the unitUpdated frame replaces the whole loadout including temporary children', () => {
    const { session, state, replay, id, combatId, mapping } = fixture('b');
    const equipment = [{ definitionId: 'thiefs-gloves', slot: 0, temporary: false },
      { definitionId: 'giant-slayer', slot: 1, temporary: true }, { definitionId: 'warmogs-armor', slot: 2, temporary: true }];
    session.receiveState({ ...state, items: state.items.map(item => ({ ...item, location: { kind: 'unit', unitId: id, slot: 0 } })) });
    expect(gear(session.combatView!.units.find(unit => unit.id === combatId)!)).toEqual({ equipped: ['belt'], extras: NO_GEAR_EXTRAS });
    const tick = { tick: replay.initial.tick + 1, events: [{ type: 'unitUpdated' as const, tick: replay.initial.tick + 1, eventSeq: 1, unitId: combatId, changes: { equipment } }] };
    const terminal = applyCombatReplayTick(replay.initial, tick);
    session.receiveReplay({ ...replay, ticks: [tick], terminal }, mapping); session.advanceDisplay(REPLAY_OPENING_MS);
    const shown = gear(session.combatView!.units.find(unit => unit.id === combatId)!);
    expect(shown).toEqual({ equipped: ['thiefs-gloves'], extras: { reserved: 0, temporary: ['giant-slayer', 'warmogs-armor'] } });
    const overhead = createUnitOverhead({ colors: () => DEFAULT_METER_COLORS, itemTexture: async () => null });
    overhead.set('player', undefined, shown.equipped.concat(shown.extras.temporary).map(id => ({ id, icon: null })));
    expect(overhead.object.getObjectByName('render3d-overhead-items')!.children.map(child => child.name)).toEqual(equipment.map(item => `render3d-overhead-item-${item.definitionId}`));
    overhead.set('player', undefined, [{ id: 'giant-slayer', icon: null }]);
    expect(overhead.object.getObjectByName('render3d-overhead-items')!.children).toHaveLength(1);
    overhead.dispose(); session.dispose();
  });
  it('reconnect restores equipment from the keyframe followed by ordered tail diffs', () => {
    const { client, state, replay, combatId, mapping } = fixture('b');
    const update = (tick: number, definitionId: string) => ({ tick, events: [{ type: 'unitUpdated' as const, tick, eventSeq: tick, unitId: combatId,
      changes: { equipment: [{ definitionId, slot: 0, temporary: false }] } }] });
    const keyframe = applyCombatReplayTick(replay.initial, update(20, 'sword'));
    const tail = [update(21, 'giant-slayer'), update(22, 'infinity-edge')];
    const terminal = tail.reduce(applyCombatReplayTick, keyframe);
    const restored = new RemoteSession(client, state, () => 0);
    restored.receiveReplay({ initial: keyframe, ticks: tail, terminal }, mapping);
    expect(gear(restored.combatView!.units.find(unit => unit.id === combatId)!).equipped).toEqual(['sword']);
    restored.advanceDisplay(REPLAY_OPENING_MS); restored.advanceDisplay(50);
    expect(gear(restored.combatView!.units.find(unit => unit.id === combatId)!).equipped).toEqual(['infinity-edge']);
    expect(restored.equipmentTargetId(combatId)).toBe(mapping[0].originalId); restored.dispose();
  });
  it('an explicit empty loadout clears icons rather than falling back to opening equipment', () => {
    expect(combatEquipmentDisplay([], ['sword'], { reserved: 2, temporary: ['bow'] })).toEqual({ equipped: [], extras: NO_GEAR_EXTRAS });
  });
  it('single player uses the same next-tick rule and same-tick in-place combination', () => {
    const { opened, id } = fixture(), session = new MatchSession(opened.state);
    expect(session.equip('item-0', id, 0).ok).toBe(true);
    expect(session.equip('item-1', id, 0).ok).toBe(true);
    expect(session.combatView!.units.find(unit => unit.id === id)!.equipment).toBeUndefined();
    session.advanceDisplay(50);
    expect(session.combatView!.units.find(unit => unit.id === id)!.equipment).toEqual([{ definitionId: 'giant-slayer', slot: 0, temporary: false }]);
    session.dispose();
  });
});
