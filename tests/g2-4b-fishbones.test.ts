import { expect, it } from 'vitest';
import { createMatch, equipItem, deployMatchUnit, startMatchCombat, stepMatch } from '../src/simulation/match';
import { grantMechanicItem } from '../src/simulation/seat-mechanics';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { range, EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { chooseFishbonesTarget } from '../src/simulation/g2-4b-item-kernel';
import type { MatchState } from '../src/simulation/match-types';
import raw from '../src/simulation/content/source/s13-14.24b/normalized/g2-4b-mechanism-items.json';
import { stepCombat, type CombatState } from '../src/simulation/combat';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

const id = 'TFT_Item_Artifact_Fishbones';
function accepted<T extends {ok: boolean}>(result: T): Extract<T, {ok: true}> {
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result as Extract<T, {ok: true}>;
}
function start(): MatchState {
  let state = createMatch(42);
  state = accepted(grantMechanicItem(state, {receiptId:'fish-test',source:'test',definitionId:id})).state;
  const owner = state.preparation.units.find(u=>u.team==='player')!;
  if (owner.location.kind !== 'board') state = accepted(deployMatchUnit(state,owner.id,{kind:'board',cell:{col:3,row:6}})).state;
  state = accepted(equipItem(state,state.items.at(-1)!.id,owner.id,0)).state;
  return accepted(startMatchCombat(state)).state;
}

it('registers only the exact source stats and doubles the effective range', () => {
  const source = raw.items.find(i=>i.apiName===id)!;
  expect(ITEM_DEFINITIONS[id].effects.slice(0,2)).toEqual([
    {kind:'statPercentBps',stat:'attackDamage',bps:Math.round(source.values.AD!*10000)},
    {kind:'attackSpeedBps',bps:source.values.AS!*100},
  ]);
  const state = start(), unit = state.combat!.units.find(u=>u.team==='player')!;
  expect(range({...unit,runtime:{...EMPTY_RUNTIME},statuses:[],shieldLayers:[],tasks:[]})).toBe(unit.attackRange*2);
  expect(state.combat!.itemRandomStreams!.fishbones.draws).toBe(0);
});

it('resumes the actual Match battle exactly and rejects forged or omitted random state', () => {
  let state = start();
  for (let n=0;n<100 && state.phase==='combat';n++) state=stepMatch(state).state;
  expect(state.combat!.itemRandomStreams!.fishbones.draws).toBeGreaterThan(0);
  const restored = restoreMatch(serializeMatch(state));
  expect(restored).toEqual(state);
  expect(stepMatch(restored)).toEqual(stepMatch(state));
  const missing = structuredClone(state); delete (missing.combat as {itemRandomStreams?:unknown}).itemRandomStreams;
  expect(()=>restoreMatch(missing)).toThrow();
  const forged = structuredClone(state);
  Object.assign(forged.combat!.itemRandomStreams!.fishbones,{state:0});
  expect(()=>restoreMatch(forged)).toThrow();
});

it('attack choices consume only the item stream and preserve explicit replay state', () => {
  let state = start();
  for(let n=0;n<100 && state.phase==='combat';n++) {
    const before = state.combat!, stepped = stepMatch(state), after = stepped.state.combat!;
    const holder = before.units.find(u=>u.mechanics?.some(m=>m.mechanic==='g24Fishbones'))!;
    const attacks = stepped.events.filter(e=>e.type==='attack'&&e.attackerId===holder.id);
    expect(after.itemRandomStreams!.fishbones.draws-before.itemRandomStreams!.fishbones.draws).toBe(attacks.length);
    if(attacks.length) {
      const enemies=after.units.filter(u=>u.team!==holder.team).map(u=>u.id);
      // Initial neutral encounter has one target: a mandatory draw is still consumed.
      if(enemies.length===1) expect(attacks[0]).toMatchObject({targetId:chooseFishbonesTarget(before.itemRandomStreams!,enemies).targetId});
    }
    state=stepped.state;
  }
});

it('randomizes real attacks across multiple enemies without depending on array order', () => {
  const initial = start().combat!;
  const holder = initial.units.find(u=>u.team==='player')!;
  const foe = initial.units.find(u=>u.team==='enemy')!;
  const enemies = [{col:2,row:3},{col:3,row:3},{col:4,row:3}].map((cell,i)=>({
    ...foe,id:`target-${i}`,cell,hp:100000,maxHp:100000,cooldownTicks:1200,moveCooldownTicks:1200,
  }));
  let state: CombatState = {...initial,units:[{...holder,cell:{col:3,row:4},maxMana:100000,mana:0},...enemies]};
  const selected: string[] = [];
  for(let n=0;n<100;n++) {
    const next = stepCombat(state);
    expect(stepCombat({...state,units:[...state.units].reverse()})).toEqual(next);
    for(const event of next.events) if(event.type==='attack'&&event.attackerId===holder.id) selected.push(event.targetId);
    state=next.state;
  }
  expect(new Set(selected).size).toBeGreaterThan(1);
  expect(state.itemRandomStreams!.fishbones.draws).toBe(selected.length);
  expect(state.rngDraws).toBe(selected.length);
});
