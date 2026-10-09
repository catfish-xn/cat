# B6 旧断言逐项迁移账本
比较基线：`7c24d513c627d34ece6ff355c44077fc5c621e1a`。以下按实际diff hunk逐项保留旧/新断言原文及原因；输入夹具变化也列明。新B6独立用例不作为“旧断言更新”统计。后续如再改测试会刷新本账本。
## 数值来源与不可放宽项

- 初始：10G→0G，3级→1级，三英雄→刀妹1个，next serial 4→2，choice→preparation；来源OPENING §2。
- 首次让阵：HP95→97，gold16→2，等级3/XP2→等级2/XP0；手算0+2、100−3、1级0XP+2升2级。
- 首场带10G的纯命令fixture：原旧PvP+6G→当前1-2+2G；不计算阶段1利息。该fixture绝不作为起手资源证据。
- 正常2-1跨级fixture：前三次让阵HP100−9=91，2-1再失利−5=86；10G买XP−4，结算+5=11G；3级4XP+2→4级0XP。
- 2-2人口fixture：2-1自然XP后3级2XP，买一次4XP→4级0XP；不同于旧新局两次F的4级2XP。
- 突发6次F：新1级起24XP，前四次升级共2+2+6+10=20，余4XP；旧3级起24XP余8XP。12次购卡从serial2起变14，旧从4起为16。12次D+6次F成本24+24=48，200−48=152不变。
- 38推进轮、33战、5补给、8PvE来自批准目录；原2+阶段仍35轮，不替换该35。
- 日程可执行组件选择11→5、随机组件4→0，因移除起手包与归B8的x-7；完整公开路线15组件、成型、胜利门禁保留。
- 任何历史/终点的索引变化均按roundId查目录。B9应用30容量不改，不能把领域33战fixture当应用验收。
- Golden仅新版本轨迹记录。pre-m8-b6字节保留；更新器不改变胜利/15组件/完整成型门禁。

## A001 · tests/m4-review-regressions.test.ts · @@ -70 +71 @@ describe('review regressions: runtime commands and safe restore', () => {
旧值/旧输入：
```ts
    const duplicate = mutable(ready());
```
新值/新输入：
```ts
    const duplicate = mutable(reachRound('2-4')); 
```
理由：收据破坏测试取真实2-4供给收据，保留重复ID与999虚构金币拒绝；其余冻结数值不改。

## A002 · tests/m4-review-regressions.test.ts · @@ -73 +74 @@ describe('review regressions: runtime commands and safe restore', () => {
旧值/旧输入：
```ts
    const wrongGold = mutable(ready());
```
新值/新输入：
```ts
    const wrongGold = mutable(reachRound('2-4'));
```
理由：收据破坏测试取真实2-4供给收据，保留重复ID与999虚构金币拒绝；其余冻结数值不改。

## A003 · tests/m5-acceptance.test.ts · @@ -23,2 +23,2 @@ describe('M5 independent frozen numerical acceptance answers',()=>{
旧值/旧输入：
```ts
  for(const seed of [0,1,42,0xffffffff])for(let level=3;level<=9;level++)expect(generateShop(seed,7,level)).toEqual(shop(seed,7,level));
  expect(createMatch(42).shop).toEqual(shop(42,1,3).shop);
```
新值/新输入：
```ts
  for(const seed of [0,1,42,0xffffffff])for(let level=1;level<=9;level++)expect(generateShop(seed,7,level)).toEqual(shop(seed,7,level));
  expect(createMatch(42).shop).toEqual(shop(42,1,1).shop);
```
理由：OPENING §4：初始商店等级1。独立手写oracle增加1/2级100%一费；旧3–9级向量不删。

## A004 · tests/m5-audit-boundaries.test.ts · @@ -4 +5 @@ import { restoreMatch } from '../src/simulation/serialization';
旧值/旧输入：
```ts
import { accepted, readyMatch, finish } from './match-helpers';
```
新值/新输入：
```ts
import { accepted, purchasedThreeHeroMatch, finish } from './match-helpers';
```
理由：4-5/4-6按目录定位，真实路线依赖只挂载到使用它的describe。动态校验使用公开购买的Lux，不让不存在的unit导致假拒绝；原Anomaly数值和拒绝要求保留。

## A005 · tests/m5-audit-boundaries.test.ts · @@ -13,2 +16,2 @@ beforeAll(async () => {
旧值/旧输入：
```ts
  before19 = (route.actions.find((a: any) => a.round === 19 && a.command.type === 'start') as any).before;
  anomaly = (route.actions.find((a: any) => a.round === 20 && a.command.type === 'target') as any).before;
```
新值/新输入：
```ts
  before19 = (route.actions.find((a: any) => a.round === getCatalogRoundById('4-5').ordinal && a.command.type === 'start') as any).before;
  anomaly = (route.actions.find((a: any) => a.round === getCatalogRoundById('4-6').ordinal && a.command.type === 'target') as any).before;
```
理由：4-5/4-6按目录定位，真实路线依赖只挂载到使用它的describe。动态校验使用公开购买的Lux，不让不存在的unit导致假拒绝；原Anomaly数值和拒绝要求保留。

## A006 · tests/m5-audit-boundaries.test.ts · @@ -17 +19,0 @@ beforeAll(async () => {
旧值/旧输入：
```ts
describe('M5 audit: normal empty-roster recovery and full-range anomaly sampling', () => {
```
新值/新输入：
```ts
(此处移动到下述明确作用域，见相邻迁移项)
```
理由：4-5/4-6按目录定位，真实路线依赖只挂载到使用它的describe。动态校验使用公开购买的Lux，不让不存在的unit导致假拒绝；原Anomaly数值和拒绝要求保留。

## A007 · tests/m5-audit-boundaries.test.ts · @@ -30 +32 @@ describe('M5 audit: normal empty-roster recovery and full-range anomaly sampling
旧值/旧输入：
```ts
    s = accepted(api.nextRound(s, 19));
```
新值/新输入：
```ts
    s = accepted(api.nextRound(s, getCatalogRoundById('4-5').ordinal));
```
理由：4-5/4-6按目录定位，真实路线依赖只挂载到使用它的describe。动态校验使用公开购买的Lux，不让不存在的unit导致假拒绝；原Anomaly数值和拒绝要求保留。

## A008 · tests/m5-audit-boundaries.test.ts · @@ -45 +47 @@ describe('M5 audit: normal empty-roster recovery and full-range anomaly sampling
旧值/旧输入：
```ts
    expect(api.nextRound(s, 19).state).toBe(s); expect(restoreMatch(s)).toEqual(s);
```
新值/新输入：
```ts
    expect(api.nextRound(s, getCatalogRoundById('4-5').ordinal).state).toBe(s); expect(restoreMatch(s)).toEqual(s);
```
理由：4-5/4-6按目录定位，真实路线依赖只挂载到使用它的describe。动态校验使用公开购买的Lux，不让不存在的unit导致假拒绝；原Anomaly数值和拒绝要求保留。

## A009 · tests/m5-audit-boundaries.test.ts · @@ -62 +64 @@ describe('M5 audit: normal empty-roster recovery and full-range anomaly sampling
旧值/旧输入：
```ts
    s = accepted(api.nextRound(finish(accepted(api.startMatchCombat(s))), 19));
```
新值/新输入：
```ts
    s = accepted(api.nextRound(finish(accepted(api.startMatchCombat(s))), getCatalogRoundById('4-5').ordinal));
```
理由：4-5/4-6按目录定位，真实路线依赖只挂载到使用它的describe。动态校验使用公开购买的Lux，不让不存在的unit导致假拒绝；原Anomaly数值和拒绝要求保留。

## A010 · tests/m5-audit-boundaries.test.ts · @@ -91 +93 @@ describe('M5 audit: dynamic restore and truthful strategy descriptions', () => {
旧值/旧输入：
```ts
    const state = accepted(api.startMatchCombat(readyMatch())), invalid = structuredClone(state);
```
新值/新输入：
```ts
    const state = accepted(api.startMatchCombat(purchasedThreeHeroMatch())), invalid = structuredClone(state);
```
理由：4-5/4-6按目录定位，真实路线依赖只挂载到使用它的describe。动态校验使用公开购买的Lux，不让不存在的unit导致假拒绝；原Anomaly数值和拒绝要求保留。

## A011 · tests/m5-audit-boundaries.test.ts · @@ -98 +100 @@ describe('M5 audit: dynamic restore and truthful strategy descriptions', () => {
旧值/旧输入：
```ts
    const state = accepted(api.startMatchCombat(readyMatch())), invalid = structuredClone(state);
```
新值/新输入：
```ts
    const state = accepted(api.startMatchCombat(purchasedThreeHeroMatch())), invalid = structuredClone(state);
```
理由：4-5/4-6按目录定位，真实路线依赖只挂载到使用它的describe。动态校验使用公开购买的Lux，不让不存在的unit导致假拒绝；原Anomaly数值和拒绝要求保留。

## A012 · tests/m5-command-phases.test.ts · @@ -3 +3 @@ import * as api from '../src/simulation/match';
旧值/旧输入：
```ts
import {accepted,readyMatch,finish,emptyBoard} from './match-helpers';
```
新值/新输入：
```ts
import {accepted,reachRound,readyMatch,finish,emptyBoard} from './match-helpers';
```
理由：选择态不再是新局，fixture真实推进到2-1；四类命令阶段禁用断言完整保留。

## A013 · tests/m5-command-phases.test.ts · @@ -7 +7 @@ beforeAll(()=>{
旧值/旧输入：
```ts
 states.choice=api.createMatch();states.preparation=readyMatch();
```
新值/新输入：
```ts
 states.choice=reachRound('2-1',false);states.preparation=readyMatch();
```
理由：选择态不再是新局，fixture真实推进到2-1；四类命令阶段禁用断言完整保留。

## A014 · tests/m5-content.test.ts · @@ -85,5 +87,6 @@ describe('M5 finite campaign content',()=>{
旧值/旧输入：
```ts
  it('maps absolute rounds to 2-1 through 6-7, with explicit kinds and no round 36',()=>{
    expect(getStageRound(1)).toEqual({stage:2,round:1});expect(getStageRound(20)).toEqual({stage:4,round:6});expect(getStageRound(35)).toEqual({stage:6,round:7});
    const kinds=Array.from({length:35},(_,i)=>getRoundKind(i+1));
    expect(kinds.filter(k=>k==='pvp')).toHaveLength(25);expect(kinds.filter(k=>k==='pve')).toHaveLength(5);expect(kinds.filter(k=>k==='supply')).toHaveLength(5);
    for(const invalid of [0,36,1.5,NaN,Infinity]) expect(()=>getRoundKind(invalid)).toThrow();
```
新值/新输入：
```ts
  it('maps the catalog from 1-2 to 6-7 with 38 progression rounds and 33 battles',()=>{
    expect(getStageRound(1)).toEqual({stage:1,round:2});expect(getStageRound(getCatalogRoundById('4-6').ordinal)).toEqual({stage:4,round:6});
    expect(getStageRound(ROUND_CATALOG.at(-1)!.ordinal)).toEqual({stage:6,round:7});
    const kinds=ROUND_CATALOG.map(r=>getRoundKind(r.ordinal));
    expect(kinds.filter(k=>k==='pvp')).toHaveLength(25);expect(kinds.filter(k=>k==='pve')).toHaveLength(8);expect(kinds.filter(k=>k==='supply')).toHaveLength(5);
    for(const invalid of [0,ROUND_CATALOG.length+1,1.5,NaN,Infinity]) expect(()=>getRoundKind(invalid)).toThrow();
```
理由：OPENING §§2–4及批准round-catalog：旧日程语义由roundId查ordinal。PvE奖励归B8，因此当前组件节点11→5、随机奖励4→0；公开路线15组件验收原样保留，不把当前5个供给选择记为完整掉落。

