import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { S13_P3_SOURCE } from '../src/simulation/content/s13-p3-source';
import { P3_AUGMENT_ITEMS } from '../src/simulation/content/s13-p3';
import { selectChoice, startMatchCombat, stepMatch, selectAnomalyTarget, rerollAnomaly, deployMatchUnit, sellUnit, nextRound } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { firstNodeSeed } from './augment-stage-helpers';
import { accepted, reachRound } from './match-helpers';
import { openingEncounterId } from '../src/simulation/opening-encounter';
import * as matchApi from '../src/simulation/match';
// Prefer combat-only augments; every offer and all paid rerolls remain natural.
const combatAugments = ['pumping-up-iii','bulky-buddies-iii','pumping-up-ii','bulky-buddies-ii','manaflow-ii','pumping-up-i','bulky-buddies-i','manaflow-i'];
const anomalyPrefixes = new Map<number, Promise<ReturnType<typeof matchApi.createMatch>>>();
function publicAnomalyPrefix(seed = 42) {
  const cached = anomalyPrefixes.get(seed);
  if (cached) return cached;
  const prefixPromise = (async () => {
    let prefix: ReturnType<typeof matchApi.createMatch> | undefined;
    const stop = new Error('Captured public 4-5 preparation prefix');
    try {
      await createRequire(import.meta.url)('../scripts/generate-m5-route.cjs').run(matchApi, { build: 'sniper', seed, augmentPriorities: combatAugments,
        onStep(_before: unknown, result: {state: ReturnType<typeof matchApi.createMatch>}) {
          if(result.state.roundDefinitionId==='4-5'&&result.state.phase==='preparation') {prefix=result.state;throw stop;}
        } });
    } catch(error) { if(error!==stop)throw error; }
    if(!prefix)throw new Error('No public anomaly prefix');return prefix;
  })();
  anomalyPrefixes.set(seed, prefixPromise);
  return prefixPromise;
}
// Re-pinned from seed 42: v26 D5 offers/stage bans (7953c99a) moved seed 42's sniper route onto snipers-nest and
// rebel-resurgence (AUGMENT_HISTORY_OWNERS), so every strict restore replayed the whole game (~25 s). Seed 48's route
// (pumping-up-ii, item-collector-i, sentinel-crest) holds no history owner.
const publicPrefix = await publicAnomalyPrefix(48);
// Seed 40 reaches dragonsoul/nothing-wasted within 100 paid rerolls without
// seed 44's unrelated Scoreboard Scrapper command-history replay.
const nothingWastedPrefix = await publicAnomalyPrefix(40);

