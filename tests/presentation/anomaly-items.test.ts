import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Texture, type Sprite } from 'three';
import { anomalyDisplayName, anomalyIconUrl, anomalyPlayerDescription, itemDisplayName } from '../../src/presentation/g23-display';
import { itemDescriptions, itemMarkHtml } from '../../src/presentation/item-codex';
import { s13AssetUrl } from '../../src/presentation/s13-assets';
import { PORTABLE_ANOMALY_ITEMS } from '../../src/simulation/content/augment-pool-batch5-r2-items';
import { PORTABLE_ANOMALY_PREFIX } from '../../src/simulation/content/augment-pool-batch5-r2';
import { createUnitOverhead, DEFAULT_METER_COLORS } from '../../src/rendering/three-mode/unit-overhead';
import { toDisplayMatch } from '../../src/rendering/online/seat-view-adapter';
import { readUnclaimedOrbs } from '../../src/rendering/online/orb-dock';
import { toPublicBoard, toPublicOrbs, toSeatPrivateView } from '../../src/server/room/projection';
import { selectAnomalyTarget, rerollAnomaly, selectChoice, equipItem } from '../../src/simulation/match';
import { enableMultiplayerSettlement } from '../../src/simulation/round-settlement';
import { recordAugmentAcquisition } from '../../src/simulation/augment-history';
import type { MatchState } from '../../src/simulation/match-types';
import { accepted, catalogPreparation } from '../t5r-helpers';

// Isolated 4-6 projection fixture, not a restorable save. Selection, grants and projection use production code.
function selectAnomaly(id: string, portable = false): MatchState {
  const base = accepted(enableMultiplayerSettlement(catalogPreparation('4-6'), 's0'));
  const unit = base.preparation.units.find(u => u.team === 'player')!;
  let state: MatchState = { ...base, gold: 1000, phase: 'choice', combat: null, augments: [],
    preparation: { ...base.preparation, units: [
      { ...unit, id: 'original', definitionId: 'irelia', location: { kind: 'board', cell: { row: 4, col: 0 } } },
      { ...unit, id: 'copy', definitionId: 'vex', location: { kind: 'bench', slot: 0 } },
    ] },
    pendingChoice: { kind: 'anomaly', step: 'target', choiceId: 'round:4-6:anomaly', eventId: 'round:4-6:anomaly',
      generation: 0, offers: [], targetId: null, rerollCount: 0, returnPhase: 'preparation' } };
  if (portable) state = recordAugmentAcquisition(state, { ...state,
    augments: [{ definitionId: 'another-anomaly', choiceId: 'round:4-2:augment', acquiredRound: 23 }] });
  let c = state.pendingChoice!;
  state = accepted(selectAnomalyTarget(state, c.choiceId, c.generation, 'original'));
  for (let n = 0; n < 512 && !state.pendingChoice!.offers.includes(id); n++) {
    c = state.pendingChoice!;
    state = accepted(rerollAnomaly(state, c.choiceId, c.generation));
  }
  c = state.pendingChoice!;
  expect(c.offers).toContain(id);
  return accepted(selectChoice(state, c.choiceId, c.generation, id));
}
const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('4-6 anomaly reward display path', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps both 双刀流 items in the private inventory through the wire and display adapter; no claim orb is minted', () => {
    const state = selectAnomaly('dual-wielding');
    const rewards = state.seatMechanics!.receipts.filter(r => r.source === 's13-anomaly-acquisition');
    expect(rewards).toHaveLength(2);
    const ids = rewards.map(r => { expect(r.kind).toBe('item'); return r.kind === 'item' ? r.itemId : ''; });
    const projected = toSeatPrivateView(state), display = toDisplayMatch(wire(projected));
    const items = state.items.filter(i => ids.includes(i.id));
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.location).toEqual({ kind: 'inventory' });
      expect(display.items).toContainEqual(item);
      expect(itemMarkHtml(item.definitionId, 28)).toContain('<img');
      expect(toPublicBoard(state).looseItems).toContain(item.definitionId);
    }
    expect(readUnclaimedOrbs(display)).toEqual(projected.unclaimedOrbs);
    expect(projected.unclaimedOrbs).toEqual([]);
    expect(toPublicOrbs(state)).toEqual({ count: 0, tiers: [] });
  });

  it('carries the portable identity from actual selection through private/public inventory and equipment views', () => {
    const state = selectAnomaly('bulwark', true), id = `${PORTABLE_ANOMALY_PREFIX}bulwark`;
    const item = state.items.find(i => i.definitionId === id)!;
    expect(item).toBeDefined();
    expect(item.location).toEqual({ kind: 'inventory' });
    const display = toDisplayMatch(wire(toSeatPrivateView(state)));
    expect(display.items).toContainEqual(item);
    expect(toPublicBoard(state).looseItems).toContain(id);
    expect(readUnclaimedOrbs(display)).toEqual([]);
    const equipped = accepted(equipItem(state, item.id, 'copy', 0));
    expect(toDisplayMatch(wire(toSeatPrivateView(equipped))).items.find(i => i.id === item.id)?.location)
      .toEqual({ kind: 'unit', unitId: 'copy', slot: 0 });
    expect(toPublicBoard(equipped).bench?.find(u => u.definitionId === 'vex')?.items).toContain(id);
    expect(s13AssetUrl('item', id)).toBe(anomalyIconUrl());
  });

  it('uses the archived portable item name, the selected anomaly text and the real shared icon for every variant', () => {
    expect(Object.keys(PORTABLE_ANOMALY_ITEMS).length).toBeGreaterThan(0);
    for (const [id] of Object.entries(PORTABLE_ANOMALY_ITEMS)) {
      const anomaly = id.slice(PORTABLE_ANOMALY_PREFIX.length), name = anomalyDisplayName(anomaly);
      expect(itemDisplayName(id)).toBe(`便携异常点：${name}`);
      expect(itemDescriptions(id)).toContain(`携带者获得【${name}】的异常突变进化效果。`);
      expect(itemDescriptions(id)).toContain(anomalyPlayerDescription(anomaly));
      expect(itemDescriptions(id)).toContain('生命 +250 · 攻击力 +20% · 法强 +25');
      expect(itemMarkHtml(id, 28)).toContain(`src="${anomalyIconUrl()}"`);
      expect(s13AssetUrl('item', id)).toBe(anomalyIconUrl());
    }
    const path = anomalyIconUrl()!;
    expect(readFileSync(new URL(`../../public/${path.replace(/^\//, '')}`, import.meta.url)).subarray(0, 4).toString('hex')).toBe('89504e47');
    expect(s13AssetUrl('item', `${PORTABLE_ANOMALY_PREFIX}unknown`)).toBeNull();
  });

  it('loads the anomaly texture into the actual 3D equipment sprite instead of leaving its gray placeholder', async () => {
    const id = `${PORTABLE_ANOMALY_PREFIX}bulwark`, icon = new Texture();
    const itemTexture = vi.fn(async () => icon);
    const overhead = createUnitOverhead({ colors: () => DEFAULT_METER_COLORS, itemTexture });
    try {
      overhead.set('player', undefined, [{ id, icon: s13AssetUrl('item', id) }]);
      await Promise.resolve();
      expect(itemTexture).toHaveBeenCalledExactlyOnceWith(anomalyIconUrl());
      const sprite = overhead.object.getObjectByName(`render3d-overhead-item-${id}`) as Sprite;
      expect(sprite.material.map).toBe(icon);
      expect(overhead.drawn).toBe(true);
    } finally { overhead.dispose(); icon.dispose(); }
  });
});