## A015 · tests/m5-content.test.ts · @@ -91,9 +94,10 @@ describe('M5 finite campaign content',()=>{
旧值/旧输入：
```ts
  it('makes 15 components reachable and freezes 3 augments and the 4-6 anomaly',()=>{
    const events=Array.from({length:35},(_,i)=>({round:i+1,events:getRoundSchedule(i+1)}));
    expect(events.filter(r=>r.events.some(e=>e.kind==='augment')).map(r=>r.round)).toEqual([1,9,16]);
    expect(events.filter(r=>r.events.some(e=>e.kind==='anomaly')).map(r=>r.round)).toEqual([20]);
    expect(events.flatMap(r=>r.events).filter(e=>e.kind==='component')).toHaveLength(11);
    expect(events.flatMap(r=>r.events).reduce((n,e)=>n+(e.kind==='reward'?e.randomComponents:0),0)).toBe(4);
    expect(getRoundSchedule(1).map(e=>e.kind)).toEqual(['component','component','augment']);
    expect(getRoundSchedule(7).map(e=>[e.kind,e.timing])).toEqual([['reward','after'],['component','after']]);
    expect(getRoundSchedule(35)).toEqual([]);
```
新值/新输入：
```ts
  it('freezes three augments, the 4-6 anomaly and five supplies; B8 owns the missing PvE drop chain',()=>{
    const events=ROUND_CATALOG.map(r=>({round:r.roundId,events:getRoundSchedule(r.ordinal)}));
    expect(events.filter(r=>r.events.some(e=>e.kind==='augment')).map(r=>r.round)).toEqual(['2-1','3-2','4-2']);
    expect(events.filter(r=>r.events.some(e=>e.kind==='anomaly')).map(r=>r.round)).toEqual(['4-6']);
    expect(events.flatMap(r=>r.events).filter(e=>e.kind==='component')).toHaveLength(5);
    expect(events.flatMap(r=>r.events).reduce((n,e)=>n+(e.kind==='reward'?e.randomComponents:0),0)).toBe(0);
    expect(getRoundSchedule(1)).toEqual([]);
    expect(getRoundSchedule(getCatalogRoundById('2-1').ordinal).map(e=>e.kind)).toEqual(['augment']);
    expect(getRoundSchedule(getCatalogRoundById('2-7').ordinal)).toEqual([]);
    expect(getRoundSchedule(getCatalogRoundById('6-7').ordinal)).toEqual([]);
```
理由：OPENING §§2–4及批准round-catalog：旧日程语义由roundId查ordinal。PvE奖励归B8，因此当前组件节点11→5、随机奖励4→0；公开路线15组件验收原样保留，不把当前5个供给选择记为完整掉落。

## A016 · tests/m5-content.test.ts · @@ -102,6 +106,6 @@ describe('M5 finite campaign content',()=>{
旧值/旧输入：
```ts
    expect(createRoundEnemies(1)).toHaveLength(3);expect(createRoundEnemies(5)).toHaveLength(4);
    expect(createRoundEnemies(8)).toHaveLength(5);expect(createRoundEnemies(15)).toHaveLength(6);
    expect(createRoundEnemies(22)).toHaveLength(7);expect(createRoundEnemies(29)).toHaveLength(8);
    expect(createRoundEnemies(4)).toEqual([]);expect(createRoundEnemies(35).map(u=>u.definitionId)).toEqual(['neutral-stage-6']);
    expect(createRoundEnemies(15).map(u=>u.starLevel)).toEqual([2,2,2,1,1,1]);
    for(let round=1;round<=35;round++) {
```
新值/新输入：
```ts
    expect(createRoundEnemies(getCatalogRoundById('2-1').ordinal)).toHaveLength(3);expect(createRoundEnemies(getCatalogRoundById('2-5').ordinal)).toHaveLength(4);
    expect(createRoundEnemies(getCatalogRoundById('3-1').ordinal)).toHaveLength(5);expect(createRoundEnemies(getCatalogRoundById('4-1').ordinal)).toHaveLength(6);
    expect(createRoundEnemies(getCatalogRoundById('5-1').ordinal)).toHaveLength(7);expect(createRoundEnemies(getCatalogRoundById('6-1').ordinal)).toHaveLength(8);
    expect(createRoundEnemies(getCatalogRoundById('2-4').ordinal)).toEqual([]);expect(createRoundEnemies(getCatalogRoundById('6-7').ordinal).map(u=>u.definitionId)).toEqual(['neutral-stage-6']);
    expect(createRoundEnemies(getCatalogRoundById('4-1').ordinal).map(u=>u.starLevel)).toEqual([2,2,2,1,1,1]);
    for(const {ordinal:round} of ROUND_CATALOG) {
```
理由：OPENING §§2–4及批准round-catalog：旧日程语义由roundId查ordinal。PvE奖励归B8，因此当前组件节点11→5、随机奖励4→0；公开路线15组件验收原样保留，不把当前5个供给选择记为完整掉落。

## A017 · tests/m5-content.test.ts · @@ -113,2 +117,2 @@ describe('M5 finite campaign content',()=>{
旧值/旧输入：
```ts
    expect(getRoundEnemyItems(15)).toHaveLength(1);expect(getRoundEnemyItems(22)).toHaveLength(3);expect(getRoundEnemyItems(29)).toHaveLength(5);
    expect(getRoundEnemyItems(35)).toEqual([]);
```
新值/新输入：
```ts
    expect(getRoundEnemyItems(getCatalogRoundById('4-1').ordinal)).toHaveLength(1);expect(getRoundEnemyItems(getCatalogRoundById('5-1').ordinal)).toHaveLength(3);expect(getRoundEnemyItems(getCatalogRoundById('6-1').ordinal)).toHaveLength(5);
    expect(getRoundEnemyItems(getCatalogRoundById('6-7').ordinal)).toEqual([]);
```
理由：OPENING §§2–4及批准round-catalog：旧日程语义由roundId查ordinal。PvE奖励归B8，因此当前组件节点11→5、随机奖励4→0；公开路线15组件验收原样保留，不把当前5个供给选择记为完整掉落。

## A018 · tests/m5-growth.test.ts · @@ -4 +4 @@ import {restoreMatch} from '../src/simulation/serialization';
旧值/旧输入：
```ts
import {accepted,readyMatch} from './match-helpers';
```
新值/新输入：
```ts
import {accepted,readyMatch, purchasedThreeHeroMatch} from './match-helpers';
```
理由：原显式Tristana机制fixture改用正常购买后的2-1，并只部署该测试英雄；125Bps每次成长及唯一提交断言不变。历史长度按进入fixture前已有记录累加。

## A019 · tests/m5-growth.test.ts · @@ -29,2 +29,2 @@ describe('permanent Tristana growth is a conserved Match resource',()=>{
旧值/旧输入：
```ts
  const initial=readyMatch();
  const state:MatchState={...initial,preparation:{...initial.preparation,units:initial.preparation.units.map(u=>u.id==='unit-3'?{...u,definitionId:'tristana',starLevel:3}:u)}};
```
新值/新输入：
```ts
  const initial=purchasedThreeHeroMatch();
  const state:MatchState={...initial,preparation:{...initial.preparation,units:initial.preparation.units.map(u=>u.id==='unit-1'?{...u,definitionId:'tristana',starLevel:3}:u.team==='player'?{...u,location:{kind:'bench',slot:Number(u.id.slice(5))-2}}:u)}};
```
理由：原显式Tristana机制fixture改用正常购买后的2-1，并只部署该测试英雄；125Bps每次成长及唯一提交断言不变。历史长度按进入fixture前已有记录累加。

## A020 · tests/m5-growth.test.ts · @@ -35 +35 @@ describe('permanent Tristana growth is a conserved Match resource',()=>{
旧值/旧输入：
```ts
    expect(event.unitId).toBe('unit-3');expect(event.amountBps).toBe(125);growthEvents++;
```
新值/新输入：
```ts
    expect(event.unitId).toBe('unit-1');expect(event.amountBps).toBe(125);growthEvents++;
```
理由：原显式Tristana机制fixture改用正常购买后的2-1，并只部署该测试英雄；125Bps每次成长及唯一提交断言不变。历史长度按进入fixture前已有记录累加。

## A021 · tests/m5-growth.test.ts · @@ -40,2 +40,2 @@ describe('permanent Tristana growth is a conserved Match resource',()=>{
旧值/旧输入：
```ts
  expect(live.persistentGrowth).toEqual([{unitId:'unit-3',attackDamageBps:125*growthEvents}]);
  expect(live.roundResults).toHaveLength(1);
```
新值/新输入：
```ts
  expect(live.persistentGrowth).toEqual([{unitId:'unit-1',attackDamageBps:125*growthEvents}]);
  expect(live.roundResults).toHaveLength(initial.roundResults.length+1);
```
理由：原显式Tristana机制fixture改用正常购买后的2-1，并只部署该测试英雄；125Bps每次成长及唯一提交断言不变。历史长度按进入fixture前已有记录累加。

## A022 · tests/m5-growth.test.ts · @@ -44,2 +44,2 @@ describe('permanent Tristana growth is a conserved Match resource',()=>{
旧值/旧输入：
```ts
  const next=accepted(api.nextRound(restored,1));expect(next.persistentGrowth).toEqual(live.persistentGrowth);
  const stale=api.nextRound(next,1);expect(stale.ok).toBe(false);expect(stale.state).toBe(next);
```
新值/新输入：
```ts
  const next=accepted(api.nextRound(restored,restored.round));expect(next.persistentGrowth).toEqual(live.persistentGrowth);
  const stale=api.nextRound(next,restored.round);expect(stale.ok).toBe(false);expect(stale.state).toBe(next);
```
理由：原显式Tristana机制fixture改用正常购买后的2-1，并只部署该测试英雄；125Bps每次成长及唯一提交断言不变。历史长度按进入fixture前已有记录累加。

## A023 · tests/m5-match-integration.test.ts · @@ -21,14 +23,14 @@ describe('M5 Match atomic integration', () => {
旧值/旧输入：
```ts
  it('starts with public resources and ordered two-component/augment choices, restores every choice', () => {
    let state = createMatch(42);
    expect(state.preparation.benchSize).toBe(9);
    expect(state.preparation.units.filter(u => u.team === 'player').map(u=>u.definitionId)).toEqual(['irelia','maddie','lux']);
    expect(state.pendingChoice?.kind).toBe('component');
    for (let i=0;i<3;i++) {
      expect(restoreMatch(serializeMatch(state))).toEqual(state);
      const c=state.pendingChoice!, selected=selectChoice(state,c.choiceId,c.generation,c.offers[0]);
      expect(selected.ok).toBe(true); if(!selected.ok) throw new Error(selected.reason);
      const stale=selectChoice(selected.state,c.choiceId,c.generation,c.offers[0]);
      expect(stale.ok).toBe(false); expect(stale.state).toBe(selected.state); state=selected.state;
    }
    expect(state.phase).toBe('preparation'); expect(state.items).toHaveLength(2); expect(state.augments).toHaveLength(1);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
```
新值/新输入：
```ts
  it('starts with the approved single hero, then restores the first real augment without an old component package', () => {
    const initial=createMatch(42);
    expect(initial.preparation.benchSize).toBe(9);
    expect(initial.preparation.units.filter(u=>u.team==='player').map(u=>u.definitionId)).toEqual(['irelia']);
    expect(initial.pendingChoice).toBeNull();expect(initial.items).toHaveLength(0);expect(initial.augments).toHaveLength(0);
    expect(restoreMatch(serializeMatch(initial))).toEqual(initial);
    const before=reachRound('2-1',false),c=before.pendingChoice!;
    expect(c.kind).toBe('augment');expect(restoreMatch(serializeMatch(before))).toEqual(before);
    const selected=selectChoice(before,c.choiceId,c.generation,c.offers[0]);
    expect(selected.ok).toBe(true);if(!selected.ok)throw new Error(selected.reason);
    const stale=selectChoice(selected.state,c.choiceId,c.generation,c.offers[0]);
    expect(stale.ok).toBe(false);expect(stale.state).toBe(selected.state);
    expect(selected.state.phase).toBe('preparation');expect(selected.state.items).toHaveLength(0);expect(selected.state.augments).toHaveLength(1);
    expect(restoreMatch(serializeMatch(selected.state))).toEqual(selected.state);
```
理由：OPENING §2单刀妹/无起手选择；首次强化在2-1。付费操作从真实推进后的2-1开始；首个补给按2-4目录ordinal到达；每个原子性/恢复断言保留。

## A024 · tests/m5-match-integration.test.ts · @@ -37 +39 @@ describe('M5 Match atomic integration', () => {
旧值/旧输入：
```ts
    let state=choices(createMatch(42));
```
新值/新输入：
```ts
    let state=reachRound('2-1');
```
理由：OPENING §2单刀妹/无起手选择；首次强化在2-1。付费操作从真实推进后的2-1开始；首个补给按2-4目录ordinal到达；每个原子性/恢复断言保留。

## A025 · tests/m5-match-integration.test.ts · @@ -51 +53 @@ describe('M5 Match atomic integration', () => {
旧值/旧输入：
```ts
    for(let round=1;round<=3;round++) {
```
新值/新输入：
```ts
    for(let round=1;round<getCatalogRoundById('2-4').ordinal;round++) {
```
理由：OPENING §2单刀妹/无起手选择；首次强化在2-1。付费操作从真实推进后的2-1开始；首个补给按2-4目录ordinal到达；每个原子性/恢复断言保留。

## A026 · tests/m5-regressions.test.ts · @@ -16 +17 @@ describe('M4 coercion and atomicity boundaries remain permanent in schema5',()=>
旧值/旧输入：
```ts
  const bad=clone(field==='offer'?api.createMatch(42):ready());
```
新值/新输入：
```ts
  const bad=clone(field==='offer'?reachRound('2-1',false):reachRound('2-4'));
```
理由：同版本合法组件/强化/收据取真实2-4，offer取2-1；完成唯一强化后不再有旧后续组件选择，重复命令按当前preparation返回wrong-phase，原完整状态不变断言保留。

