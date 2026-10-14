import { buyXp, equipItem, startMatchCombat, stepMatch, nextRound, combineItems, deployMatchUnit } from '/home/user/cat/src/simulation/match';
import { restoreMatch, serializeMatch } from '/home/user/cat/src/simulation/serialization';
import { generateRoundRolls, initializeStreams } from '/home/user/cat/src/simulation/m8/equipment';
import { TEMPORARY_EQUIPMENT_POOL } from '/home/user/cat/src/simulation/temporary-equipment';
import { publicEquipmentPreparation, finishPublicEquipmentBattle, resolvePublicEquipmentChoices } from '/home/user/cat/tests/fixtures/b8-public-equipment';
const acc = (r: any) => { if (!r.ok) throw new Error(r.reason); return r.state; };
const T: Record<string, number> = {};
const t = <X>(k: string, f: () => X): X => { const s = performance.now(); const x = f(); T[k] = (T[k] ?? 0) + performance.now() - s; return x; };
function equipped(seed: number) {
  let state = t('prep', () => publicEquipmentPreparation(['gloves', 'gloves'], { seed }));
  state = acc(combineItems(state, 'item-1', 'item-2'));
  while (state.roundDefinitionId !== '2-5') {
    state = resolvePublicEquipmentChoices(state);
    if (state.phase === 'preparation') state = t('battle', () => finishPublicEquipmentBattle(state));
    state = resolvePublicEquipmentChoices(state);
    state = t('next', () => acc(nextRound(state, state.round)));
  }
  state = resolvePublicEquipmentChoices(state);
  while (state.level < 6) state = acc(buyXp(state));
  state = acc(deployMatchUnit(state, 'unit-1', { kind: 'board', cell: { col: 1, row: 4 } }));
  return acc(equipItem(state, 'item-3', 'unit-1', 0));
}
const seen = new Set<string>();
const candidates = Array.from({ length: 512 }, (_, seed) => {
  const matchSeed = Math.imul(seed, 2654435761) >>> 0;
  const planned = generateRoundRolls({ equipment: initializeStreams(matchSeed).equipment, rolls: [] } as any,
    [{ parentItemInstanceId: 'item-3', roundId: '2-5', playerLevel: 6 }], TEMPORARY_EQUIPMENT_POOL);
  return { matchSeed, children: planned.rolls[0].children };
});
const start = performance.now(); let routes = 0;
while (seen.size < 43) {
  const add = (c: any) => c.children.filter((x: string) => !seen.has(x)).length;
  const sel = candidates.reduce((b, c) => add(c) > add(b) ? c : b);
  let state = t('equipped', () => equipped(sel.matchSeed)); routes++;
  for (const c of state.temporaryEquipment) seen.add(c.definitionId);
  state = acc(startMatchCombat(state));
  t('restore1', () => restoreMatch(serializeMatch(state)));
  for (let i = 0; i < 3 && state.phase === 'combat'; i++) state = stepMatch(state).state;
  t('restore2', () => { const r = restoreMatch(serializeMatch(state)); stepMatch(r); stepMatch(state); });
}
console.log(routes, (performance.now() - start).toFixed(0), JSON.stringify(Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v.toFixed(0)]))));