it('independently checks every new coefficient and Chinese label against compressed raw, with no archive writes', () => {
  const raw = (name: string) => JSON.parse(gunzipSync(readFileSync(new URL('../src/simulation/content/source/s13-14.24b/raw/' + name + '.gz', import.meta.url))).toString());
  const en = raw('en_us.json'), map = raw('map22.bin.json'), zh = raw('zh_cn.tft.stringtable.json').entries;
  for (const d of Object.values(S13_P3_SOURCE)) {
    if (d.kind === 'augment') {
      const source = en.items.find((i: { apiName: string }) => i.apiName === d.apiName);
      expect(Object.fromEntries(Object.entries(source.effects).map(([k, v]) => [k, Math.round(Number(v) * 1000000) / 1000000]))).toEqual(d.values);
    } else {
      const source = map[d.pointer]; expect(source.name).toBe(d.apiName);
      expect(Object.fromEntries(source.effectAmounts.map((e: { name: string; value: number }) => [e.name, Math.round(e.value * 1000000) / 1000000]))).toEqual(d.values);
      expect(zh[map[source['{900aff58}']].TitleTra.toLowerCase()]).toBe(d.name);
    }
    expect(Object.values(zh)).toContain(d.name);
  }
  // 临时、用户 10-20 批准：只因 CI 机器计时贴着上限（断言都过），本用例 5 秒 → 10 秒（本机满负载约 3.3 秒）；断言不变。
}, 10_000);
it.each(Object.entries(P3_AUGMENT_ITEMS))('%s grants exactly one %s using the existing schedule transaction; forged/missing births reject', (id, item) => {
  let seed = firstNodeSeed(id, 300);
  // Search cheap draws and replay only the selected route; keep the same bounded non-Trainer-Golem predicate.
  while (seed < 300 && openingEncounterId(matchApi.createMatch(seed)) === 'trainer-golems') seed = firstNodeSeed(id, 300 - seed - 1, seed + 1);
  expect(seed).toBeLessThan(300);
  const before = reachRound('2-1', false, seed), c = before.pendingChoice!;
  expect(c.offers).toContain(id);
  const after = accepted(selectChoice(before, c.choiceId, c.generation, id));
  const receipt = after.scheduleReceipts.find(r => r.eventId === c.eventId)!;
  expect(receipt.itemIds).toEqual(['item-' + before.nextItemSerial]);
  expect(after.nextItemSerial).toBe(before.nextItemSerial + 1);
  expect(after.items.find(i => i.id === receipt.itemIds[0])?.definitionId).toBe(item);
  expect(after.items.find(i => i.id === receipt.itemIds[0])?.location.kind).toBe('inventory');
  expect(after.resourceProvenance.entries.at(-1)).toMatchObject({ kind: 'item-acquired', itemId: receipt.itemIds[0], source: { kind: 'schedule', eventId: c.eventId } });
  expect(restoreMatch(serializeMatch(after))).toEqual(after);
  const retry = selectChoice(after, c.choiceId, c.generation, id); expect(retry.ok).toBe(false); expect(retry.state).toBe(after);
  for (const mutation of [
    (s: typeof after) => ({ ...s, items: s.items.filter(i => i.id !== receipt.itemIds[0]) }),
    (s: typeof after) => ({ ...s, items: s.items.map(i => i.id === receipt.itemIds[0] ? { ...i, definitionId: 'sword' } : i) }),
    (s: typeof after) => ({ ...s, scheduleReceipts: s.scheduleReceipts.map(r => r.eventId === c.eventId ? { ...r, itemIds: [] } : r) }),
  ]) expect(() => restoreMatch(serializeMatch(mutation(after)))).toThrow();
  const combat = accepted(startMatchCombat(after)); expect(restoreMatch(serializeMatch(combat))).toEqual(combat);
  const next = stepMatch(combat).state; expect(restoreMatch(serializeMatch(next))).toEqual(next);
});
it.each(['the-finisher','touch-of-frost','fireball','dragonsoul','nothing-wasted','thornskin','knockout'])('%s is publicly selectable and strictly restores after entering and advancing combat',id=>{
  let s=id==='nothing-wasted'||id==='dragonsoul'?nothingWastedPrefix:publicPrefix;
  const target=s.preparation.units.find(u=>u.team==='player')!;
  // Pay for rerolls with real sales from the acquired army, retaining the bound target.
  for(const other of s.preparation.units.filter(u=>u.team==='player'&&u.id!==target.id))s=accepted(sellUnit(s,other.id));
  s=accepted(startMatchCombat(s));
  for(let tick=0;tick<1201&&s.phase==='combat';tick++)s=stepMatch(s).state;
  s=accepted(nextRound(s,s.round));
  let c=s.pendingChoice!;
  s=accepted(selectAnomalyTarget(s,c.choiceId,c.generation,target.id));
  let rolls=0;
  while(!s.pendingChoice!.offers.includes(id)&&rolls<100){c=s.pendingChoice!;s=accepted(rerollAnomaly(s,c.choiceId,c.generation));rolls++;}
  expect(rolls).toBeLessThan(100);c=s.pendingChoice!;s=accepted(selectChoice(s,c.choiceId,c.generation,id));
  expect(restoreMatch(serializeMatch(s))).toEqual(s);
  if(target.location.kind!=='board') {
    const occupied=new Set(s.preparation.units.flatMap(u=>u.location.kind==='board'?[u.location.cell.col+':'+u.location.cell.row]:[]));
    const cell=Array.from({length:7},(_,col)=>({col,row:4})).find(c=>!occupied.has(c.col+':'+c.row))!;
    s=accepted(deployMatchUnit(s,target.id,{kind:'board',cell}));
  }
  s=accepted(startMatchCombat(s));expect(restoreMatch(serializeMatch(s))).toEqual(s);
  for(let tick=0;tick<100&&s.phase==='combat';tick++)s=stepMatch(s).state;
  expect(restoreMatch(serializeMatch(s))).toEqual(s);
});