## A027 · tests/m5-regressions.test.ts · @@ -26 +27 @@ describe('M4 coercion and atomicity boundaries remain permanent in schema5',()=>
旧值/旧输入：
```ts
  const state=api.createMatch(42),choice=state.pendingChoice!,definitionId=choice.offers[0],before=JSON.stringify(state);
```
新值/新输入：
```ts
  const state=reachRound('2-1',false),choice=state.pendingChoice!,definitionId=choice.offers[0],before=JSON.stringify(state);
```
理由：同版本合法组件/强化/收据取真实2-4，offer取2-1；完成唯一强化后不再有旧后续组件选择，重复命令按当前preparation返回wrong-phase，原完整状态不变断言保留。

## A028 · tests/m5-regressions.test.ts · @@ -30 +31 @@ describe('M4 coercion and atomicity boundaries remain permanent in schema5',()=>
旧值/旧输入：
```ts
  const repeated=api.selectChoice(accepted.state,choice.choiceId,choice.generation,definitionId);expect(repeated).toEqual({ok:false,state:accepted.state,reason:'stale-choice'});expect(repeated.state).toBe(accepted.state);
```
新值/新输入：
```ts
  const repeated=api.selectChoice(accepted.state,choice.choiceId,choice.generation,definitionId);expect(repeated).toEqual({ok:false,state:accepted.state,reason:'wrong-phase'});expect(repeated.state).toBe(accepted.state);
```
理由：同版本合法组件/强化/收据取真实2-4，offer取2-1；完成唯一强化后不再有旧后续组件选择，重复命令按当前preparation返回wrong-phase，原完整状态不变断言保留。

## A029 · tests/m5-route.test.ts · @@ -9 +12 @@ describe('M5 ordinary three-build routes and independent resource ledger',()=>{
旧值/旧输入：
```ts
  expect(route.summary.outcome).toBe('victory');expect(route.summary.round).toBe(35);
```
新值/新输入：
```ts
  expect(route.summary.outcome).toBe('victory');expect(route.summary.round).toBe(FINAL_ROUND);
```
理由：仅完整日程长度、最终ordinal、战斗数量由ROUND_CATALOG推导。胜利、成型、英雄、15组件及原操作证据门禁未降低。

## A030 · tests/m5-route.test.ts · @@ -17 +20 @@ describe('M5 ordinary three-build routes and independent resource ledger',()=>{
旧值/旧输入：
```ts
  expect(route.summary.outcome).toBe('victory');expect(route.summary.round).toBe(35);
```
新值/新输入：
```ts
  expect(route.summary.outcome).toBe('victory');expect(route.summary.round).toBe(FINAL_ROUND);
```
理由：仅完整日程长度、最终ordinal、战斗数量由ROUND_CATALOG推导。胜利、成型、英雄、15组件及原操作证据门禁未降低。

## A031 · tests/m5-route.test.ts · @@ -19 +22 @@ describe('M5 ordinary three-build routes and independent resource ledger',()=>{
旧值/旧输入：
```ts
  expect(route.summary.transitioned).toBe(true);expect(route.ledger.rounds).toHaveLength(35);
```
新值/新输入：
```ts
  expect(route.summary.transitioned).toBe(true);expect(route.ledger.rounds).toHaveLength(ROUND_CATALOG.length);
```
理由：仅完整日程长度、最终ordinal、战斗数量由ROUND_CATALOG推导。胜利、成型、英雄、15组件及原操作证据门禁未降低。

## A032 · tests/m5-route.test.ts · @@ -22 +25 @@ describe('M5 ordinary three-build routes and independent resource ledger',()=>{
旧值/旧输入：
```ts
  expect(route.rounds).toHaveLength(30);expect(route.final.scheduleReceipts.reduce((n,r)=>n+r.itemIds.length,0)).toBe(15);
```
新值/新输入：
```ts
  expect(route.rounds).toHaveLength(BATTLE_COUNT);expect(route.final.scheduleReceipts.reduce((n,r)=>n+r.itemIds.length,0)).toBe(15);
```
理由：仅完整日程长度、最终ordinal、战斗数量由ROUND_CATALOG推导。胜利、成型、英雄、15组件及原操作证据门禁未降低。

## A033 · tests/m5-route.test.ts · @@ -27 +30 @@ describe('M5 ordinary three-build routes and independent resource ledger',()=>{
旧值/旧输入：
```ts
  for(const result of [api.rerollShop(end),api.buyXp(end),api.nextRound(end,35),api.startMatchCombat(end),api.sellUnit(end,end.preparation.units[0].id)]){
```
新值/新输入：
```ts
  for(const result of [api.rerollShop(end),api.buyXp(end),api.nextRound(end,FINAL_ROUND),api.startMatchCombat(end),api.sellUnit(end,end.preparation.units[0].id)]){
```
理由：仅完整日程长度、最终ordinal、战斗数量由ROUND_CATALOG推导。胜利、成型、英雄、15组件及原操作证据门禁未降低。

## A034 · tests/m5-serialization.test.ts · @@ -2 +2 @@ import {describe,expect,it} from 'vitest';
旧值/旧输入：
```ts
import {createMatch,startMatchCombat} from '../src/simulation/match';
```
新值/新输入：
```ts
import {startMatchCombat} from '../src/simulation/match';
```
理由：破坏测试先真实推进到2-5取得非空英雄/组件/强化/收据；选择态取2-1。拒绝校验不删，不以对undefined的TypeError冒充恢复拒绝。

## A035 · tests/m5-serialization.test.ts · @@ -4 +4 @@ import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
旧值/旧输入：
```ts
import {accepted,readyMatch,finish} from './match-helpers';
```
新值/新输入：
```ts
import {accepted,readyMatch,finish,reachRound} from './match-helpers';
```
理由：破坏测试先真实推进到2-5取得非空英雄/组件/强化/收据；选择态取2-1。拒绝校验不删，不以对undefined的TypeError冒充恢复拒绝。

## A036 · tests/m5-serialization.test.ts · @@ -20 +20 @@ describe('schema5 rejects corrupted domain state without replaying side effects'
旧值/旧输入：
```ts
  const original=readyMatch(),invalid=copy(original);mutate(invalid);expect(()=>restoreMatch(invalid)).toThrow();expect(restoreMatch(serializeMatch(original))).toEqual(original);
```
新值/新输入：
```ts
  const original=reachRound('2-5'),invalid=copy(original);mutate(invalid);expect(()=>restoreMatch(invalid)).toThrow();expect(restoreMatch(serializeMatch(original))).toEqual(original);
```
理由：破坏测试先真实推进到2-5取得非空英雄/组件/强化/收据；选择态取2-1。拒绝校验不删，不以对undefined的TypeError冒充恢复拒绝。

## A037 · tests/m5-serialization.test.ts · @@ -22 +22 @@ describe('schema5 rejects corrupted domain state without replaying side effects'
旧值/旧输入：
```ts
 it.each([['duplicate offers',(s:any)=>{s.pendingChoice.offers[1]=s.pendingChoice.offers[0];}],['invalid choice kind',(s:any)=>{s.pendingChoice.kind='surprise';}],['foreign offer',(s:any)=>{s.pendingChoice.offers[0]='deathblade';}],['stale choice',(s:any)=>{s.pendingChoice.generation=1;}] ] as const)('rejects %s',(_label,mutate)=>{const s=copy(createMatch());mutate(s);expect(()=>restoreMatch(s)).toThrow();});
```
新值/新输入：
```ts
 it.each([['duplicate offers',(s:any)=>{s.pendingChoice.offers[1]=s.pendingChoice.offers[0];}],['invalid choice kind',(s:any)=>{s.pendingChoice.kind='surprise';}],['foreign offer',(s:any)=>{s.pendingChoice.offers[0]='deathblade';}],['stale choice',(s:any)=>{s.pendingChoice.generation=1;}] ] as const)('rejects %s',(_label,mutate)=>{const s=copy(reachRound('2-1',false));mutate(s);expect(()=>restoreMatch(s)).toThrow();});
```
理由：破坏测试先真实推进到2-5取得非空英雄/组件/强化/收据；选择态取2-1。拒绝校验不删，不以对undefined的TypeError冒充恢复拒绝。

## A038 · tests/m5-serialization.test.ts · @@ -34 +34 @@ describe('schema5 rejects corrupted domain state without replaying side effects'
旧值/旧输入：
```ts
  const original=createMatch(),restored=restoreMatch(serializeMatch(original));expect(restored).toEqual(original);expect(restored).not.toBe(original);expect(restored.pendingChoice).not.toBe(original.pendingChoice);
```
新值/新输入：
```ts
  const original=reachRound('2-1',false),restored=restoreMatch(serializeMatch(original));expect(restored).toEqual(original);expect(restored).not.toBe(original);expect(restored.pendingChoice).not.toBe(original.pendingChoice);
```
理由：破坏测试先真实推进到2-5取得非空英雄/组件/强化/收据；选择态取2-1。拒绝校验不删，不以对undefined的TypeError冒充恢复拒绝。

## A039 · tests/m5-strategy-numbers.test.ts · @@ -5 +5 @@ import type { Unit } from '../src/simulation/units';
旧值/旧输入：
```ts
import { accepted, emptyBoard } from './match-helpers';
```
新值/新输入：
```ts
import { accepted, emptyBoard, reachRound } from './match-helpers';
```
理由：snapshot本身不授金币：真实新局底金10→0。两场4+5利息测试改在真实2-1开始，独立58/69G与32/72HP强化数值保持。

## A040 · tests/m5-strategy-numbers.test.ts · @@ -168 +168 @@ describe('M5 six augments and permanent accumulation', () => {
旧值/旧输入：
```ts
    expect(state.gold).toBe(10); // Compiling a snapshot must not grant acquisition gold again.
```
新值/新输入：
```ts
    expect(state.gold).toBe(0); // Compiling a snapshot must not grant acquisition gold again.
```
理由：snapshot本身不授金币：真实新局底金10→0。两场4+5利息测试改在真实2-1开始，独立58/69G与32/72HP强化数值保持。

## A041 · tests/m5-strategy-numbers.test.ts · @@ -194 +194 @@ describe('M5 six augments and permanent accumulation', () => {
旧值/旧输入：
```ts
    let state = augment({ ...emptyBoard(), gold: 49 }, 'pumping-up-i', 'investment-strategy-i');
```
新值/新输入：
```ts
    let state = augment({ ...emptyBoard(reachRound('2-1')), gold: 49 }, 'pumping-up-i', 'investment-strategy-i');
```
理由：snapshot本身不授金币：真实新局底金10→0。两场4+5利息测试改在真实2-1开始，独立58/69G与32/72HP强化数值保持。

## A042 · tests/m5-strategy-numbers.test.ts · @@ -199 +199 @@ describe('M5 six augments and permanent accumulation', () => {
旧值/旧输入：
```ts
    state = accepted(nextRound(state, 1));
```
新值/新输入：
```ts
    state = accepted(nextRound(state, state.round));
```
理由：snapshot本身不授金币：真实新局底金10→0。两场4+5利息测试改在真实2-1开始，独立58/69G与32/72HP强化数值保持。

## A043 · tests/m6-integration.test.ts · @@ -23 +24 @@ describe('M6 independent route/history/playback/session integration', () => {
旧值/旧输入：
```ts
    expect(history.completedRecords).toHaveLength(30);
```
新值/新输入：
```ts
    expect(history.completedRecords).toHaveLength(ROUND_CATALOG.filter(r=>r.kind!=='supply').length);
```
理由：历史期望战斗数由日程kind过滤。B9应用容量仍30，未改容量或任何门禁；完整33战仍待B9。

## A044 · tests/m8-b3-audit.test.ts · @@ -2 +3 @@ import { describe, expect, it } from 'vitest';
旧值/旧输入：
```ts
import { createMatch, selectChoice, combineItems, equipItem, deployMatchUnit, startMatchCombat, stepMatch } from '../src/simulation/match';
```
新值/新输入：
```ts
import { combineItems, equipItem, deployMatchUnit, startMatchCombat, stepMatch } from '../src/simulation/match';
```
理由：龙爪测试先用真实2-1购买多持有者，再显式IF-GRANT两斗篷构造装备机制输入，不冒充B8奖励。三次battle-seed前插使旧699/718HP轨迹失效；保留maxHP763、手算floor(763×250/10000)=19治疗、足够缺血、恢复事件完全一致，治疗后HP改为本次真实preHeal+19。其余G12专属用例未改。

## A045 · tests/m8-b3-audit.test.ts · @@ -6 +7 @@ import type { CombatEvent } from '../src/simulation/combat';
旧值/旧输入：
```ts
import { accepted, battle } from './match-helpers';
```
新值/新输入：
```ts
import { accepted, battle, purchasedThreeHeroMatch } from './match-helpers';
```
理由：龙爪测试先用真实2-1购买多持有者，再显式IF-GRANT两斗篷构造装备机制输入，不冒充B8奖励。三次battle-seed前插使旧699/718HP轨迹失效；保留maxHP763、手算floor(763×250/10000)=19治疗、足够缺血、恢复事件完全一致，治疗后HP改为本次真实preHeal+19。其余G12专属用例未改。

