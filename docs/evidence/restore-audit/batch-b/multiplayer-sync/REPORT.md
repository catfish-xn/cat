# PR #168 同步 multiplayer 311017e

## 固定边界与冲突

- B 起点：8e81bc5f8b2d84e34c0e8f34999ced4179f204c9。
- 实际 fetch 最新 multiplayer：311017e3b10e0f244287cb8716fc52c831310cc4。
- merge：fa5c1ac3491147065088358a42dc4b800b593883，两个父提交原样保留。
- 唯一文本冲突：serialization.ts 顶部 import。保留 B 的 validatePreparationLedger/createPreparationLedgerValidator 和基线 readG23Progress/crownTeamSizeBonus/validateResistsShields 全部导入。
- 冠冕人口上限、护盾可信编译恢复核对原样集成；B 的 detached 后账本核对、事件序号和进程精确缓存保持。
- 本轮不升版本，不另改规则/数值/timeout。基线上游已有 revision/digest/夹具通过 merge 原样保留，不能误报为本分支重新录制。

## 真实依赖缺失

当前基线仅合入 #148 冠冕人口，并没有 #157 冠冕赢金实现/历史恢复 API。tests/g2-4a-crown-gold.test.ts 不存在；实际有 tests/g2-4a-crown.test.ts。未偷偷合入其他候选分支，不能宣称已经验证真实冠冕赢金跨轮组合。

普通真实对局 seed1/42 下一准备期只改 gold+1 的对象/JSON/collection/envelope/file 负例仍由 B 测试覆盖。冠冕赢金组合要待实际前置合入后再测。

## 夹具边界

record-g2-3-inputs.cjs --check、默认写、再次 --check 均成功，9cases；digest fnv1a32-utf16:793e0884，零本地额外变化。

五份 Herald 旧 raw 均无 preparationLedger；本轮按已明确决定保留，不执行 --write、不伪造账本。此前默认 verify 的5份真实生成及恢复正控通过但旧字节不一致的证据继续有效说明迁移边界，不冒充当前merge SHA执行。当前要求的 B7 文件仍直接运行，缺账本失败如实记录。未来统一升版本按 release→Herald write→inputs→live-reveal 迁移。

## 受测 merge SHA 结果（未全绿）

B5 9/9（26.34s）；其余 14 文件 222 过 /21 失败（314.04s），合计 231 过 /21 失败 /0 跳过。typecheck 通过。

失败项如下，完整日志和逐例 JSON 均保留：

