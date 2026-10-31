import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState, type CombatEvent } from '../src/simulation/combat';
import { readCombatStats } from '../src/simulation/combat-s13';
import { validateMechanisms } from '../src/simulation/m8/restore';
import { p3Cast, p3Reflect, settleP3Deaths, validateP3State } from '../src/simulation/s13-p3-combat';
import type { S13Unit } from '../src/simulation/combat-s13-state';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
import { S13_P3_SOURCE } from '../src/simulation/content/s13-p3-source';
import { grantedItemPrograms } from '../src/simulation/m8/combat-item-programs';

function initial(augments: string[] = [], anomaly?: string, item?: string, champion = 'leona', stage = 2): CombatState {
  const base = createMatch(42);
  const round = stage === 2 ? 5 : stage === 3 ? 11 : stage === 4 ? 18 : 25;
  const preparation = { ...base.preparation, units: [champion, 'zoe', 'garen', 'garen'].map((definitionId, i) => ({
    id: i < 2 ? 'p' + i : 'e' + (i - 2), definitionId, starLevel: 1 as const,
    team: i < 2 ? 'player' as const : 'enemy' as const,
    location: { kind: 'board' as const, cell: [{ col: 3, row: 3 }, { col: 0, row: 7 }, { col: 3, row: 2 }, { col: 4, row: 2 }][i] },
  })) };
  const state = { ...base, round, preparation,
    augments: augments.map((definitionId, i) => ({ definitionId, choiceId: 'aug-' + i, acquiredRound: 1 })),
    anomalyBinding: anomaly ? { definitionId: anomaly, choiceId: 'anomaly', unitId: 'p0', boundRound: 1 } : null,
    items: item ? [{ id: 'item-1', definitionId: item, location: { kind: 'unit' as const, unitId: 'p0', slot: 0 } }] : [],
  };
  const started = createCombatWithEvents(preparation, buildStrategySnapshot(state), 'p3-test').state;
  return { ...started, units: started.units.map(u => ({ ...u, cooldownTicks: 2000, moveCooldownTicks: 2000 })) };
}
const unit = (s: CombatState, id = 'p0') => s.units.find(u => u.id === id)!;
function patch(s: CombatState, id: string, values: Partial<CombatState['units'][number]>): CombatState {
  return { ...s, units: s.units.map(u => u.id === id ? { ...u, ...values } : u) };
}
function run(s: CombatState, ticks: number) {
  const events: CombatEvent[] = []; for (let i = 0; i < ticks; i++) { const r = stepCombat(s); s = r.state; events.push(...r.events); }
  return { state: s, events };
}
function attack(s: CombatState, id = 'p0', damage = 100): CombatState {
  return patch(s, id, { cooldownTicks: 0, attackRange: 20, attackDamage: damage, attackDamageBase: damage,
    attackDamagePercentBps: 0, baseCritChanceBps: 0, spellCrit: undefined });
}
function cast(s: CombatState, id = 'p0'): CombatState { return patch(s, id, { mana: unit(s, id).maxMana, attackRange: 20 }); }
const damage = (events: readonly CombatEvent[], id: string) => events.flatMap(e => e.type === 'packetDamage' && e.outcome.context.source.definitionId === id ? [e.outcome] : []);
function validate(s: CombatState) { for (const u of s.units) { validateMechanisms(u, s.units, s.tick, s.combatId!, s.status === 'finished', s.nextActionSeq!); validateP3State(u, s.units, s.tick, s.nextActionSeq!); } }