## A046 · tests/m8-b3-audit.test.ts · @@ -28,5 +29,3 @@ describe('B3 audit independent lifecycle and identity expectations', () => {
旧值/旧输入：
```ts
    let state = createMatch(42);
    while (state.phase === 'choice') {
      const c = state.pendingChoice!;
      state = accepted(selectChoice(state, c.choiceId, c.generation, c.kind === 'component' ? 'cloak' : c.offers.find(id => id !== 'placebo' && id !== 'glass-cannon-i')!));
    }
```
新值/新输入：
```ts
    let state=purchasedThreeHeroMatch();
    // Explicit item-mechanism input through IF-GRANT; not B8 acquisition evidence.
    for(let i=0;i<2;i++) {const grant=planPermanentItemGrant(state,{definitionId:'cloak',receiptId:`claw-fixture-${i}`},[]);if(!grant.ok)throw new Error(grant.reason);state=grant.state;}
```
理由：龙爪测试先用真实2-1购买多持有者，再显式IF-GRANT两斗篷构造装备机制输入，不冒充B8奖励。三次battle-seed前插使旧699/718HP轨迹失效；保留maxHP763、手算floor(763×250/10000)=19治疗、足够缺血、恢复事件完全一致，治疗后HP改为本次真实preHeal+19。其余G12专属用例未改。

## A047 · tests/m8-b3-audit.test.ts · @@ -44 +43,2 @@ describe('B3 audit independent lifecycle and identity expectations', () => {
旧值/旧输入：
```ts
    expect(state.combat!.units.find(u => u.id === 'unit-1')).toMatchObject({ hp: 699, maxHp: 763 });
```
新值/新输入：
```ts
    const beforeHeal=state.combat!.units.find(u=>u.id==='unit-1')!;
    expect(beforeHeal.maxHp).toBe(763);expect(beforeHeal.maxHp-beforeHeal.hp).toBeGreaterThanOrEqual(19);
```
理由：龙爪测试先用真实2-1购买多持有者，再显式IF-GRANT两斗篷构造装备机制输入，不冒充B8奖励。三次battle-seed前插使旧699/718HP轨迹失效；保留maxHP763、手算floor(763×250/10000)=19治疗、足够缺血、恢复事件完全一致，治疗后HP改为本次真实preHeal+19。其余G12专属用例未改。

## A048 · tests/m8-b3-audit.test.ts · @@ -46 +46 @@ describe('B3 audit independent lifecycle and identity expectations', () => {
旧值/旧输入：
```ts
    // floor(763×250/10000)=19; 699+19=718. Identity must survive key sorting.
```
新值/新输入：
```ts
    // floor(763×250/10000)=19. New battle-seed/round trajectory changes pre-heal HP; the fixed arithmetic stays 19.
```
理由：龙爪测试先用真实2-1购买多持有者，再显式IF-GRANT两斗篷构造装备机制输入，不冒充B8奖励。三次battle-seed前插使旧699/718HP轨迹失效；保留maxHP763、手算floor(763×250/10000)=19治疗、足够缺血、恢复事件完全一致，治疗后HP改为本次真实preHeal+19。其余G12专属用例未改。

## A049 · tests/m8-b3-audit.test.ts · @@ -49 +49 @@ describe('B3 audit independent lifecycle and identity expectations', () => {
旧值/旧输入：
```ts
    expect(continued.events.find(e => e.type === 'heal' && e.unitId === 'unit-1')).toMatchObject({ requested: 19, actual: 19, hp: 718 });
```
新值/新输入：
```ts
    expect(continued.events.find(e => e.type === 'heal' && e.unitId === 'unit-1')).toMatchObject({ requested: 19, actual: 19, hp: beforeHeal.hp+19 });
```
理由：龙爪测试先用真实2-1购买多持有者，再显式IF-GRANT两斗篷构造装备机制输入，不冒充B8奖励。三次battle-seed前插使旧699/718HP轨迹失效；保留maxHP763、手算floor(763×250/10000)=19治疗、足够缺血、恢复事件完全一致，治疗后HP改为本次真实preHeal+19。其余G12专属用例未改。

## A050 · tests/m8-b4-audit-regressions.test.ts · @@ -70 +71 @@ describe('B4 audit R1: qualified packets and counter projections', () => {
旧值/旧输入：
```ts
    while (s.round < 22) {
```
新值/新输入：
```ts
    while (s.round < getCatalogRoundById('5-1').ordinal) {
```
理由：原强阵容领域fixture与数值要求保持，只把5-1的旧ordinal22改为目录查值。

## A051 · tests/m8-b4-catalog.test.ts · @@ -6 +7 @@ import { validateComponentPool,validateComponentCandidates,COMPONENT_POOL } from
旧值/旧输入：
```ts
import { createMatch,selectChoice,stepMatch } from '../src/simulation/match';
```
新值/新输入：
```ts
import { selectChoice,stepMatch } from '../src/simulation/match';
```
理由：组件池/选择原子性改用仍存在的真实2-4补给选择；8候选、单收据、零choice RNG保持。

## A052 · tests/m8-b4-catalog.test.ts · @@ -28 +29 @@ describe('B4 catalogue and IF-POOL',()=>{
旧值/旧输入：
```ts
  const before=createMatch(42);expect(before.pendingChoice?.offers).toEqual(COMPONENT_POOL.map(x=>x.definitionId));validateComponentCandidates(before.pendingChoice!.offers);
```
新值/新输入：
```ts
  const before=reachRound('2-4',false);expect(before.pendingChoice?.offers).toEqual(COMPONENT_POOL.map(x=>x.definitionId));validateComponentCandidates(before.pendingChoice!.offers);
```
理由：组件池/选择原子性改用仍存在的真实2-4补给选择；8候选、单收据、零choice RNG保持。

## A053 · tests/m8-b5-equipment-history.test.ts · @@ -22 +24 @@ function choices(input: MatchState): MatchState {
旧值/旧输入：
```ts
function start(equipped = true): MatchState {
```
新值/新输入：
```ts
function start(equipped = true, history?: BattleHistory): MatchState {
```
理由：真实三个开场先记录，再在2-1装备显式IF-GRANT夹具；所有历史索引按原roundId查目录。装备快照3/4/7级及RNG独立值不变，首个有TG的档案按2-1身份查找。

## A054 · tests/m8-b5-equipment-history.test.ts · @@ -36,2 +44,2 @@ function roundEight(equipped = true, history?: BattleHistory): MatchState {
旧值/旧输入：
```ts
  let state = start(equipped);
  while (state.round < 8) {
```
新值/新输入：
```ts
  let state = start(equipped,history);
  while (state.round < getCatalogRoundById('3-1').ordinal) {
```
理由：真实三个开场先记录，再在2-1装备显式IF-GRANT夹具；所有历史索引按原roundId查目录。装备快照3/4/7级及RNG独立值不变，首个有TG的档案按2-1身份查找。

## A055 · tests/m8-b5-equipment-history.test.ts · @@ -57 +65 @@ describe('B5 audit R1: equipment roll level belongs to its round history', () =>
旧值/旧输入：
```ts
    expect(state.roundResults[0]).toMatchObject({ levelBefore: 3, levelAfter: 3 });
```
新值/新输入：
```ts
    expect(state.roundResults[getCatalogRoundById('2-1').ordinal-1]).toMatchObject({ levelBefore: 3, levelAfter: 3 });
```
理由：真实三个开场先记录，再在2-1装备显式IF-GRANT夹具；所有历史索引按原roundId查目录。装备快照3/4/7级及RNG独立值不变，首个有TG的档案按2-1身份查找。

## A056 · tests/m8-b5-equipment-history.test.ts · @@ -69 +77 @@ describe('B5 audit R1: equipment roll level belongs to its round history', () =>
旧值/旧输入：
```ts
      expect(raw.roundResults[2]).toMatchObject({ levelBefore: 3, levelAfter: 4 });
```
新值/新输入：
```ts
      expect(raw.roundResults[getCatalogRoundById('2-3').ordinal-1]).toMatchObject({ levelBefore: 3, levelAfter: 4 });
```
理由：真实三个开场先记录，再在2-1装备显式IF-GRANT夹具；所有历史索引按原roundId查目录。装备快照3/4/7级及RNG独立值不变，首个有TG的档案按2-1身份查找。

## A057 · tests/m8-b5-equipment-history.test.ts · @@ -77 +85 @@ describe('B5 audit R1: equipment roll level belongs to its round history', () =>
旧值/旧输入：
```ts
    expect(raw.roundResults[2]).toMatchObject({ levelBefore: 3, levelAfter: 4 });
```
新值/新输入：
```ts
    expect(raw.roundResults[getCatalogRoundById('2-3').ordinal-1]).toMatchObject({ levelBefore: 3, levelAfter: 4 });
```
理由：真实三个开场先记录，再在2-1装备显式IF-GRANT夹具；所有历史索引按原roundId查目录。装备快照3/4/7级及RNG独立值不变，首个有TG的档案按2-1身份查找。

## A058 · tests/m8-b5-equipment-history.test.ts · @@ -88 +96 @@ describe('B5 audit R1: equipment roll level belongs to its round history', () =>
旧值/旧输入：
```ts
    expect(state.roundResults[7]).toMatchObject({ levelBefore: 7, levelAfter: 7 });
```
新值/新输入：
```ts
    expect(state.roundResults[getCatalogRoundById('3-1').ordinal-1]).toMatchObject({ levelBefore: 7, levelAfter: 7 });
```
理由：真实三个开场先记录，再在2-1装备显式IF-GRANT夹具；所有历史索引按原roundId查目录。装备快照3/4/7级及RNG独立值不变，首个有TG的档案按2-1身份查找。

## A059 · tests/m8-b5-equipment-history.test.ts · @@ -99 +107 @@ describe('B5 audit R1: equipment roll level belongs to its round history', () =>
旧值/旧输入：
```ts
    expect(state.roundResults[6].levelAfter).toBe(4);
```
新值/新输入：
```ts
    expect(state.roundResults[getCatalogRoundById('2-7').ordinal-1].levelAfter).toBe(4);
```
理由：真实三个开场先记录，再在2-1装备显式IF-GRANT夹具；所有历史索引按原roundId查目录。装备快照3/4/7级及RNG独立值不变，首个有TG的档案按2-1身份查找。

## A060 · tests/m8-b5-equipment-history.test.ts · @@ -107 +115 @@ describe('B5 audit R1: equipment roll level belongs to its round history', () =>
旧值/旧输入：
```ts
    Object.assign(raw.roundResults[0], { levelAfter: 4 });
```
新值/新输入：
```ts
    Object.assign(raw.roundResults[getCatalogRoundById('2-1').ordinal-1], { levelAfter: 4 });
```
理由：真实三个开场先记录，再在2-1装备显式IF-GRANT夹具；所有历史索引按原roundId查目录。装备快照3/4/7级及RNG独立值不变，首个有TG的档案按2-1身份查找。

## A061 · tests/m8-b5-equipment-history.test.ts · @@ -115 +123 @@ describe('B5 audit R1: equipment roll level belongs to its round history', () =>
旧值/旧输入：
```ts
    expect(envelope.battles[0].context.equipmentState.rolls[0].playerLevelSnapshot).toBe(3);
```
新值/新输入：
```ts
    expect(envelope.battles.find(b=>b.context.roundDefinitionId==='2-1')!.context.equipmentState.rolls[0].playerLevelSnapshot).toBe(3);
```
理由：真实三个开场先记录，再在2-1装备显式IF-GRANT夹具；所有历史索引按原roundId查目录。装备快照3/4/7级及RNG独立值不变，首个有TG的档案按2-1身份查找。

## A062 · tests/m8-b5-grant-upgrade.test.ts · @@ -4 +4 @@ import { readItemInventory } from '../src/simulation/item-selectors';
旧值/旧输入：
```ts
import { buyUnit, combineItems, createMatch, equipItem, selectChoice, sellUnit } from '../src/simulation/match';
```
新值/新输入：
```ts
import { buyUnit, combineItems, equipItem, selectChoice, sellUnit } from '../src/simulation/match';
```
理由：组件公开选择改用真实2-4；库存脱离性测试显式增加一个未合成组件，使被检查库存实际非空。原唯一ID/单收据/拒绝重发要求保持。

## A063 · tests/m8-b5-grant-upgrade.test.ts · @@ -10 +10 @@ import type { ItemInstance } from '../src/simulation/strategy-types';
旧值/旧输入：
```ts
import { accepted, freeze, readyMatch } from './match-helpers';
```
新值/新输入：
```ts
import { accepted, freeze, readyMatch, reachRound } from './match-helpers';
```
理由：组件公开选择改用真实2-4；库存脱离性测试显式增加一个未合成组件，使被检查库存实际非空。原唯一ID/单收据/拒绝重发要求保持。