|文件/用例|耗时ms|原因|
|---|---:|---|
|tests/g2-4b-resists-restore.test.ts / public equipped live shield restores unchanged and continues identically|167|Error: Invalid Match save: preparation-ledger-command-rejected|
|tests/g2-4b-resists-restore.test.ts / restores live targeting-dependent resists, refreshes, absorption, expiry and combat end|108|Error: Invalid Match save: preparation-ledger-command-rejected|
|tests/g2-4b-resists-restore.test.ts / restores the holder-death grant after live defenses and periodic history|990|Error: Invalid Match save: preparation-ledger-command-rejected|
|tests/g2-4b-resists-restore.test.ts / restores stacked crest/gargoyle/bracer from object and matches every tick through the next battle|821|Error: Invalid Match save: preparation-ledger-command-rejected|
|tests/g2-4b-resists-restore.test.ts / restores stacked crest/gargoyle/bracer from JSON and matches every tick through the next battle|645|Error: Invalid Match save: preparation-ledger-command-rejected|
|tests/m8-b7-match-wiring.test.ts / B7 installed encounters and trusted Match restore 2-7 freezes, starts, runs to settlement and resumes canonical saves|9311|Error: Test timed out in 5000ms.|
|tests/m8-b7-match-wiring.test.ts / B7 installed encounters and trusted Match restore 3-7 freezes, starts, runs to settlement and resumes canonical saves|17670|Error: Test timed out in 5000ms.|
|tests/m8-b7-match-wiring.test.ts / B7 installed encounters and trusted Match restore 4-7 freezes, starts, runs to settlement and resumes canonical saves|32302|Error: Test timed out in 5000ms.|
|tests/m8-b7-match-wiring.test.ts / B7 installed encounters and trusted Match restore 5-7 freezes, starts, runs to settlement and resumes canonical saves|57994|Error: Test timed out in 5000ms.|
|tests/m8-b7-match-wiring.test.ts / B7 installed encounters and trusted Match restore 6-7 freezes, starts, runs to settlement and resumes canonical saves|91545|Error: Test timed out in 5000ms.|
|tests/m8-b7-match-wiring.test.ts / B7 installed encounters and trusted Match restore 3-7 separates captured initial events from tick-zero opening moves committed by the first step|5404|Error: Test timed out in 5000ms.|
|tests/m8-b7-match-wiring.test.ts / B7 installed encounters and trusted Match restore 6-7 separates captured initial events from tick-zero opening moves committed by the first step|22406|Error: Test timed out in 5000ms.|
|tests/m8-b7-match-wiring.test.ts / B7 installed encounters and trusted Match restore rejects replayed, removed, cancelled and geometry-mutated opening consumption for 6-7|7767|Error: Test timed out in 5000ms.|
|tests/m8-b7-match-wiring.test.ts / B7 installed encounters and trusted Match restore restores Herald action identity after earlier tick-one aura maintenance: undefined|22023|Error: Test timed out in 5000ms.|
|tests/m8-b7-match-wiring.test.ts / B7 installed encounters and trusted Match restore restores Herald action identity after earlier tick-one aura maintenance: "ionic-spark"|19|Error: Invalid Match save: preparation-ledger-missing|
|tests/m8-b7-match-wiring.test.ts / B7 installed encounters and trusted Match restore restores Herald action identity after earlier tick-one aura maintenance: "evenshroud"|9|Error: Invalid Match save: preparation-ledger-missing|
|tests/m8-b7-match-wiring.test.ts / B7 installed encounters and trusted Match restore restores Herald action identity after earlier tick-one aura maintenance: "ionic-spark"|9|Error: Invalid Match save: preparation-ledger-missing|
|tests/m8-b7-match-wiring.test.ts / B7 installed encounters and trusted Match restore round-trips legal Herald item immunity/cleanup boundaries with quicksilver|11|Error: Invalid Match save: preparation-ledger-missing|
|tests/m8-b7-match-wiring.test.ts / B7 installed encounters and trusted Match restore round-trips legal Herald item immunity/cleanup boundaries with edge-of-night|10|Error: Invalid Match save: preparation-ledger-missing|
|tests/m8-b7-match-wiring.test.ts / B7 installed encounters and trusted Match restore rejects deletion of active Herald control, its receipt, or both, and forged cleanup|7791|Error: Test timed out in 5000ms.|
|tests/m8-b7-match-wiring.test.ts / B7 installed encounters and trusted Match restore restores real bird next-tick reactions and rejects changed effects, death identity and missing consumption|11080|Error: Test timed out in 5000ms.|

### 分类与后续建议

1. 护盾5个正控：publicStart 在 tests/g2-4b-resists-restore.test.ts:20 直接调用 grantMechanicItem，source=resists-restore-test、receipt=resists-slot；此赠装没有玩家公开命令轨迹。后续 equip 因重演没有该赠装实例被拒。不能为兼容测试把任意自报赠装列入可信命令。建议另获授权后将测试准备改为真实奖励取得装备的轨迹；本次没有改测试来源或弱化恢复。其余护盾反例检查仍执行通过。
2. Herald5项：旧raw缺账本，严格拒绝是当前指定旧档政策；待统一升级版本后合法重录。
3. B7其余11项：真实原5秒超时，不属于旧fixture问题。该文件每战多个不同tick分别恢复完整历史，完整输入精确缓存无法复用不同输入；当前33场collection的单次顺推不会自动应用于独立restore调用。本次没有新增优化或改时限，建议单独决定是否针对可信历史证明/测试生命周期做设计；不能自动扩大跨调用前缀复用。

没有运行不存在的 crown-gold.test，也没有冠冕赢金真实结算可验。没有执行全套或远端CI。这个merge保留正确性边界，但相关测试未全绿，不宣布可合入。
