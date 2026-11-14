import { expect, it } from 'vitest';
import { MINI_MODEL_SCALE, pieceModel, unitModelId } from '../src/rendering/three-mode/unit-model';
import { startAnomaly } from './helpers/s13-anomalies';
import { toCombatViewState } from '../src/simulation/combat-replay-view';
it('loads each verified anvil by its own 14.24 character manifest key', () => {
  expect(unitModelId('TFT_ArmoryKeyComponent', true)).toBe('TFT_ArmoryKeyComponent');
  expect(unitModelId('TFT_ArmoryKeyCompleted', true)).toBe('TFT_ArmoryKeyCompleted');
  expect(unitModelId('TFT_ArmoryKeyOrnn', true)).toBe('TFT_ArmoryKeyOrnn');
  expect(unitModelId('TFT_ArmoryKeySupport', true)).toBe('TFT_ArmoryKeySupport');
  expect(unitModelId('TFT_ArmoryKeyRadiant', true)).toBeNull();
  expect(unitModelId('unverified-anvil', true)).toBeNull();
  expect(unitModelId('maddie', false)).toBe('maddie');
});

it.each(['player', 'enemy'] as const)('resolves each mini from its own %s owner, regardless of roster order', team => {
  const owners = ['jinx', 'vi', 'elise-ranged'].map((definitionId, i) => ({ id: `owner:${i}`, definitionId, team }));
  const pieces = new Map(owners.map(owner => [owner.id, owner]));
  for (const owner of owners) for (const ordinal of [0, 1, 2]) {
    const mini = { id: JSON.stringify([owner.id, 'source', 'anomaly', 'mini', ordinal]), definitionId: 's13-mini', team };
    expect(pieceModel(mini, pieces, false)).toEqual({ id: owner.definitionId, scale: MINI_MODEL_SCALE });
    expect(pieceModel(mini, new Map([...pieces].reverse()), false)).toEqual({ id: owner.definitionId, scale: MINI_MODEL_SCALE });
  }
});

it.each(['bad-json', '{}', 'null', '["owner","source","anomaly","mini"]',
  '["owner","source","anomaly","wolf",1]', '["owner","source","anomaly","mini",-1]',
  '["owner","source","anomaly","mini",1.5]', '["owner",false,"anomaly","mini",1]'])('keeps an unrecognized mini identity as a pawn: %s', id => {
  expect(pieceModel({ id, definitionId: 's13-mini', team: 'player' },
    new Map([['owner', { id: 'owner', definitionId: 'jinx', team: 'player' }]]), false))
    .toEqual({ id: null, scale: MINI_MODEL_SCALE });
});

it('never borrows an opponent, a neutral, another mini, or a missing owner', () => {
  const mini = { id: JSON.stringify(['owner', 'source', 'anomaly', 'mini', 1]), definitionId: 's13-mini', team: 'player' as const };
  for (const owner of [undefined,
    { id: 'owner', definitionId: 'jinx', team: 'enemy' as const },
    { id: 'owner', definitionId: 'pve-wolf-small', team: 'player' as const, neutral: true as const },
    { id: 'owner', definitionId: 's13-mini', team: 'player' as const }]) {
    expect(pieceModel(mini, new Map(owner ? [[owner.id, owner]] : []), false)).toEqual({ id: null, scale: MINI_MODEL_SCALE });
  }
});

it('resolves every real DeftHands summon from a serialized replay keyframe without private owner fields', () => {
  const state = startAnomaly('DeftHands');
  const view = JSON.parse(JSON.stringify(toCombatViewState(state))) as ReturnType<typeof toCombatViewState>;
  const pieces = new Map(view.units.map(unit => [unit.id, unit]));
  const minis = state.units.filter(unit => unit.anomalySummon?.kind === 'mini');
  expect(minis.map(unit => unit.anomalySummon!.ordinal)).toEqual([0, 1, 2]);
  for (const mini of minis) {
    const projected = pieces.get(mini.id)!;
    expect(projected).not.toHaveProperty('anomalySummon');
    expect(pieceModel(projected, pieces, false)).toEqual({
      id: pieces.get(mini.anomalySummon!.ownerId)!.definitionId, scale: MINI_MODEL_SCALE,
    });
  }
});
