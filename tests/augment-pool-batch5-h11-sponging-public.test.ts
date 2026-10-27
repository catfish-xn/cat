import { beforeAll, expect, it } from 'vitest';
import { createMatch, buyUnit, combineItems, equipItem, startMatchCombat, stepMatch, nextRound, selectChoice, type MatchState } from '../src/simulation/match';
import { accepted, fieldBench, finish, resolveM5Choices } from './match-helpers';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { requireAugmentFacts } from '../src/simulation/augment-history';

// Bounded 0..7 search found this public route; every item comes from actual PvE
// rewards. Three pairs become ordinary completed items via combineItems.
let route = createMatch(7), acquired: MatchState, opening: MatchState, permanent: MatchState['items'];
const priorities = ['item-grab-bag-i','big-grab-bag','heroic-grab-bag','iron-assets'];
function choices(s: MatchState) { return resolveM5Choices(s, priorities, ['spoils-of-war-i','spoils-of-war-ii','blood-brothers','caretakers-chosen']); }
for (let round = 1; round < 12; round++) beforeAll(() => {
  route = choices(route);
  if (route.phase === 'preparation') {
    if (route.m8.round.kind === 'pve') {
      for (let slot = 0; slot < 5 && route.preparation.units.filter(u => u.team === 'player').length < 3; slot++) {
        const r = buyUnit(route, slot, route.shop.generation); if (r.ok) route = r.state;
      }
      route = fieldBench(route);
    }
    route = finish(accepted(startMatchCombat(route)));
  }
  route = choices(route); route = accepted(nextRound(route, route.round));
});
beforeAll(() => {
  expect(route.roundDefinitionId).toBe('3-2'); expect(route.pendingChoice!.offers).toContain('sponging');
  // Exercise recovery of an ordinary checkpoint BEFORE acquiring history ownership.
  route = restoreMatch(JSON.stringify(route));
  const c = route.pendingChoice!;
  acquired = accepted(selectChoice(route, c.choiceId, c.generation, 'sponging'));
  let s = acquired;
  const donor = s.preparation.units.find(u => u.id === 'unit-1')!;
  for (const [a,b] of [['item-1','item-2'], ['item-3','item-4'], ['item-5','item-6']]) s = accepted(combineItems(s,a,b));
  const ids = s.items.filter(i => ['titans-resolve','shojin','dragons-claw'].includes(i.definitionId));
  expect(ids).toHaveLength(3);
  for (const [slot, item] of ids.entries()) s = accepted(equipItem(s, item.id, donor.id, slot));
  permanent = s.items;
  opening = accepted(startMatchCombat(s));
});
const entries = ['object','JSON','serialized'] as const;
const input = (s: MatchState, entry: typeof entries[number]) => entry === 'object' ? s : entry === 'JSON' ? JSON.stringify(s) : serializeMatch(s);
it('B5-79 actual choose/combine/equip/start commands copy from the nearest full ally at tick zero', () => {
  expect(opening.combat!.tick).toBe(0);
  const recipients = opening.combat!.units.filter(u => u.combatItemGrants?.length);
  expect(recipients).toHaveLength(3);
  for (const u of recipients) {
    expect(u.id).not.toBe('unit-1'); expect(u.combatItemGrants).toHaveLength(1);
    expect(['titans-resolve','shojin','dragons-claw']).toContain(u.combatItemGrants![0].definitionId);
  }
  expect(opening.items).toEqual(permanent);
  const roster = requireAugmentFacts(opening,'combat-roster',opening.round)[0].roster;
  expect(roster.items.filter(i => i.location.kind === 'unit' && i.location.unitId === 'unit-1')).toHaveLength(3);
});
it.each(entries)('B5-79 %s restore preserves opening items and identical continuation', entry => {
  expect(restoreMatch(input(acquired, entry))).toEqual(acquired);
  const restored = restoreMatch(input(opening, entry)); expect(restored).toEqual(opening);
  expect(stepMatch(restored)).toEqual(stepMatch(opening));
});
const attacks: readonly [string, (s: any) => void][] = [
  ['missing history', s => { delete s.augmentHistory; }],
  ['wrong version', s => { s.augmentHistory.version = 'augment-history-v2'; }],
  ['opening donor equipment', s => { s.augmentHistory.facts.find((f: any) => f.kind === 'combat-roster').roster.items[0].definitionId = 'blue-buff'; }],
  ['acquisition roster', s => { s.augmentHistory.facts[0].roster.units[0].starLevel = 3; }],
  ['missing grant', s => { s.combat.units.find((u: any) => u.combatItemGrants?.length).combatItemGrants = []; }],
  ['duplicated grant', s => { const u = s.combat.units.find((u: any) => u.combatItemGrants?.length); u.combatItemGrants.push(structuredClone(u.combatItemGrants[0])); }],
  ['item', s => { s.combat.units.find((u: any) => u.combatItemGrants?.length).combatItemGrants[0].definitionId = 'warmog'; }],
  ['tick', s => { s.combat.units.find((u: any) => u.combatItemGrants?.length).combatItemGrants[0].grantedAtTick = 1; }],
  ['source', s => { s.combat.units.find((u: any) => u.combatItemGrants?.length).combatItemGrants[0].chest.ownerId = 'enemy-r12-1'; }],
  ['ordinal', s => { s.combat.units.find((u: any) => u.combatItemGrants?.length).combatItemGrants[0].ordinal++; }],
  ['compiled item slots', s => { s.combat.strategy.units.find((u: any) => u.unitId === 'unit-1').augmentEquipment.pop(); }],
  ['RNG', s => { s.combat.rngDraws++; }],
];
it.each(attacks)('B5-79 rejects %s at object / JSON / serialized entries', (_label, edit) => {
  for (const entry of entries) { const bad = structuredClone(opening); edit(bad); expect(() => restoreMatch(input(bad,entry)),entry).toThrow(); }
});
it('B5-79 settled and next-round saves round-trip without promoting copied items to permanent equipment', () => {
  const terminal = choices(finish(opening)); expect(restoreMatch(serializeMatch(terminal))).toEqual(terminal);
  expect(terminal.items).toEqual(permanent);
  const next = accepted(nextRound(terminal,terminal.round)); expect(next.combat).toBeNull();
  expect(restoreMatch(JSON.stringify(next))).toEqual(next);
});