## A064 · tests/m8-b5-grant-upgrade.test.ts · @@ -56 +56 @@ describe('B5 IF-GRANT and atomic permanent inventory queries', () => {
旧值/旧输入：
```ts
    const state = freeze(createMatch(42)), choice = state.pendingChoice!;
```
新值/新输入：
```ts
    const state = freeze(reachRound('2-4',false)), choice = state.pendingChoice!;
```
理由：组件公开选择改用真实2-4；库存脱离性测试显式增加一个未合成组件，使被检查库存实际非空。原唯一ID/单收据/拒绝重发要求保持。

## A065 · tests/m8-b5-grant-upgrade.test.ts · @@ -82 +82 @@ describe('B5 IF-GRANT and atomic permanent inventory queries', () => {
旧值/旧输入：
```ts
    state = { ...state, nextItemSerial: 30, items: [...state.items, item(20, 'gloves'), item(21, 'gloves')] };
```
新值/新输入：
```ts
    state = { ...state, nextItemSerial: 30, items: [...state.items, item(20, 'gloves'), item(21, 'gloves'), item(22, 'sword')] };
```
理由：组件公开选择改用真实2-4；库存脱离性测试显式增加一个未合成组件，使被检查库存实际非空。原唯一ID/单收据/拒绝重发要求保持。

## A066 · tests/m8-b5-instances.test.ts · @@ -2 +2 @@ import { describe, expect, it } from 'vitest';
旧值/旧输入：
```ts
import { combineItems, equipItem, createMatch } from '../src/simulation/match';
```
新值/新输入：
```ts
import { combineItems, equipItem } from '../src/simulation/match';
```
理由：多持有者用真实2-1付费购买麦迪/拉克丝，选择阻塞用真实2-1；不发B8奖励，装备失败原因与原子性要求保持。

## A067 · tests/m8-b5-instances.test.ts · @@ -7 +7 @@ import { transferUpgradeResources } from '../src/simulation/upgrades';
旧值/旧输入：
```ts
import { accepted, freeze, readyMatch } from './match-helpers';
```
新值/新输入：
```ts
import { accepted, freeze, purchasedThreeHeroMatch, reachRound } from './match-helpers';
```
理由：多持有者用真实2-1付费购买麦迪/拉克丝，选择阻塞用真实2-1；不发B8奖励，装备失败原因与原子性要求保持。

## A068 · tests/m8-b5-instances.test.ts · @@ -13 +13 @@ function stateWith(items: readonly ItemInstance[]): MatchState {
旧值/旧输入：
```ts
  const state = readyMatch();
```
新值/新输入：
```ts
  const state = purchasedThreeHeroMatch();
```
理由：多持有者用真实2-1付费购买麦迪/拉克丝，选择阻塞用真实2-1；不发B8奖励，装备失败原因与原子性要求保持。

## A069 · tests/m8-b5-instances.test.ts · @@ -52,2 +52,2 @@ describe('B5 permanent equipment constraints and atomic commands', () => {
旧值/旧输入：
```ts
    rejected(createMatch(), s => equipItem(s, 'missing', 'missing', -1), 'wrong-phase');
    rejected(createMatch(), s => combineItems(s, 'missing', 'missing'), 'wrong-phase');
```
新值/新输入：
```ts
    rejected(reachRound('2-1',false), s => equipItem(s, 'missing', 'missing', -1), 'wrong-phase');
    rejected(reachRound('2-1',false), s => combineItems(s, 'missing', 'missing'), 'wrong-phase');
```
理由：多持有者用真实2-1付费购买麦迪/拉克丝，选择阻塞用真实2-1；不发B8奖励，装备失败原因与原子性要求保持。

## A070 · tests/m8-b5-queries.test.ts · @@ -2 +2 @@ import { describe, expect, it } from 'vitest';
旧值/旧输入：
```ts
import { combineItems, equipItem, createMatch, startMatchCombat } from '../src/simulation/match';
```
新值/新输入：
```ts
import { combineItems, equipItem, startMatchCombat } from '../src/simulation/match';
```
理由：同上，用真实2-1付费多持有者；preview/commit一致性及不可变视图断言不变。

## A071 · tests/m8-b5-queries.test.ts · @@ -8 +8 @@ import { planTemporaryEquipment } from '../src/simulation/temporary-equipment';
旧值/旧输入：
```ts
import { accepted, freeze, readyMatch } from './match-helpers';
```
新值/新输入：
```ts
import { accepted, freeze, purchasedThreeHeroMatch, reachRound } from './match-helpers';
```
理由：同上，用真实2-1付费多持有者；preview/commit一致性及不可变视图断言不变。

## A072 · tests/m8-b5-queries.test.ts · @@ -14 +14 @@ function fixture(): MatchState {
旧值/旧输入：
```ts
  const state = readyMatch();
```
新值/新输入：
```ts
  const state = purchasedThreeHeroMatch();
```
理由：同上，用真实2-1付费多持有者；preview/commit一致性及不可变视图断言不变。

## A073 · tests/m8-b5-queries.test.ts · @@ -44 +44 @@ describe('B5 shared command previews and read-only equipment', () => {
旧值/旧输入：
```ts
    const phases = [base, createMatch(), accepted(startMatchCombat(base)), { ...base, phase: 'settlement' as const, combat: null }, { ...base, phase: 'gameOver' as const, combat: null }];
```
新值/新输入：
```ts
    const phases = [base, reachRound('2-1',false), accepted(startMatchCombat(base)), { ...base, phase: 'settlement' as const, combat: null }, { ...base, phase: 'gameOver' as const, combat: null }];
```
理由：同上，用真实2-1付费多持有者；preview/commit一致性及不可变视图断言不变。

## A074 · tests/m8-b5-temporary.test.ts · @@ -8 +8 @@ import { planTemporaryEquipment, validateMatchEquipment } from '../src/simulatio
旧值/旧输入：
```ts
import { accepted, emptyBoard, freeze, readyMatch } from './match-helpers';
```
新值/新输入：
```ts
import { accepted, emptyBoard, freeze, reachRound, purchasedThreeHeroMatch } from './match-helpers';
```
理由：TG的2-1语义不变；先真实推进到2-1再构造原显式等级/物品微型fixture。种子42多持有者经正常购买；其他种子保持单持有者。

## A075 · tests/m8-b5-temporary.test.ts · @@ -11 +11 @@ function inventory(level = 6, seed = 42): MatchState {
旧值/旧输入：
```ts
  const state = readyMatch(seed);
```
新值/新输入：
```ts
  const state = seed===42 ? purchasedThreeHeroMatch() : reachRound('2-1',true,seed);
```
理由：TG的2-1语义不变；先真实推进到2-1再构造原显式等级/物品微型fixture。种子42多持有者经正常购买；其他种子保持单持有者。

## A076 · tests/match-contract.test.ts · @@ -2,2 +3,2 @@ import { describe, expect, it } from 'vitest';
旧值/旧输入：
```ts
import { buyUnit, buyXp, createMatch, deployMatchUnit, getDeploymentCap, matchStartFailure, startMatchCombat, stepMatch, validateMatchDeployment } from '../src/simulation/match';
import { accepted, freeze, readyMatch, emptyBoard } from './match-helpers';
```
新值/新输入：
```ts
import { buyUnit, buyXp, createMatch, nextRound, deployMatchUnit, getDeploymentCap, matchStartFailure, startMatchCombat, stepMatch, validateMatchDeployment } from '../src/simulation/match';
import { accepted, freeze, readyMatch, emptyBoard, purchasedThreeHeroMatch } from './match-helpers';
```
理由：OPENING §2初始0G/1级/nextSerial2/准备期；§3.1首场让阵+2G、+2XP升2级0XP、-3HP。人口测试改用公开购买和2-2自然XP后F的合法场景。

## A077 · tests/match-contract.test.ts · @@ -7 +8 @@ describe('M5 public contract (M4 command invariants retained)', () => {
旧值/旧输入：
```ts
  it('starts with versioned independent streams, public roster and blocking component choice', () => {
```
新值/新输入：
```ts
  it('starts with versioned independent streams, public single-hero roster and immediate preparation', () => {
```
理由：OPENING §2初始0G/1级/nextSerial2/准备期；§3.1首场让阵+2G、+2XP升2级0XP、-3HP。人口测试改用公开购买和2-2自然XP后F的合法场景。

## A078 · tests/match-contract.test.ts · @@ -12 +13 @@ describe('M5 public contract (M4 command invariants retained)', () => {
旧值/旧输入：
```ts
      phase:'choice',round:1,gold:10,level:3,xp:0,playerHp:100,rngState:Number(rng),nextUnitSerial:4,combat:null,roundResults:[],pendingChoice:{kind:'component'}});
```
新值/新输入：
```ts
      phase:'preparation',round:1,gold:0,level:1,xp:0,playerHp:100,rngState:Number(rng),nextUnitSerial:2,combat:null,roundResults:[],pendingChoice:null});
```
理由：OPENING §2初始0G/1级/nextSerial2/准备期；§3.1首场让阵+2G、+2XP升2级0XP、-3HP。人口测试改用公开购买和2-2自然XP后F的合法场景。

## A079 · tests/match-contract.test.ts · @@ -17 +18 @@ describe('M5 public contract (M4 command invariants retained)', () => {
旧值/旧输入：
```ts
  it('concedes an empty deployment at tick zero once, with R3 interest and three surviving enemies', () => {
```
新值/新输入：
```ts
  it('concedes an empty deployment at tick zero once, with stage-one base income and fixed PvE failure damage', () => {
```
理由：OPENING §2初始0G/1级/nextSerial2/准备期；§3.1首场让阵+2G、+2XP升2级0XP、-3HP。人口测试改用公开购买和2-2自然XP后F的合法场景。

## A080 · tests/match-contract.test.ts · @@ -21,2 +22,2 @@ describe('M5 public contract (M4 command invariants retained)', () => {
旧值/旧输入：
```ts
    expect(result.state).toMatchObject({phase:'settlement',playerHp:95,gold:16,xp:2});
    expect(result.state.roundResults).toHaveLength(1);expect(result.state.roundResults[0]).toMatchObject({result:'enemyWin',combatTicks:0,playerDamage:5});
```
新值/新输入：
```ts
    expect(result.state).toMatchObject({phase:'settlement',playerHp:97,gold:2,level:2,xp:0});
    expect(result.state.roundResults).toHaveLength(1);expect(result.state.roundResults[0]).toMatchObject({result:'enemyWin',combatTicks:0,playerDamage:3});
```
理由：OPENING §2初始0G/1级/nextSerial2/准备期；§3.1首场让阵+2G、+2XP升2级0XP、-3HP。人口测试改用公开购买和2-2自然XP后F的合法场景。

## A081 · tests/match-contract.test.ts · @@ -35 +36,4 @@ describe('M5 public contract (M4 command invariants retained)', () => {
旧值/旧输入：
```ts
    const state=accepted(buyUnit(readyMatch(),0,1)),target:UnitLocation={kind:'board',cell:{col:4,row:4}};
```
新值/新输入：
```ts
    let staged=accepted(nextRound(accepted(startMatchCombat(emptyBoard(purchasedThreeHeroMatch()))),getCatalogRoundById('2-1').ordinal));
    for(const [index,u] of staged.preparation.units.filter(u=>u.team==='player').entries()) staged=accepted(deployMatchUnit(staged,u.id,{kind:'board',cell:{col:index+1,row:6}}));
    const slot=staged.shop.slots.findIndex(o=>o.status==='available'&&o.definitionId!=='irelia'&&o.definitionId!=='maddie'&&o.definitionId!=='lux');
    const state=accepted(buyUnit(staged,slot,staged.shop.generation)),target:UnitLocation={kind:'board',cell:{col:4,row:4}};
```
理由：OPENING §2初始0G/1级/nextSerial2/准备期；§3.1首场让阵+2G、+2XP升2级0XP、-3HP。人口测试改用公开购买和2-2自然XP后F的合法场景。

## A082 · tests/match-contract.test.ts · @@ -39 +43 @@ describe('M5 public contract (M4 command invariants retained)', () => {
旧值/旧输入：
```ts
    const upgraded=accepted(buyXp(accepted(buyXp(state))));expect(upgraded.level).toBe(4);expect(upgraded.shop).toBe(state.shop);expect(upgraded.rngState).toBe(state.rngState);
```
新值/新输入：
```ts
    const upgraded=accepted(buyXp(state));expect(upgraded.level).toBe(4);expect(upgraded.shop).toBe(state.shop);expect(upgraded.rngState).toBe(state.rngState);
```
理由：OPENING §2初始0G/1级/nextSerial2/准备期；§3.1首场让阵+2G、+2XP升2级0XP、-3HP。人口测试改用公开购买和2-2自然XP后F的合法场景。

## A083 · tests/match-economy.test.ts · @@ -2 +2 @@ import { describe, expect, it } from 'vitest';
旧值/旧输入：
```ts
import { buyUnit, buyXp, createMatch, deployMatchUnit, nextRound, rerollShop, sellUnit, startMatchCombat,
```
新值/新输入：
```ts
import { buyUnit, buyXp, deployMatchUnit, nextRound, rerollShop, sellUnit, startMatchCombat,
```
理由：原纯命令经济向量明确改名economyFixture，显式保留10G/3级/三持有者测试输入，不作为新局或B8获取证据。真实新局另有B6测试。唯一结算断言按所在1-2改为+2G/-3HP；选择阶段使用真实2-1。