it('all 14 identities use archived 14.24 zh_cn names and raw coefficients', () => {
  expect(Object.keys(S13_P3_SOURCE)).toHaveLength(14);
  expect(S13_P3_SOURCE['piercing-lotus-ii'].apiName).toBe('TFT_Augment_PiercingLotus2');
  expect(Object.values(S13_P3_SOURCE).map(d => d.name)).toEqual(['硬化护盾', '高压电', '透体莲花 I', '透体莲花 II', '嗜火', '棘刺镀板铠甲', '释放野兽', '终结者', '冰霜触摸', '火球', '龙魂', '绝不浪费', '荆棘满途', '地下拳王']);
});
it('硬化护盾: first 50% crossing grants stage-2 100 shield for 60 ticks; shielded 100 hit becomes 90', () => {
  let s = initial(['defense-call']); s = patch(s, 'p0', { hp: Math.floor(unit(s).maxHp / 2) + 1, armor: 0 });
  const first = stepCombat(attack(s, 'e0', 100)).state;
  expect(unit(first).shield).toBe(100); expect(unit(first).shieldExpiresAtTick).toBe(61);
  const second = stepCombat(attack(first, 'e0', 100));
  const packet = second.events.find(e => e.type === 'packetDamage' && e.outcome.context.targetId === 'p0');
  expect(packet?.type === 'packetDamage' && packet.outcome.mitigated).toBe(90);
  expect(unit(second.state).shield).toBe(10); validate(second.state);
  const third = stepCombat(attack(second.state, 'e0', 100)).state; expect(unit(third).shield).toBe(0);
  expect(unit(stepCombat(attack(third, 'e0', 10)).state).shield).toBe(0);
});
it('高压电: Ionic aura/cast radius is 5, actual 125 spent mana yields raw 250 rather than 200', () => {
  let s = initial(['high-voltage'], undefined, 'ionic-spark');
  s = patch(s, 'e0', { cell: { col: 3, row: 0 } });
  s = patch(s, 'e1', { cell: { col: 6, row: 0 } });
  const r = stepCombat(cast(s, 'e0'));
  expect(damage(r.events, 'ionic-spark')[0].raw).toBe(250);
  expect(unit(r.state, 'e0').mechanismState!.statuses.flatMap(g => g.contributions).find(c => c.application.kind === 'shred')?.application.magnitudeBps).toBe(3000);
  validate(r.state);
});
it.each([['piercing-lotus-i', 3000, 'tristana'], ['piercing-lotus-ii', 4500, 'tristana'], ['piercing-lotus-i', 3000, 'zyra'], ['piercing-lotus-ii', 4500, 'zyra']] as const)('%s: %s crit chance, %s physical/magic critical spell applies both 20% shred/sunder for 60 ticks', (id, chance, champion) => {
  // targeting-p1 (8106acee): e0 and e1 are both adjacent to p0, an equal-distance tie that now draws the combat stream
  // (Tristana's draw picked e1 and consumed the crit word). Lock the fixture's intended ordinary target e0 so the tie
  // draws nothing; P0 keeps an alive, in-range target.
  const s = patch(initial([id], undefined, undefined, champion), 'p0', { targetId: 'e0' }); expect(unit(s).spellCrit!.chanceBps).toBe(chance); expect(unit(s).spellCrit!.enabled).toBe(true);
  // Seed 0's next word is <30%; preserve the compiled authorization and roll through the standard pipeline.
  const r = stepCombat({ ...cast(s), rngState: 0 });
  const hit = r.events.find(e => e.type === 'packetDamage' && e.outcome.context.source.ownerId === 'p0');
  expect(hit?.type === 'packetDamage' && hit.outcome.critical).toBe(true);
  for (const kind of ['sunder', 'shred']) {
    const c = unit(r.state, 'e0').mechanismState!.statuses.find(g => g.kind === kind)!.contributions[0];
    expect(c.application.magnitudeBps).toBe(2000); expect(c.expiresAtTick).toBe(61);
  }
  validate(r.state); expect(stepCombat(JSON.parse(JSON.stringify(r.state)))).toEqual(stepCombat(r.state));
});
it('嗜火: the shared burn on 1240 HP ticks for 18 rather than 12, without boosting Fireball direct DoT', () => {
  const normal = initial([], 'fireball'), pyro = initial(['pyromaniac'], 'fireball');
  const a = run(cast(normal), 21), b = run(cast(pyro), 21);
  expect(damage(a.events, 'fireball').filter(o => o.context.delivery === 'item-burn').map(o => o.raw)).toEqual([12, 12]);
  expect(damage(b.events, 'fireball').filter(o => o.context.delivery === 'item-burn').map(o => o.raw)).toEqual([18, 18]);
  expect(damage(b.events, 'fireball').filter(o => o.context.delivery === 'equipment-proc').map(o => o.raw)).toEqual([14, 14]); validate(b.state);
});
it('棘刺镀板铠甲: stage-2 reflection raw 105, heals 50% actual HP damage; full shield heals zero', () => {
  let s = initial(['thorn-plated-armor'], undefined, 'bramble-vest'); s = patch(s, 'p0', { hp: 300 });
  s = patch(s, 'e0', { magicResist: 0 }); s = patch(s, 'e1', { magicResist: 0 });
  const r = stepCombat(attack(s, 'e0', 100)), reflected = damage(r.events, 'bramble-vest');
  expect(reflected.map(o => o.raw)).toEqual([105, 105]); expect(reflected.map(o => o.hpDamage)).toEqual([105, 105]);
  const heal = r.events.filter(e => e.type === 'heal' && e.outcome.targetId === 'p0'); expect(heal).toHaveLength(2);
  expect(unit(r.state).hp).toBe(300 - Math.floor(Math.floor(100 * 100 / 215) * .92) + 104); validate(r.state);
});
it('释放野兽: Sterak trigger grants +35% AS and 200-tick CC immunity exactly once', () => {
  let s = initial(['unleash-the-beast'], undefined, 'steraks-gage'); s = patch(s, 'p0', { hp: Math.floor(unit(s).maxHp / 2), armor: 0 });
  const r = stepCombat(attack(s, 'e0', 10)), statuses = unit(r.state).mechanismState!.statuses.flatMap(g => g.contributions);
  expect(statuses.find(c => c.application.modifier?.stat === 'attackSpeed')!.application.modifier!.value).toEqual({ kind: 'constant', amount: 3500 });
  expect(statuses.find(c => c.application.kind === 'control-immunity')!.expiresAtTick).toBe(201); validate(r.state);
});
it('终结者: shared Collector execution kills at 185/1240 after hit, strict 186 boundary survives; no gold receipt', () => {
  // targeting-p1 (8106acee): lock p0 on e0; the e0/e1 equal-distance tie would otherwise draw the combat stream.
  let s = patch(initial([], 'the-finisher'), 'p0', { targetId: 'e0' }); s = patch(s, 'e0', { hp: 285, armor: 0 });
  const r = stepCombat(attack(s)); expect(unit(r.state, 'e0').hp).toBe(0); expect(damage(r.events, 'the-finisher').map(o => o.hpDamage)).toEqual([185]);
  expect(r.state.itemGoldReceipts ?? []).toHaveLength(0);
  const boundary = stepCombat(attack(patch(s, 'e0', { hp: 286, armor: 0 }))); expect(unit(boundary.state, 'e0').hp).toBe(186);
});
it('冰霜触摸: spell chills for 80 ticks; chilled enemy death stuns the nearest surviving enemy for 20 ticks', () => {
  // targeting-p1 (8106acee): lock p0 on e0; the e0/e1 equal-distance tie would otherwise draw the combat stream.
  const r = stepCombat(cast(patch(initial([], 'touch-of-frost', undefined, 'tristana'), 'p0', { targetId: 'e0' }))), chilled = unit(r.state, 'e0');
  const c = chilled.mechanismState!.statuses.flatMap(g => g.contributions).find(c => c.application.modifier?.stat === 'attackSpeed')!;
  expect(c.application.modifier!.value).toEqual({ kind: 'constant', amount: -2000 }); expect(c.expiresAtTick).toBe(81);
  expect(readCombatStats(chilled, r.state).attackIntervalTicks).toBeGreaterThan(readCombatStats(unit(initial(), 'e0'), initial()).attackIntervalTicks);
  const killed = stepCombat(attack(patch(r.state, 'e0', { hp: 1, armor: 0 })));
  const stun = unit(killed.state, 'e1').mechanismState!.statuses.find(g => g.kind === 'stun')!.contributions[0];
  expect(stun.expiresAtTick! - stun.appliedAtTick).toBe(20); validate(killed.state);
});
it('火球: 70 actual mana launches radius-2 burn and 5 pulses total 74 per target true damage; 69 carries forward, 140 emits twice', () => {
  const s = initial([], 'fireball'), full = run(cast(s), 101);
  const direct = damage(full.events, 'fireball').filter(o => o.context.delivery === 'equipment-proc');
  expect(direct.map(o => o.raw)).toEqual([14,14,15,15,15,15,15,15,15,15]);
  expect(direct.reduce((n, o) => n + o.hpDamage, 0)).toBe(148); validate(full.state);
  const units = structuredClone(s.units) as S13Unit[], u = units.find(u => u.id === 'p0')!;
  const ctx: AbilityContext = { tick: 1, combatId: s.combatId, board: s.board, units, packets: [], heals: [], events: [], draw: () => 0 };
  p3Cast(ctx, u, units.find(u => u.id === 'e0')!, 0, 69); expect(u.s13P3!.fireballs).toHaveLength(0);
  p3Cast(ctx, u, units.find(u => u.id === 'e0')!, 1, 71); expect(u.s13P3!.fireballs).toHaveLength(4); expect(u.s13P3!.manaRemainder).toBe(0);
  const resumed = run(JSON.parse(JSON.stringify(run(cast(s), 21).state)), 80); expect(resumed.state).toEqual(full.state);
});
it('龙魂: first attack on each target adds 20% target max HP true damage, returning to an old target adds zero', () => {
  // targeting-p1 (8106acee): lock p0 on e0; the e0/e1 equal-distance tie would otherwise draw the combat stream.
  let s = patch(initial([], 'dragonsoul'), 'p0', { targetId: 'e0' }); const first = stepCombat(attack(s));
  expect(unit(first.state).targetId).toBe('e0'); expect(damage(first.events, 'dragonsoul').map(o => o.hpDamage)).toEqual([248]);
  const repeat = stepCombat(attack(first.state)); expect(damage(repeat.events, 'dragonsoul')).toHaveLength(0);
  // targeting P0 (d6a75a4e, 28fd974a): an alive, targetable, in-range target is kept, and attack() gives range 20, so moving
  // e0 away no longer retargets p0 (v25 rescanned to the nearer e1). Move e0 away and hand p0 the new target e1 directly.
  s = patch(repeat.state, 'e0', { cell: { col: 6, row: 0 } }); const other = stepCombat(patch(attack(s), 'p0', { targetId: 'e1' }));
  expect(unit(other.state).targetId).toBe('e1');
  expect(damage(other.events, 'dragonsoul').map(o => o.hpDamage)).toEqual([248]); validate(other.state);
});
it('绝不浪费: freeze a dying ally at 50 mana before cleanup, grant 35; simultaneously dying holder receives nothing', () => {
  let s = initial([], 'nothing-wasted'); s = patch(s, 'p0', { mana: 0 }); s = patch(s, 'p1', { hp: 1, mana: 50, armor: 0 });
  s = patch(s, 'e0', { cell: { col: 0, row: 6 } }); const r = stepCombat(attack(s, 'e0', 100));
  expect(unit(r.state, 'p1').mana).toBe(0); expect(unit(r.state).mana).toBe(35);
  const receipts = r.events.flatMap(e => e.type === 'manaChanged' && 'outcome' in e && e.outcome.source.definitionId === 'nothing-wasted' ? [e.outcome] : []);
  expect(receipts.map(r => r.amount)).toEqual([35]);
});
it('硬化护盾 uses strict below-50% and grants nothing at exactly 50%',()=>{
  let s=initial(['defense-call']);s=patch(s,'p0',{hp:unit(s).maxHp/2+10,armor:0});
  const boundary=stepCombat(attack(s,'e0',10)).state;expect(unit(boundary).shield).toBe(0);
  expect(unit(stepCombat(attack(boundary,'e0',1)).state).shield).toBe(100);
});
it('combat-granted ordinary items use the same P3 programs and stage, without cross-holder cache contamination',()=>{
  const source={ownerId:'chest',sourceKind:'item' as const,definitionId:'TFT_Item_UnstableTreasureChest',instanceId:'chest-1',effectIndex:1024,parentItemInstanceId:null};
  const grants=['ionic-spark','bramble-vest','steraks-gage'].map((definitionId,ordinal)=>({chest:source,definitionId,ordinal,grantedAtTick:10}));
  const boosted=unit(initial(['high-voltage','thorn-plated-armor','unleash-the-beast'],undefined,undefined,'leona',4));
  const programs=grantedItemPrograms({...boosted,combatItemGrants:grants});
  expect(programs[0].program.triggers![0].listener.withinHexes).toBe(5);
  const thorn=programs[1].program.triggers![0].effects[0];expect(thorn.kind==='damage'&&thorn.amount.flat).toBe(170);
  const sterak=programs[2].program.survival![0].effects;expect(sterak.some(e=>e.kind==='modify-stat'&&e.modifier.stat==='attackSpeed'&&e.modifier.value.kind==='constant'&&e.modifier.value.amount===3500)).toBe(true);
  const plain=grantedItemPrograms({id:boosted.id,combatItemGrants:grants});expect(plain[0].program.triggers![0].listener.withinHexes).toBe(2);
  const normalThorn=plain[1].program.triggers![0].effects[0];expect(normalThorn.kind==='damage'&&normalThorn.amount.flat).toBe(100);
});
it.each([[2,100],[3,150],[4,200],[5,225]] as const)('硬化护盾 stage %i preserves the raw shield ladder %i', (stage, expected) => {
  let s = initial(['defense-call'], undefined, undefined, 'leona', stage);
  s = patch(s, 'p0', { hp: Math.floor(unit(s).maxHp / 2), armor: 0 });
  expect(unit(stepCombat(attack(s, 'e0', 1)).state).shield).toBe(expected);
});
it.each([[2,105],[3,130],[4,170],[5,200]] as const)('棘刺镀板铠甲 stage %i preserves the raw reflection ladder %i', (stage, expected) => {
  const s = initial(['thorn-plated-armor'], undefined, 'bramble-vest', 'leona', stage);
  expect(damage(stepCombat(attack(s, 'e0')).events, 'bramble-vest').map(o => o.raw)).toEqual([expected,expected]);
});
it('荆棘满途: the shielded 45 points do not enter the 55-point mitigated basis; reflection cannot reflect reflection', () => {
  let s = initial(['defense-call'], 'thornskin'); s = patch(s, 'p0', { hp: Math.floor(unit(s).maxHp * .4), armor: 100 });
  const first = stepCombat(attack(s, 'e0')).state, r = stepCombat(attack(first, 'e0'));
  expect(unit(r.state).hp).toBe(unit(first).hp); expect(unit(first).shield-unit(r.state).shield).toBe(45);
  expect(damage(r.events, 'thornskin').map(o=>o.raw)).toEqual([11,11]); validate(r.state);
  const units=structuredClone(s.units) as S13Unit[], target=units.find(u=>u.id==='p0')!;
  const ctx:AbilityContext={tick:1,combatId:s.combatId,board:s.board,units,packets:[],events:[],heals:[],draw:()=>0};
  for(const id of ['bramble-vest','thornskin','TFT5_Item_BrambleVestRadiant'])p3Reflect(ctx,target,{source:{ownerId:'e0',sourceKind:'item',definitionId:id,instanceId:'reflection',effectIndex:0},targetId:'p0',raw:100,damageType:'magic',actionSeq:0,ordinal:0,delivery:'equipment-proc',critEligibility:'never',area:true,triggeringCastActionSeq:null},50);
  expect(ctx.packets).toHaveLength(0);
});
it('绝不浪费: simultaneous deaths freeze all donor mana once; a dead recipient receives no mana',()=>{
  const s=initial([],'nothing-wasted'), units=structuredClone(s.units) as S13Unit[], holder=units.find(u=>u.id==='p0')!, donor=units.find(u=>u.id==='p1')!;
  holder.hp=0;holder.mana=0;donor.hp=0;donor.mana=50;
  const ctx:AbilityContext={tick:1,combatId:s.combatId,board:s.board,units,packets:[],events:[],heals:[],draw:()=>0};
  settleP3Deaths(ctx,[holder,donor]);expect(holder.mana).toBe(0);expect(ctx.events).toHaveLength(0);
});
it('火球/地下拳王/龙魂: JSON continuation is deterministic and malformed or missing runtime records reject',()=>{
  for(const id of ['fireball','knockout','dragonsoul']){
    const s=initial([],id), started=stepCombat(id==='dragonsoul'?attack(s):cast(s)).state;
    expect(stepCombat(JSON.parse(JSON.stringify(started)))).toEqual(stepCombat(started));validate(started);
    const missing={...unit(started),s13P3:undefined};expect(()=>validateP3State(missing,started.units,started.tick,started.nextActionSeq!)).toThrow();
    const invalid={...unit(started),s13P3:{...unit(started).s13P3!,manaRemainder:70}};expect(()=>validateP3State(invalid,started.units,started.tick,started.nextActionSeq!)).toThrow();
  }
});
// 项目约定 tests remain last: they fix the missing script semantics without changing raw coefficients.
it('荆棘满途 项目约定: +60/+60, 100 physical into 100 armor blocks 50 and reflects 10; shield absorption adds zero', () => {
  let s = initial([], 'thornskin'); expect(unit(s).armor).toBe(110); expect(unit(s).magicResist).toBe(110);
  s = patch(s, 'p0', { armor: 100 }); s = patch(s, 'e0', { magicResist: 0 }); s = patch(s, 'e1', { magicResist: 0 });
  const r = stepCombat(attack(s, 'e0', 100)); expect(damage(r.events, 'thornskin').map(o => o.hpDamage)).toEqual([10, 10]);
  validate(r.state);
});
it('地下拳王 项目约定: +15% AD; charged attack replaces 100 raw with 90 true, 35% bonus crit before common x1.4; then resets', () => {
  let s = initial([], 'knockout'); expect(unit(s).attackDamagePercentBps).toBe(1500);
  s = run(cast(s), 1).state; s = attack(s); s = patch(s, 'p0', { baseCritChanceBps: 6500, spellCrit: undefined });
  const r = stepCombat(s), p = r.events.find(e => e.type === 'packetDamage' && e.outcome.context.delivery === 'basic-attack');
  expect(p?.type === 'packetDamage' && [p.outcome.raw, p.outcome.context.damageType, p.outcome.hpDamage]).toEqual([90, 'true', 126]);
  expect(unit(r.state).s13P3!.charged).toBe(false);
  const next = stepCombat(attack(r.state)); const ordinary = next.events.find(e => e.type === 'packetDamage' && e.outcome.context.delivery === 'basic-attack');
  expect(ordinary?.type === 'packetDamage' && ordinary.outcome.context.damageType).toBe('physical'); validate(next.state);
});
