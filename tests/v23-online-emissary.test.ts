import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMatch, enableMultiplayerSettlement, snapshotForBattle, compileBattle, startTwoSidedCombat } from '../src/server-entry';
import type { MatchState } from '../src/simulation/match-types';
import type { Unit } from '../src/simulation/unit-types';
import { getMultiplayerRoundById } from '../src/simulation/multiplayer-round';
import { deriveTraits } from '../src/simulation/trait-snapshot';
import { getUnitStats } from '../src/simulation/unit-stats';
import { toSeatPrivateView } from '../src/server/room/projection';
import { toDisplayMatch } from '../src/rendering/online/seat-view-adapter';
import { boardTraitRows, renderTraitRows } from '../src/rendering/trait-column';

// Isolated board/ledger fixture, not a restore-valid save. The multiplayer projection,
// snapshot compiler and combat constructor below are the production entry points.
const EMISSARIES = ['garen', 'nami', 'tristana', 'ambessa'];
function seat(names: string[], wins = 0): MatchState {
  const base = createMatch(42), round = getMultiplayerRoundById('3-1');
  const enabled = enableMultiplayerSettlement(base, 's0');
  if (!enabled.ok) throw new Error(enabled.reason);
  const units: Unit[] = [...names, 'lux'].map((definitionId, i) => ({
    id: `unit-${i + 1}`, definitionId, team: 'player', starLevel: 1,
    location: { kind: 'board', cell: { col: i === 0 ? 2 : i === names.length ? 1 : i + 2, row: 4 } },
  }));
  return { ...enabled.state, round: round.ordinal, roundDefinitionId: round.roundId,
    m8: { ...base.m8, round }, level: 9, items: [], temporaryEquipment: [], augments: [],
    preparation: { ...base.preparation, units },
    roundResults: ['2-1', '2-2', '2-3'].slice(0, wins).map(roundId => {
      const r = getMultiplayerRoundById(roundId);
      return { round: r.ordinal, roundId, roundKind: 'pvp', result: 'playerWin' } as MatchState['roundResults'][number];
    }) };
}

describe('v23 online four Emissaries (14.24b)', () => {
  // docs/evidence/g2-2/RECONCILIATION.md:548 and the archived 14.24 text:
  // all four team bonuses; members alone gain 200 HP and 20% damage amp.
  it('freezes tier 4 and all bonuses for both sides, including non-member allies', () => {
    const a = seat(EMISSARIES, 3), b = seat(EMISSARIES);
    expect(deriveTraits(a.preparation, 'player').find(t => t.traitId === 'emissary'))
      .toMatchObject({ count: 4, tier: 4, memberDefinitionIds: [...EMISSARIES].sort() });
    const input = compileBattle(snapshotForBattle(a, 'A'), snapshotForBattle(b, 'B'), 42, { battleId: 'v23-four-emissaries' });
    const combat = startTwoSidedCombat(input);
    for (const [seatId, team, bonusResist] of [['A', 'player', 6], ['B', 'enemy', 0]] as const) {
      expect(input.strategy.traits.find(t => t.team === team && t.traitId === 'emissary'))
        .toMatchObject({ count: 4, tier: 4 });
      for (const original of a.preparation.units) {
        const id = input.mapping.find(m => m.seatId === seatId && m.kind === 'unit' && m.originalId === original.id)!.combatId;
        const frozen = input.strategy.units.find(u => u.unitId === id)!;
        const unit = combat.units.find(u => u.id === id)!;
        const member = original.definitionId !== 'lux', base = getUnitStats(original.definitionId, 1);
        expect(frozen.stats.health).toBe(base.health + (member ? 200 : 0));
        expect(unit.armor).toBe(base.armor + bonusResist);
        expect(unit.magicResist).toBe(base.magicResist + bonusResist);
        expect(unit.attackSpeedBonusBps).toBe(600);
        expect(unit.mechanics?.find(m => m.mechanic === 'extraAttackMana')?.values.amount).toBe(2);
        expect(unit.mechanics?.filter(m => m.mechanic === 'damageAmp').map(m => m.values.bps))
          .toEqual(member ? [2000] : []);
        // Garen at col 2 shares floor(1200 * .12) with himself and his two neighbours.
        const shared = ['garen', 'nami', 'lux'].includes(original.definitionId) ? 144 : 0;
        expect(unit.maxHp).toBe(frozen.stats.health + shared);
      }
    }
  });

  it.each([2, 3])('%i distinct Emissaries remain inactive in multiplayer combat', count => {
    const state = seat(EMISSARIES.slice(0, count));
    const input = compileBattle(snapshotForBattle(state, 'A'), snapshotForBattle(state, 'B'), 42, { battleId: 'v23-inactive-emissaries' });
    expect(input.strategy.traits.filter(t => t.traitId === 'emissary').map(t => t.tier)).toEqual([0, 0]);
    for (const unit of input.strategy.units)
      expect(unit.sources.filter(s => s.source.sourceKind === 'trait' && s.source.sourceDefinitionId === 'emissary')).toEqual([]);
  });

  it('renders the online private view as active gold tier 4 with breakpoint 4 highlighted', () => {
    class Node {
      children: Node[] = []; dataset: Record<string, string> = {}; textContent = ''; className = '';
      attributes: Record<string, string> = {};
      append(...nodes: Node[]) { this.children.push(...nodes); }
      insertAdjacentHTML() {}
      setAttribute(key: string, value: string) { this.attributes[key] = value; }
    }
    vi.stubGlobal('document', { createElement: () => new Node() });
    const display = toDisplayMatch(toSeatPrivateView(seat(EMISSARIES)));
    const rows = boardTraitRows(display.preparation);
    expect(rows.find(r => r.traitId === 'emissary')).toMatchObject({ count: 4, tier: 4, thresholds: [1, 4] });
    const list = renderTraitRows(rows, 'online:traits', '') as unknown as Node;
    const row = list.children.find(n => n.dataset.trait === 'emissary')!;
    expect(row.className).toBe('trait-row active');
    expect(row.dataset).toMatchObject({ count: '4', tier: '4', style: 'gold' });
    expect(row.attributes['aria-label']).toContain('已激活 4 档');
    expect(row.children.flatMap(n => n.children).find(n => n.className === 'trait-step current')?.textContent).toBe('4');
  });
});

afterEach(() => vi.unstubAllGlobals());