## A084 · tests/match-economy.test.ts · @@ -5 +5 @@ import type { Unit, UnitLocation } from '../src/simulation/units';
旧值/旧输入：
```ts
import { accepted, battle, finish, freeze, readyMatch, emptyBoard } from './match-helpers';
```
新值/新输入：
```ts
import { accepted, battle, finish, freeze, readyMatch, emptyBoard, reachRound } from './match-helpers';
```
理由：原纯命令经济向量明确改名economyFixture，显式保留10G/3级/三持有者测试输入，不作为新局或B8获取证据。真实新局另有B6测试。唯一结算断言按所在1-2改为+2G/-3HP；选择阶段使用真实2-1。

## A085 · tests/match-economy.test.ts · @@ -36 +50 @@ function fullBench(): MatchState {
旧值/旧输入：
```ts
  const state = emptyBoard();
```
新值/新输入：
```ts
  const state = economyEmptyBoard();
```
理由：原纯命令经济向量明确改名economyFixture，显式保留10G/3级/三持有者测试输入，不作为新局或B8获取证据。真实新局另有B6测试。唯一结算断言按所在1-2改为+2G/-3HP；选择阶段使用真实2-1。

## A086 · tests/match-economy.test.ts · @@ -44 +58 @@ describe('M5 atomic economy and independent ledger', () => {
旧值/旧输入：
```ts
    const state = readyMatch();
```
新值/新输入：
```ts
    const state = economyFixture();
```
理由：原纯命令经济向量明确改名economyFixture，显式保留10G/3级/三持有者测试输入，不作为新局或B8获取证据。真实新局另有B6测试。唯一结算断言按所在1-2改为+2G/-3HP；选择阶段使用真实2-1。

## A087 · tests/match-economy.test.ts · @@ -52 +66 @@ describe('M5 atomic economy and independent ledger', () => {
旧值/旧输入：
```ts
    let state = ledger(emptyBoard(), { type: 'buy', slot: 4, generation: 1 });
```
新值/新输入：
```ts
    let state = ledger(economyEmptyBoard(), { type: 'buy', slot: 4, generation: 1 });
```
理由：原纯命令经济向量明确改名economyFixture，显式保留10G/3级/三持有者测试输入，不作为新局或B8获取证据。真实新局另有B6测试。唯一结算断言按所在1-2改为+2G/-3HP；选择阶段使用真实2-1。

## A088 · tests/match-economy.test.ts · @@ -61 +75 @@ describe('M5 atomic economy and independent ledger', () => {
旧值/旧输入：
```ts
    rejects(readyMatch(), s => buyUnit(s, index, 1), 'invalid-slot');
```
新值/新输入：
```ts
    rejects(economyFixture(), s => buyUnit(s, index, 1), 'invalid-slot');
```
理由：原纯命令经济向量明确改名economyFixture，显式保留10G/3级/三持有者测试输入，不作为新局或B8获取证据。真实新局另有B6测试。唯一结算断言按所在1-2改为+2G/-3HP；选择阶段使用真实2-1。

## A089 · tests/match-economy.test.ts · @@ -64 +78 @@ describe('M5 atomic economy and independent ledger', () => {
旧值/旧输入：
```ts
    const state = ledger(readyMatch(), { type: 'buy', slot: 0, generation: 1 });
```
新值/新输入：
```ts
    const state = ledger(economyFixture(), { type: 'buy', slot: 0, generation: 1 });
```
理由：原纯命令经济向量明确改名economyFixture，显式保留10G/3级/三持有者测试输入，不作为新局或B8获取证据。真实新局另有B6测试。唯一结算断言按所在1-2改为+2G/-3HP；选择阶段使用真实2-1。

## A090 · tests/match-economy.test.ts · @@ -72 +86 @@ describe('M5 atomic economy and independent ledger', () => {
旧值/旧输入：
```ts
    const state = offer(readyMatch(), id);
```
新值/新输入：
```ts
    const state = offer(economyFixture(), id);
```
理由：原纯命令经济向量明确改名economyFixture，显式保留10G/3级/三持有者测试输入，不作为新局或B8获取证据。真实新局另有B6测试。唯一结算断言按所在1-2改为+2G/-3HP；选择阶段使用真实2-1。

## A091 · tests/match-economy.test.ts · @@ -94 +108 @@ describe('M5 atomic economy and independent ledger', () => {
旧值/旧输入：
```ts
    let state = { ...offer(readyMatch(), 'irelia'), nextUnitSerial: 5 };
```
新值/新输入：
```ts
    let state = { ...offer(economyFixture(), 'irelia'), nextUnitSerial: 5 };
```
理由：原纯命令经济向量明确改名economyFixture，显式保留10G/3级/三持有者测试输入，不作为新局或B8获取证据。真实新局另有B6测试。唯一结算断言按所在1-2改为+2G/-3HP；选择阶段使用真实2-1。

## A092 · tests/match-economy.test.ts · @@ -109 +123 @@ describe('M5 atomic economy and independent ledger', () => {
旧值/旧输入：
```ts
    let state = readyMatch();
```
新值/新输入：
```ts
    let state = economyFixture();
```
理由：原纯命令经济向量明确改名economyFixture，显式保留10G/3级/三持有者测试输入，不作为新局或B8获取证据。真实新局另有B6测试。唯一结算断言按所在1-2改为+2G/-3HP；选择阶段使用真实2-1。

## A093 · tests/match-economy.test.ts · @@ -119 +133 @@ describe('M5 atomic economy and independent ledger', () => {
旧值/旧输入：
```ts
    const input = { ...readyMatch(), gold: 2 }, next = ledger(input, { type: 'reroll' });
```
新值/新输入：
```ts
    const input = { ...economyFixture(), gold: 2 }, next = ledger(input, { type: 'reroll' });
```
理由：原纯命令经济向量明确改名economyFixture，显式保留10G/3级/三持有者测试输入，不作为新局或B8获取证据。真实新局另有B6测试。唯一结算断言按所在1-2改为+2G/-3HP；选择阶段使用真实2-1。

## A094 · tests/match-economy.test.ts · @@ -125 +139 @@ describe('M5 atomic economy and independent ledger', () => {
旧值/旧输入：
```ts
    let state = readyMatch();
```
新值/新输入：
```ts
    let state = economyFixture();
```
理由：原纯命令经济向量明确改名economyFixture，显式保留10G/3级/三持有者测试输入，不作为新局或B8获取证据。真实新局另有B6测试。唯一结算断言按所在1-2改为+2G/-3HP；选择阶段使用真实2-1。

## A095 · tests/match-economy.test.ts · @@ -137 +151 @@ describe('M5 atomic economy and independent ledger', () => {
旧值/旧输入：
```ts
    let state = ledger(readyMatch(), { type: 'buyXp' });
```
新值/新输入：
```ts
    let state = ledger(economyFixture(), { type: 'buyXp' });
```
理由：原纯命令经济向量明确改名economyFixture，显式保留10G/3级/三持有者测试输入，不作为新局或B8获取证据。真实新局另有B6测试。唯一结算断言按所在1-2改为+2G/-3HP；选择阶段使用真实2-1。

## A096 · tests/match-economy.test.ts · @@ -141 +155 @@ describe('M5 atomic economy and independent ledger', () => {
旧值/旧输入：
```ts
    expect(ledger({ ...readyMatch(), level: 8, xp: 75, gold: 4 }, { type: 'buyXp' })).toMatchObject({ level: 9, xp: 0, gold: 0 });
```
新值/新输入：
```ts
    expect(ledger({ ...economyFixture(), level: 8, xp: 75, gold: 4 }, { type: 'buyXp' })).toMatchObject({ level: 9, xp: 0, gold: 0 });
```
理由：原纯命令经济向量明确改名economyFixture，显式保留10G/3级/三持有者测试输入，不作为新局或B8获取证据。真实新局另有B6测试。唯一结算断言按所在1-2改为+2G/-3HP；选择阶段使用真实2-1。

## A097 · tests/match-economy.test.ts · @@ -144 +158 @@ describe('M5 atomic economy and independent ledger', () => {
旧值/旧输入：
```ts
    const state = freeze({ ...readyMatch(), gold: 0 });
```
新值/新输入：
```ts
    const state = freeze({ ...economyFixture(), gold: 0 });
```
理由：原纯命令经济向量明确改名economyFixture，显式保留10G/3级/三持有者测试输入，不作为新局或B8获取证据。真实新局另有B6测试。唯一结算断言按所在1-2改为+2G/-3HP；选择阶段使用真实2-1。

## A098 · tests/match-economy.test.ts · @@ -149,2 +163,2 @@ describe('M5 atomic economy and independent ledger', () => {
旧值/旧输入：
```ts
    const state = phase === 'choice' ? createMatch() : phase === 'combat' ? running : phase === 'settlement' ? finish(running)
      : accepted(startMatchCombat({ ...emptyBoard(), playerHp: 1 }));
```
新值/新输入：
```ts
    const state = phase === 'choice' ? reachRound('2-1',false) : phase === 'combat' ? running : phase === 'settlement' ? finish(running)
      : accepted(startMatchCombat({ ...economyEmptyBoard(), playerHp: 1 }));
```
理由：原纯命令经济向量明确改名economyFixture，显式保留10G/3级/三持有者测试输入，不作为新局或B8获取证据。真实新局另有B6测试。唯一结算断言按所在1-2改为+2G/-3HP；选择阶段使用真实2-1。

## A099 · tests/match-economy.test.ts · @@ -158 +172 @@ describe('M5 atomic economy and independent ledger', () => {
旧值/旧输入：
```ts
    let state = ledger(emptyBoard(), { type: 'deploy', id: 'unit-1', target: { kind: 'board', cell: { col: 0, row: 4 } } });
```
新值/新输入：
```ts
    let state = ledger(economyEmptyBoard(), { type: 'deploy', id: 'unit-1', target: { kind: 'board', cell: { col: 0, row: 4 } } });
```
理由：原纯命令经济向量明确改名economyFixture，显式保留10G/3级/三持有者测试输入，不作为新局或B8获取证据。真实新局另有B6测试。唯一结算断言按所在1-2改为+2G/-3HP；选择阶段使用真实2-1。

## A100 · tests/match-economy.test.ts · @@ -161 +175 @@ describe('M5 atomic economy and independent ledger', () => {
旧值/旧输入：
```ts
    expect(result).toMatchObject({ phase: 'settlement', playerHp: 95, gold: state.gold + 6, xp: 2 });
```
新值/新输入：
```ts
    expect(result).toMatchObject({ phase: 'settlement', playerHp: 97, gold: state.gold + 2, xp: 2 });
```
理由：原纯命令经济向量明确改名economyFixture，显式保留10G/3级/三持有者测试输入，不作为新局或B8获取证据。真实新局另有B6测试。唯一结算断言按所在1-2改为+2G/-3HP；选择阶段使用真实2-1。

## A101 · tests/match-lifecycle.test.ts · @@ -6 +7 @@ import {buyUnit,buyXp,deployMatchUnit,nextRound,rerollShop,sellUnit,startMatchCo
旧值/旧输入：
```ts
import {accepted,battle,deployed,finish,freeze,readyMatch,emptyBoard,resolveM5Choices} from './match-helpers';
```
新值/新输入：
```ts
import {accepted,battle,deployed,finish,freeze,readyMatch,emptyBoard,resolveM5Choices,reachRound} from './match-helpers';
```
理由：OPENING §3.1首场基础2G、失败3HP；原等级跨越测试改在真实2-1进行以保留3→4断言，HP因前三次让阵额外-9。其余升级、唯一结算和非法命令要求不变。

## A102 · tests/match-lifecycle.test.ts · @@ -24,4 +25,4 @@ describe('M5 lifecycle retains unique settlement and isolated snapshots',()=>{
旧值/旧输入：
```ts
  const prep=accepted(buyXp(emptyBoard())),settled=accepted(startMatchCombat(prep));
  expect(settled).toMatchObject({phase:'settlement',level:4,xp:0,gold:11,playerHp:95});
  expect(settled.roundResults[0]).toMatchObject({xpRequested:2,xpAwarded:2,levelBefore:3,levelAfter:4,xpBefore:4,xpAfter:0});
  const next=accepted(nextRound(settled,1));expect({shop:next.shop,rngState:next.rngState}).toEqual(shop(settled.rngState,2,4));
```
新值/新输入：
```ts
  const prep=accepted(buyXp(emptyBoard(reachRound('2-1')))),settled=accepted(startMatchCombat(prep));
  expect(settled).toMatchObject({phase:'settlement',level:4,xp:0,gold:11,playerHp:86});
  expect(settled.roundResults.at(-1)).toMatchObject({xpRequested:2,xpAwarded:2,levelBefore:3,levelAfter:4,xpBefore:4,xpAfter:0});
  const next=accepted(nextRound(settled,settled.round));expect({shop:next.shop,rngState:next.rngState}).toEqual(shop(settled.rngState,settled.shop.generation+1,4));
```
理由：OPENING §3.1首场基础2G、失败3HP；原等级跨越测试改在真实2-1进行以保留3→4断言，HP因前三次让阵额外-9。其余升级、唯一结算和非法命令要求不变。

