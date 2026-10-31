import { beforeAll, afterAll, expect, it } from 'vitest';
import { createMatch, buyUnit, combineItems, equipItem, startMatchCombat, stepMatch, nextRound, rerollAugment, selectChoice, type MatchState } from '../src/simulation/match';
import { accepted, fieldBench, finish, resolveM5Choices } from './match-helpers';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { installB1Offers } from './fixtures/b1-scripted-offers';
import { requireAugmentFacts } from '../src/simulation/augment-history';

// Seed 5: installB1Offers scripts 2-1 heroic-grab-bag and 3-2 sponging; part of the donor gear comes from that grab-bag chain, not pure PvE orbs alone.
// v26 PvE loot carryover/14.24 neutrals (8f794062, 568eeea4): seed 5's lost PvE rounds now carry a drop past 3-2, so it holds
// five components and item-5/item-6 no longer combine (v25 made archangel/shojin/sunfire-cape). Re-searched seeds 0..79 on
// the same route: seed 29 is the first whose item-1..6 form three completed items; their definitions are read from the
// combines and asserted exactly below.
let route = createMatch(29), acquired: MatchState, opening: MatchState, permanent: MatchState['items'], completed: string[];
let restoreSpongingOffers: () => void;
const priorities = ['item-grab-bag-i','big-grab-bag','heroic-grab-bag','iron-assets'];
beforeAll(() => {
  // Wrapper scripts only the three-card draws (2-1 heroic-grab-bag chain + 3-2 sponging); real candidate pools unchanged.
  restoreSpongingOffers = installB1Offers([...priorities, 'sponging']);
});
afterAll(() => { restoreSpongingOffers(); });
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
  for(let slot=0;slot<3&&!route.pendingChoice!.offers.includes('sponging');slot++){const c=route.pendingChoice!;route=accepted(rerollAugment(route,c.choiceId,c.generation,slot));}
  expect(route.roundDefinitionId).toBe('3-2'); expect(route.pendingChoice!.offers).toContain('sponging');
  // Exercise recovery of an ordinary checkpoint BEFORE acquiring history ownership.
  route = restoreMatch(JSON.stringify(route));
  const c = route.pendingChoice!;
  acquired = accepted(selectChoice(route, c.choiceId, c.generation, 'sponging'));
  let s = acquired;
  const donor = s.preparation.units.find(u => u.id === 'unit-1')!;
  const components = new Set(s.items.map(i => i.id));
  for (const [a,b] of [['item-1','item-2'], ['item-3','item-4'], ['item-5','item-6']]) s = accepted(combineItems(s,a,b));
  const ids = s.items.filter(i => !components.has(i.id));
  expect(ids).toHaveLength(3);
  completed = ids.map(i => i.definitionId);
  expect(new Set(completed).size).toBe(3);
  expect(completed).not.toContain('warmog');
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
    expect(completed).toContain(u.combatItemGrants![0].definitionId);
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
