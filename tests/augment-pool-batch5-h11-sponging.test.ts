import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { AUGMENT_BATCH5_H11 } from '../src/simulation/content/augment-pool-batch5-h11';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { hexDistance } from '../src/simulation/board';
import type { ItemInstance } from '../src/simulation/strategy-types';
import { readAugmentCombatEquipment } from '../src/simulation/augment-pool-batch5-h11-history';
import { G24_CHEST_PAYLOADS } from '../src/simulation/content/g2-4-chest-pool';
import type { CombatStrategyInputs } from '../src/simulation/combat-input';

function fixture(donorItems = ['rageblade', 'warmog', 'blue-buff'], reverse = false, edit: (input: CombatStrategyInputs) => CombatStrategyInputs = s => s) {
  const base = createMatch(42), unit = base.preparation.units[0];
  const units = Array.from({ length: 8 }, (_, i) => ({ ...unit, id: `p${i}`, definitionId: 'maddie', team: 'player' as const,
    location: { kind: 'board' as const, cell: i === 6 ? { col: 0, row: 7 } : i === 7 ? { col: 1, row: 6 } : { col: i, row: 5 } } }));
  const preparation = { ...base.preparation, units: [...(reverse ? [...units].reverse() : units), { ...unit, id: 'enemy', definitionId: 'training-dummy', team: 'enemy' as const, location: { kind: 'board' as const, cell: { col: 3, row: 0 } } }] };
  const items: ItemInstance[] = [6,7].flatMap(i => donorItems.map((definitionId, slot) => ({ id: `i${i}-${slot}`, definitionId, location: { kind: 'unit' as const, unitId: `p${i}`, slot } })));
  const input = { ...base, preparation, items: reverse ? [...items].reverse() : items,
    augments: [{ definitionId: 'sponging', choiceId: 'fixture', acquiredRound: 1 }] };
  const edited = edit(input), strategy = buildStrategySnapshot(edited);
  return createCombatWithEvents(edited.preparation, strategy, 'h11-sponging-fixture', 42);
}
it.skipIf(!existsSync(RESEARCH_FILE))('B5-79 preserves the archived numbers and prismatic tier', () => {
  const row = JSON.parse(readFileSync(RESEARCH_FILE, 'utf8')).find((r: any) => r.apiName === 'TFT_Augment_Sponging');
  expect(AUGMENT_BATCH5_H11.sponging.source.values).toEqual(row.effects); expect(row.tier).toBe(3);
  expect(row.item_tags_raw.filter((tag: string) => ['{d02ae323}','{d12ae4b6}','{d22ae649}'].includes(tag))).toEqual(['{d02ae323}']);
});
it('B5-79 bans 2-1, allows 3-2 / 4-2, respects seen/owned/exclusive constraints', () => {
  for (const node of ['2-1','3-2','4-2']) {
    const context = { node, fieldedTraits: [], blocked: [] };
    expect(augmentOfferAllowed('sponging', [], context)).toBe(node !== '2-1');
    expect(augmentCandidates('prismatic', [], [], null, context).includes('sponging')).toBe(node !== '2-1');
    expect(augmentCandidates('prismatic', [], ['sponging'], null, context)).not.toContain('sponging');
  }
  expect(augmentOfferAllowed('sponging', [{definitionId:'TFT_Augment_QualityOverQuantity',choiceId:'old',acquiredRound:1}])).toBe(false);
  expect(augmentCandidates('prismatic', [{definitionId:'sponging',choiceId:'old',acquiredRound:1}])).not.toContain('sponging');
});
it('B5-79 copies at tick zero to exactly the first five IDs, activates item programs and never copies again', () => {
  const result = fixture(), c = result.state;
  const recipients = c.units.filter(u => u.combatItemGrants?.length);
  expect(recipients.map(u => u.id)).toEqual(['p0','p1','p2','p3','p4']);
  expect(result.events.filter(e => e.type === 'combatItemGranted')).toHaveLength(5);
  for (const u of recipients) {
    const grant = u.combatItemGrants![0], payload = G24_CHEST_PAYLOADS[grant.definitionId];
    expect(grant).toMatchObject({grantedAtTick:0,chest:{definitionId:'sponging',sourceKind:'augment'}});
    expect(['rageblade','warmog','blue-buff']).toContain(grant.definitionId);
    expect(u.maxHpBasis!.flat).toBe(payload.maxHpFlat);
    expect(u.mechanismDefinitions).toBeDefined();
  }
  expect(stepCombat(c).state.units.flatMap(u => u.combatItemGrants ?? [])).toHaveLength(5);
  expect(fixture(undefined, true)).toEqual(result);
});
it.each(['sword','TFT5_Item_WarmogsArmorRadiant','TFT_Item_UnstableTreasureChest'])('B5-79 excludes a full donor containing %s and consumes no copy RNG', item => {
  const c = fixture(['rageblade','warmog',item]).state;
  expect(c.units.flatMap(u => u.combatItemGrants ?? [])).toEqual([]); expect(c.rngDraws).toBe(0);
});
it('B5-79 donor distance uses the opening cells and permanent slots, with detached history reads', () => {
  const c = fixture().state, rows = readAugmentCombatEquipment(c), r = rows.find(u => u.id === 'p0')!;
  const donors = rows.filter(u => u.equipment.length === 3).sort((a,b) => hexDistance(r.cell,a.cell)-hexDistance(r.cell,b.cell) || a.id.localeCompare(b.id));
  expect(donors.map(u => u.id)).toEqual(['p7','p6']);
  rows[0].cell.col = 99; expect(c.units[0].cell.col).not.toBe(99);
  expect(rows.filter(u => u.id < 'p6').every(u => u.equipment.length === 0)).toBe(true);
});