## A103 · tests/match-lifecycle.test.ts · @@ -39 +40 @@ describe('M5 lifecycle retains unique settlement and isolated snapshots',()=>{
旧值/旧输入：
```ts
  expect(accepted(startMatchCombat(empty))).toMatchObject({phase:'settlement',playerHp:95,gold:16});
```
新值/新输入：
```ts
  expect(accepted(startMatchCombat(empty))).toMatchObject({phase:'settlement',playerHp:97,gold:2});
```
理由：OPENING §3.1首场基础2G、失败3HP；原等级跨越测试改在真实2-1进行以保留3→4断言，HP因前三次让阵额外-9。其余升级、唯一结算和非法命令要求不变。

## A104 · tests/match-lifecycle.test.ts · @@ -43,3 +44,3 @@ describe('M5 lifecycle retains unique settlement and isolated snapshots',()=>{
旧值/旧输入：
```ts
  const before={...emptyBoard(),playerHp:1,xp:5},terminal=accepted(startMatchCombat(freeze(before)));
  expect(terminal).toMatchObject({phase:'gameOver',outcome:'defeat',playerHp:0,gold:16,level:4,xp:1});expect(terminal.roundResults).toEqual([settlement(before,terminal.combat)]);
  expect(terminal.roundResults[0]).toMatchObject({playerDamage:5,hpLost:1});
```
新值/新输入：
```ts
  const before={...emptyBoard(),playerHp:1,level:3,xp:5},terminal=accepted(startMatchCombat(freeze(before)));
  expect(terminal).toMatchObject({phase:'gameOver',outcome:'defeat',playerHp:0,gold:2,level:4,xp:1});expect(terminal.roundResults).toEqual([settlement(before,terminal.combat)]);
  expect(terminal.roundResults[0]).toMatchObject({playerDamage:3,hpLost:1});
```
理由：OPENING §3.1首场基础2G、失败3HP；原等级跨越测试改在真实2-1进行以保留3→4断言，HP因前三次让阵额外-9。其余升级、唯一结算和非法命令要求不变。

## A105 · tests/match-lifecycle.test.ts · @@ -56 +57 @@ describe('M5 lifecycle retains unique settlement and isolated snapshots',()=>{
旧值/旧输入：
```ts
  expect(state.outcome).toBe('defeat');expect(state.playerHp).toBe(0);expect(state.round).toBeLessThan(35);expect(defeats).toBeGreaterThan(0);
```
新值/新输入：
```ts
  expect(state.outcome).toBe('defeat');expect(state.playerHp).toBe(0);expect(state.round).toBeLessThan(ROUND_CATALOG.length);expect(defeats).toBeGreaterThan(0);
```
理由：OPENING §3.1首场基础2G、失败3HP；原等级跨越测试改在真实2-1进行以保留3→4断言，HP因前三次让阵额外-9。其余升级、唯一结算和非法命令要求不变。

## A106 · tests/match-lifecycle.test.ts · @@ -61 +62 @@ describe('M5 lifecycle retains unique settlement and isolated snapshots',()=>{
旧值/旧输入：
```ts
  const end=accepted(startMatchCombat(state));expect(end.gold).toBe(state.gold+5);expect(end.playerHp).toBeLessThan(state.playerHp);
```
新值/新输入：
```ts
  const end=accepted(startMatchCombat(state));expect(end.gold).toBe(state.gold+2);expect(end.playerHp).toBeLessThan(state.playerHp);
```
理由：OPENING §3.1首场基础2G、失败3HP；原等级跨越测试改在真实2-1进行以保留3→4断言，HP因前三次让阵额外-9。其余升级、唯一结算和非法命令要求不变。

## A107 · tests/match-session.test.ts · @@ -4,2 +5,2 @@ import { createCombatWithEvents, type CombatEvent } from '../src/simulation/comb
旧值/旧输入：
```ts
import { createMatch, deployMatchUnit, type MatchCommandResult, type MatchState } from '../src/simulation/match';
import { readyMatch, emptyBoard } from './match-helpers';
```
新值/新输入：
```ts
import { createMatch, deployMatchUnit, nextRound, startMatchCombat, type MatchCommandResult, type MatchState } from '../src/simulation/match';
import { readyMatch, emptyBoard, accepted, reachRound, purchasedThreeHeroMatch } from './match-helpers';
```
理由：Session仍只转发真实Match。初始XP2升2级0XP；让阵2G/97HP。五次自然推进从1-3开始；F从2-2的3级2XP加4→4级0XP。24XP突发测试从1级起故5级4XP，初始serial2→最终14。

## A108 · tests/match-session.test.ts · @@ -44 +45 @@ describe('match session commands and fixed clock', () => {
旧值/旧输入：
```ts
    expect(settled.xp).toBe(2);
```
新值/新输入：
```ts
    expect(settled.xp).toBe(0);
```
理由：Session仍只转发真实Match。初始XP2升2级0XP；让阵2G/97HP。五次自然推进从1-3开始；F从2-2的3级2XP加4→4级0XP。24XP突发测试从1级起故5级4XP，初始serial2→最终14。

## A109 · tests/match-session.test.ts · @@ -113 +114 @@ describe('match session commands and fixed clock', () => {
旧值/旧输入：
```ts
    expect(session.state).toMatchObject({ gold: 16, playerHp: 95, xp: 2 });
```
新值/新输入：
```ts
    expect(session.state).toMatchObject({ gold: 2, playerHp: 97, level:2, xp: 0 });
```
理由：Session仍只转发真实Match。初始XP2升2级0XP；让阵2G/97HP。五次自然推进从1-3开始；F从2-2的3级2XP加4→4级0XP。24XP突发测试从1级起故5级4XP，初始serial2→最终14。

## A110 · tests/match-session.test.ts · @@ -126,2 +127,2 @@ describe('match session commands and fixed clock', () => {
旧值/旧输入：
```ts
    const session = new MatchSession(readyMatch());
    expect(session.buy(0, 1).ok).toBe(true);
```
新值/新输入：
```ts
    const session = new MatchSession(reachRound('1-3'));
    expect(session.buy(0, session.state.shop.generation).ok).toBe(true);
```
理由：Session仍只转发真实Match。初始XP2升2级0XP；让阵2G/97HP。五次自然推进从1-3开始；F从2-2的3级2XP加4→4级0XP。24XP突发测试从1级起故5级4XP，初始serial2→最终14。

## A111 · tests/match-session.test.ts · @@ -132 +133 @@ describe('match session commands and fixed clock', () => {
旧值/旧输入：
```ts
    for (let round = 1; round <= 5; round++) {
```
新值/新输入：
```ts
    for (let round = 2; round <= 6; round++) {
```
理由：Session仍只转发真实Match。初始XP2升2级0XP；让阵2G/97HP。五次自然推进从1-3开始；F从2-2的3级2XP加4→4级0XP。24XP突发测试从1级起故5级4XP，初始serial2→最终14。

## A112 · tests/match-session.test.ts · @@ -141 +142 @@ describe('match session commands and fixed clock', () => {
旧值/旧输入：
```ts
    expect(session.state.round).toBe(6); expect(session.state.shop.generation).toBe(6);
```
新值/新输入：
```ts
    expect(session.state.round).toBe(7); expect(session.state.shop.generation).toBe(7);
```
理由：Session仍只转发真实Match。初始XP2升2级0XP；让阵2G/97HP。五次自然推进从1-3开始；F从2-2的3级2XP加4→4级0XP。24XP突发测试从1级起故5级4XP，初始serial2→最终14。

## A113 · tests/match-session.test.ts · @@ -145,8 +146,10 @@ describe('match session commands and fixed clock', () => {
旧值/旧输入：
```ts
    const session = new MatchSession(readyMatch());
    expect(session.buy(0,session.state.shop.generation).ok).toBe(true);
    for (let i = 1; i <= 3; i++) expect(session.deploy(`unit-${i}`, { kind: 'board', cell: { col: i, row: 6 } }).ok).toBe(true);
    const capped = session.state; rejected(session, session.deploy('unit-4', { kind: 'board', cell: { col: 4, row: 7 } }), 'population-cap', capped);
    const shop = structuredClone(session.state.shop), rng = session.state.rngState;
    expect(session.buyXp().ok).toBe(true); expect(session.buyXp().ok).toBe(true);
    expect(session.state).toMatchObject({ level: 4, xp: 2, gold: 1, rngState: rng, shop });
    expect(session.deploy('unit-4', { kind: 'board', cell: { col: 4, row: 7 } }).ok).toBe(true);
```
新值/新输入：
```ts
    const prepared=accepted(nextRound(accepted(startMatchCombat(emptyBoard(purchasedThreeHeroMatch()))),getCatalogRoundById('2-1').ordinal));
    const session=new MatchSession(prepared);
    const slot=session.state.shop.slots.findIndex(o=>o.status==='available'&&!['irelia','maddie','lux'].includes(o.definitionId));
    expect(session.buy(slot,session.state.shop.generation).ok).toBe(true);
    for(let i=1;i<=3;i++) expect(session.deploy(`unit-${i}`,{kind:'board',cell:{col:i,row:6}}).ok).toBe(true);
    const capped=session.state;rejected(session,session.deploy('unit-4',{kind:'board',cell:{col:4,row:7}}),'population-cap',capped);
    const shop=structuredClone(session.state.shop),rng=session.state.rngState,gold=session.state.gold;
    expect(session.buyXp().ok).toBe(true);
    expect(session.state).toMatchObject({level:4,xp:0,gold:gold-4,rngState:rng,shop});
    expect(session.deploy('unit-4',{kind:'board',cell:{col:4,row:7}}).ok).toBe(true);
```
理由：Session仍只转发真实Match。初始XP2升2级0XP；让阵2G/97HP。五次自然推进从1-3开始；F从2-2的3级2XP加4→4级0XP。24XP突发测试从1级起故5级4XP，初始serial2→最终14。

## A114 · tests/match-session.test.ts · @@ -157 +160 @@ describe('match session commands and fixed clock', () => {
旧值/旧输入：
```ts
    const session = new MatchSession({ ...initial, nextUnitSerial: 5, preparation:{...initial.preparation,units:[...initial.preparation.units,
```
新值/新输入：
```ts
    const session = new MatchSession({ ...initial, gold:10, nextUnitSerial: 5, preparation:{...initial.preparation,units:[...initial.preparation.units,
```
理由：Session仍只转发真实Match。初始XP2升2级0XP；让阵2G/97HP。五次自然推进从1-3开始；F从2-2的3级2XP加4→4级0XP。24XP突发测试从1级起故5级4XP，初始serial2→最终14。

## A115 · tests/match-session.test.ts · @@ -183 +186 @@ describe('rapid D/F/E commands without frame or animation waits', () => {
旧值/旧输入：
```ts
  const odds: Record<number, number[]> = { 3: [75,25,0,0,0], 4: [55,30,15,0,0], 5: [45,33,20,2,0] };
```
新值/新输入：
```ts
  const odds: Record<number, number[]> = { 1:[100,0,0,0,0], 2:[100,0,0,0,0], 3: [75,25,0,0,0], 4: [55,30,15,0,0], 5: [45,33,20,2,0] };
```
理由：Session仍只转发真实Match。初始XP2升2级0XP；让阵2G/97HP。五次自然推进从1-3开始；F从2-2的3级2XP加4→4级0XP。24XP突发测试从1级起故5级4XP，初始serial2→最终14。

## A116 · tests/match-session.test.ts · @@ -199 +202 @@ describe('rapid D/F/E commands without frame or animation waits', () => {
旧值/旧输入：
```ts
    let gold = 200, level = 3, xp = 0, generation = 1, serial = 4, reference = referenceShop(seed, level);
```
新值/新输入：
```ts
    let gold = 200, level = 1, xp = 0, generation = 1, serial = 2, reference = referenceShop(seed, level);
```
理由：Session仍只转发真实Match。初始XP2升2级0XP；让阵2G/97HP。五次自然推进从1-3开始；F从2-2的3级2XP加4→4级0XP。24XP突发测试从1级起故5级4XP，初始serial2→最终14。

## A117 · tests/match-session.test.ts · @@ -219 +222 @@ describe('rapid D/F/E commands without frame or animation waits', () => {
旧值/旧输入：
```ts
      while (xp >= ({ 3: 6, 4: 10, 5: 20 } as Record<number, number>)[level]) { xp -= ({ 3: 6, 4: 10, 5: 20 } as Record<number, number>)[level]; level++; }
```
新值/新输入：
```ts
      while (xp >= ({ 1:2, 2:2, 3: 6, 4: 10, 5: 20 } as Record<number, number>)[level]) { xp -= ({ 1:2, 2:2, 3: 6, 4: 10, 5: 20 } as Record<number, number>)[level]; level++; }
```
理由：Session仍只转发真实Match。初始XP2升2级0XP；让阵2G/97HP。五次自然推进从1-3开始；F从2-2的3级2XP加4→4级0XP。24XP突发测试从1级起故5级4XP，初始serial2→最终14。

## A118 · tests/match-session.test.ts · @@ -226 +229 @@ describe('rapid D/F/E commands without frame or animation waits', () => {
旧值/旧输入：
```ts
    expect(state).toMatchObject({ gold: 152, level: 5, xp: 8, nextUnitSerial: 16, shop: { generation: 13 } });
```
新值/新输入：
```ts
    expect(state).toMatchObject({ gold: 152, level: 5, xp: 4, nextUnitSerial: 14, shop: { generation: 13 } });
```
理由：Session仍只转发真实Match。初始XP2升2级0XP；让阵2G/97HP。五次自然推进从1-3开始；F从2-2的3级2XP加4→4级0XP。24XP突发测试从1级起故5级4XP，初始serial2→最终14。

## A119 · tests/round-enemies.test.ts · @@ -8 +10 @@ describe('deterministic round enemy templates', () => {
旧值/旧输入：
```ts
    for (let round = 1; round <= 35; round++) {
```
新值/新输入：
```ts
    for (const {ordinal:round} of ROUND_CATALOG) {
```
理由：同一2+阶段敌阵数字不变，改按目录roundId定位；遍历上界由ROUND_CATALOG给出，不批量35→38。

## A120 · tests/round-enemies.test.ts · @@ -26,3 +28,3 @@ describe('deterministic round enemy templates', () => {
旧值/旧输入：
```ts
    expect([1,2,3,4,5,6,7,9,10].map(round => createRoundEnemies(round).length)).toEqual([3,3,3,0,4,4,3,5,5]);
    expect([15,22,29].map(round => createRoundEnemies(round).length)).toEqual([6,7,8]);
    expect(createRoundEnemies(35).map(unit => [unit.definitionId, unit.starLevel])).toEqual([['neutral-stage-6',1]]);
```
新值/新输入：
```ts
    expect(['2-1','2-2','2-3','2-4','2-5','2-6','2-7','3-2','3-3'].map(id => createRoundEnemies(getCatalogRoundById(id).ordinal).length)).toEqual([3,3,3,0,4,4,3,5,5]);
    expect(['4-1','5-1','6-1'].map(id => createRoundEnemies(getCatalogRoundById(id).ordinal).length)).toEqual([6,7,8]);
    expect(createRoundEnemies(getCatalogRoundById('6-7').ordinal).map(unit => [unit.definitionId, unit.starLevel])).toEqual([['neutral-stage-6',1]]);
```
理由：同一2+阶段敌阵数字不变，改按目录roundId定位；遍历上界由ROUND_CATALOG给出，不批量35→38。

## A121 · tests/round-enemies.test.ts · @@ -30 +32 @@ describe('deterministic round enemy templates', () => {
旧值/旧输入：
```ts
    expect(() => createRoundEnemies(36)).toThrow(RangeError);
```
新值/新输入：
```ts
    expect(() => createRoundEnemies(ROUND_CATALOG.length+1)).toThrow(RangeError);
```
理由：同一2+阶段敌阵数字不变，改按目录roundId定位；遍历上界由ROUND_CATALOG给出，不批量35→38。

## A122 · tests/m5-runtime-import.test.ts · transient-record setup
旧输入：`startMatchCombat(readyMatch())`，旧初始PvP战斗期望可观测shieldLayers/statuses/tasks。
新输入：`startMatchCombat(purchasedThreeHeroMatch())`，通过真实开场推进和2-1商店购买进入原PvP语义场景。
理由：当前1-2中立占位没有原敌方技能状态；15条篡改拒绝断言全部保留并实际执行，不把beforeAll跳过记为通过。

## A123 · scripts/verify-m5-headless.cjs · terminal ordinal
旧值：seed42路线`assert.equal(route.summary.round,35)`。
新值：`assert.equal(route.summary.round,ROUND_CATALOG.at(-1).ordinal)`，目录从同一Vite加载环境读取。
理由：最终节点为目录6-7；胜利/成型>=3/异常出战>=2、采样、重复次数、24 seeds、时钟、RSS与事件账本测量全部不改。

## A124 · scripts/verify-m7-presentation.cjs · help shortcut precondition
旧输入：新局选择完毕便直接打开帮助；旧起手10G可支付D/F。
新输入：先用既有benchEveryone/advanceTo公开让阵至1-4，确认2+3=5G；再打开帮助。原完整状态不变及关闭帮助后扣2G断言原样保留，手算5→3。
理由：新起手0G无法验证D是否恢复；至少5G才能同时让D与F具备真实可执行前提。该准备与后续firstBattle/reduced-motion测量是独立newGame，不改变后者场景。

## A125 · scripts/verify-m7-presentation.cjs · help-over-reward target
旧输入：`advanceTo(page,7)`，旧语义2-7。
新输入：`advanceTo(page,'2-7')`，helper按state.m8.round.roundId定位；新帮助准备同样按'1-4'定位。
理由：仅目录身份迁移。2-7战后必须出现choice的断言保留，B8未接时仍失败；不改成补给或其他模态场景来放过门禁。

## N001 · tests/m8-b6-match-wiring.test.ts · new, not a legacy assertion change
首轮全量中新增强阵容fixture超过默认5秒。改为明确标注的九名三星凯特琳、每人三件deathblade（死亡之刃），以减少无关战斗tick；完整38轮、33战、36～38各phase恢复、终点、篡改拒绝断言不变。没有增加timeout或跳过测试。该输入不证明正常获取或B8收益链。

## A126 · tests/m6-replay.test.ts · after-choice search bound
旧输入：最多7场战斗内寻找战后choice，隐含旧起点2-1。
新输入：按目录检索到原奖励节点2-7（含本轮），保留必须遇见战后choice及冻结历史引用全部断言。
理由：新起点增加三场开场；搜索上界按稳定roundId推导，不把不存在的B8奖励误判为纯循环提前停止，也不改为检查准备期/补给choice。

## A127 · tests/m5-route.test.ts · B8 dependency assertions split
旧：四条真实路线测试遇formed>=3立即失败，后续断言无法执行；三普通路线还要求transitioned、过渡棋卖出返装、15组件。
新：四条路线仍实际执行golden/独立账本/胜利/异常/四来源/升星/锁店/Caitlyn伤害/终态拒绝；上述缺B8英雄/组件链的原断言移入四个明确[B8] it.skip，代码与数值原样保留。
理由：用户新授权只跳跨批次断言。定向发现transitioned=false后按实现核查，原过渡英雄来自已删除起手麦迪/拉克丝包，buyShop不会另购非最终编队成员；返装随该过渡链缺失，归B8而非改false为成功。

## A128 · tests/m6-integration.test.ts · B9 positive full-envelope split
旧：完整33战validateEnvelope要求通过，在30战容量处失败并遮蔽后续前缀断言；删第一战负例仍32>30，存在容量假阳性。
新：仅四构筑完整存档正向断言拆成四个[B9] it.skip，原满档删战断言一并保留；普通测试继续逐战回放及2战+当前战prefix，后者新增删整战必须明确报“历史缺战或重战”。
理由：不扩大B9容量，不把已执行回放计为skip，也不让容量限制冒充缺战校验通过。

## A129 · tests/m6-replay.test.ts · B8 after-choice split
旧：真实战后choice场景要求sawChoice=true。
新：完整场景原代码保留为[B8] it.skip；普通首场结束新增同样的冻结history/snapshot引用检查，继续真实执行。
理由：缺B8战后choice只影响依赖的场景，不连带取消冻结引用覆盖。

## A130 · scripts/verify-m5-headless.cjs · B8 formed-only deferral
旧：seed42在formedBattles>=3退出。
新：仅该断言callback保留且记录SKIPPED [B8]；其他路线/seed/重复/胜利/异常/账本/测量均执行。
理由：最新用户授权；不改3为0、不改采样和门槛，manifest.skipped可审查。

## A131 · scripts/verify-m5-input.cjs · legal setup and first-combat scope
旧：reset即10G/三英雄/两组件；起手背靠背组件模态、羊刀Lux首战。
新：快捷键先合法三场2+3+5=10G；DDFE后10-2-2-4+1=3，原失败F仍保留。普通模态改真实2-1强化并断言执行次数>0；单组件操作真实到2-4取1件，再Continue到2-5装备准备。仅连续起手组件与原首战羊刀链/动态AS明确B8跳过，原断言代码保留。
新首战仍独立New Match回1-2，空历史/空物品/仅unit-1，六项当前属性UI对照改读真实选中的unit-1；普通原速战斗、整账本、4Hz观察、帧窗口、重开清理不改。证据重命名current-stats不冒称动态AS。
理由：真实合法前置不能被误列为B8；不把3-4或合成假资源替换首次战斗测量。

## A132 · scripts/verify-m7-presentation.cjs · B8 F02-only deferral
旧：要求2-7战后phase=choice、模态层保持帮助焦点、选择奖励后items+1。
新：F02依赖段原样callback保留并明确SKIPPED [B8]；其他帮助、双激活、首战/replay/404头像继续。
理由：CI140已实际跑到该断言，得到settlement；不是UI回归或本机浏览器偶发。

## A133 · scripts/verify-m5-browser.cjs · random/fixed seed reroll setup
旧：random/fixed两路新开场直接D，默认可付2G。
新：两路都用同样公开空阵1-2失利，Continue到1-3取得2G后重抽，仍比较接受结果、完整state、events和RNG。
理由：新起手0G下恢复真正可执行前提；不跳种子复现或改成失败命令一致。

## A134 · scripts/m6-layout-product-smoke.cjs · real focus modal
旧：新局即等待起手choice焦点。
新：公开空阵走完开场，到2-1真实强化choice再执行原Tab/Shift+Tab与CSS/旋转/触摸断言。
理由：无起手模态不能导致空测或被当B8跳过；布局阈值/动作保留。

## A135 · tests/m6-application-failures.cjs · catalog anchors and explicit dependencies
旧：最终round35、30战；initial_component_0/1及reward_choice混合旧起手包/后PvE。
新：终轮由ROUND_CATALOG末项、战数由kind!=supply推导；缺1-3/1-4开场choice与真正post_pve_choice分别B8跳过，现有supply_choice继续。G02仅明确game_over超限样本B9跳过；其他超限标签直接失败要求复核。ROOT03、P2两个分支、R4首次import即被满档容量阻止，各自callback完整保留为B9跳过；其余G04/ROOT04与容量内G02全跑。
理由：不改实际30战容量或30/90历史断言，不裁剪档案伪造有效存档；满档应用竞争尚待B9，不宣称通过。

## A136 · scripts/verify-m5-browser.cjs and compare-m5-evidence.cjs · B9 exact browser tail
旧：应用33战全路线，31战后抛冻结边界错误，6-6tick0触发原75秒timeout；比较器要求全部browser snapshot存在。
新：严格到现有30战容量，6-4补给仍跑，6-5准备state必须等于完整领域路线下一start.before；只有6-5/6-6/6-7原战斗/后续命令/快照/完整终态断言明确B9跳过。完整33战领域route全文比较、前30场浏览器快照与全部命令checkpoint比较继续；未知缺文件/未知skip/双方不一致直接失败。fullApplicationRoutePassed=false与独立skipped证据防止误称完整应用通过。
理由：CI140原始artifact已确认B9实际边界；用户批准精确尾段与透明比较，不改75秒/CI/性能阈值，不伪造浏览器输出。冻结30仅用于测试边界，并由单测校验必须等于生产MAX_BATTLE_RECORDS；尾轮身份精确来自目录且只允许6-5/6-6/6-7。

## A137 · tests/m6-integration.test.ts · B8 sold-opening-history subcase
旧：cannon完整路线必须实际sell且历史仍含已售棋子。
新：两条原断言保留为单独[B8] it.skip；其余cannon逐战/前缀/缺战/暂停/篡改检查继续。
理由：缺原起手麦迪/拉克丝，真实路线只买最终编队，所以没有原过渡售出；普通合法卖棋冻结历史仍由m6-replay覆盖。此次不是B9容量断言，不混写归属。

## A138 · scripts/compare-m6-evidence.cjs · exact application-dependency consumption
旧：G02全部phase及ROOT03/P2/R4无条件必须有passed:true；阶段标签仍initial_component_0/1/reward_choice。
新：G02活跃10个样本（含真正supply_choice）全部仍必通过；只对已列B8开场1-3/1-4/post-PvE和B9终态、ROOT03/P2/R4逐项保留原通过断言callback为明确skip。严格核验上游完整8项skip集合与G02样本集合，未知缺失不放过。原30/90/117断言留在对应B9 callback，未改阈值。
理由：用户授权的应用场景skip必须被聚合器透明识别，不能伪造passed:true；没有更改该文件性能测量分组。