it('B5-79 actually copies the nearest donor, with unit-ID tie breaking independent of input order', () => {
  const setup = (nearer: boolean, reverse: boolean) => fixture(undefined,reverse,s => ({...s,
    preparation:{...s.preparation,units:s.preparation.units.map(u => u.id === 'p0' ? {...u,location:{kind:'board',cell:{col:3,row:7}}}
      : u.id === 'p6' ? {...u,location:{kind:'board',cell:{col:1,row:7}}}
      : u.id === 'p7' ? {...u,location:{kind:'board',cell:{col:nearer?4:5,row:7}}} : u)},
    items:s.items.map(i => ({...i,definitionId:i.location.kind === 'unit' && i.location.unitId === 'p6' ? 'warmog' : 'blue-buff'}))
  })).state;
  for (const reverse of [false,true]) {
    expect(setup(false,reverse).units.find(u => u.id === 'p0')!.combatItemGrants![0].definitionId).toBe('warmog');
    expect(setup(true,reverse).units.find(u => u.id === 'p0')!.combatItemGrants![0].definitionId).toBe('blue-buff');
  }
});

it('B5-79 permits one permanent item, excludes two, and cannot use temporary items to complete a donor', () => {
  const c = fixture(undefined,false,s => ({...s,items:[...s.items,
    {id:'single',definitionId:'sword',location:{kind:'unit',unitId:'p0',slot:0}},
    ...[0,1].map(slot => ({id:`double-${slot}`,definitionId:'sword',location:{kind:'unit' as const,unitId:'p1',slot}})),
  ]})).state;
  expect(c.units.find(u => u.id === 'p0')!.combatItemGrants).toHaveLength(1);
  expect(c.units.find(u => u.id === 'p1')!.combatItemGrants).toBeUndefined();
  expect(c.units.filter(u => u.combatItemGrants?.length).map(u => u.id)).toEqual(['p0','p2','p3','p4','p5']);
  const temporary = fixture(undefined,false,s => ({...s,
    items:s.items.filter(i => i.location.kind !== 'unit' || i.location.slot < 2),
    temporaryEquipment:[6,7].map(i => ({temporaryId:`temp-${i}`,parentItemInstanceId:`i${i}-0`,holderId:`p${i}`,definitionId:'blue-buff',slot:2 as const,roundId:'1-1',expiresAfterRoundId:'1-1'})),
  })).state;
  expect(temporary.units.flatMap(u => u.combatItemGrants ?? [])).toEqual([]);
  expect(temporary.rngDraws).toBe(0);
});

it('B5-79 freezes eligibility before copies and excludes glove-generated full slots', () => {
  const c = fixture(undefined,false,s => ({...s,
    items:[...s.items,{id:'glove',definitionId:'thiefs-gloves',location:{kind:'unit',unitId:'p0',slot:0}}],
    temporaryEquipment:([1,2] as const).map(slot => ({temporaryId:`glove-${slot}`,parentItemInstanceId:'glove',holderId:'p0',definitionId:'warmog',slot,roundId:'1-1',expiresAfterRoundId:'1-1'})),
  })).state;
  expect(c.units.find(u => u.id === 'p0')!.combatItemGrants).toBeUndefined();
  expect(c.units.filter(u => u.combatItemGrants?.length).map(u => u.id)).toEqual(['p1','p2','p3','p4','p5']);
  expect(c.units.flatMap(u => u.combatItemGrants ?? []).every(g => ['rageblade','warmog','blue-buff'].includes(g.definitionId))).toBe(true);
});
