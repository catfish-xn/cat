# 增幅池 batch 3 独立验货报告

验货分支：`codex/augment-batch3-verify`；HEAD：`2b614a4e60330d92db8c8ced1b62938ca9a8705d`，与 `origin/claude/augment-pool-batch3` 相同。以 Codex 的测试/审计角色执行。没有提交、没有写入 `.git`；仓库内仅新增三个测试文件。请求未给出 `-o` 实际路径，报告暂存于本文件。

## 发现

### B3-V1：免费刷新消耗可以通过存档篡改退回（高）

定位：`src/simulation/free-rerolls.ts:27`、`:29`、`:31`（读取使用量见 `:16`）。恢复校验只验证 `used` 的形状及上界，记录缺失时直接接受，也不把有效范围内的数值与真实刷新操作核对。

复现完全由公开命令开始：公开选择 D个痛快！I（11 次）；执行一次 `rerollShop`，确认只剩 10 次；将合法存档中的 `seatMechanics.seat["free-shop-rerolls"]` 删除，`restoreMatch` 仍成功。或公开执行两次刷新后，将 `used=2` 改成 `used=1`，恢复也成功。按照读取使用量的规则，分别退回至 11 次和 10 次。金币、商店与原有刷新历史均保留，恢复不会拒绝这项篡改。

独立依据：`/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json`，零基记录 **55**，`apiName=TFT9_Augment_Commander_RollingForDays`，`Numrolls=11`；免费次数被消费后不应通过改存档重新增加。

测试：`tests/augment-batch3-verify-public.test.ts` 中两个 `G2 anti-tamper` 用例使用 `it.fails`；保留“恢复必须抛错”的断言。正常领取、11 次免费后第 12 次付 2 金、超上限篡改拒绝均由普通测试覆盖。此发现限于本地存档恢复，未断言远程服务器接受客户端存档。

### B3-V2：辅助挖矿正常退休状态无法存档或恢复（高）

定位：`src/simulation/augment-pool-batch3-progress.ts:171`–`:174` 发出合法 `unit-removed` 退休事实；`src/simulation/b8-restore.ts:548` 的当前资源后缀回放未消费此事实，随后把它当成必须符合 `settlement-capacity` 卖出条件的剩余条目，报 `RangeError: Invalid B8 Match: capacity sale boundary`。

复现：公开选择辅助挖矿/辅助挖矿+；公开部署其假人并逐场结算，按真实假人死亡数计数，选秀回合正常推进。第 **7/4 次**死亡时分别确认只有一件奖励且假人已移除；此时 `serializeMatch(state)` 拒绝正常状态。另以 `restoreMatch(JSON.stringify(state))` 直接验证，同样拒绝，排除了只在序列化入口失败的解释。

独立依据：同一 `augments-14.24.json` 零基记录 **59/60**，`apiName=TFT_Augment_SupportMining / TFT_Augment_SupportMiningPlus`，`NumDeaths=7/4`，描述要求发辅助装备并移除假人。正常退休是预期业务状态。

测试：真实死亡阈值和移除由普通用例通过；两个版本的序列化与直接恢复各一个，共 **4 个 `it.fails`**。这些用例没有修改战斗事实、金币、强化所有权或资源来源账本。

## 新增文件与覆盖

- `tests/augment-batch3-verify-source.test.ts`：手抄 44 条记录的 apiName、中文名、等级与完整效果常量（包括 null/哈希字段），并锁定完整清单防止漏测；检查入池、不重复持有、2-1 不羁绊定向、3-2/4-2 的每条英雄羁绊链接、无关联羁绊的强化不被误过滤、外部封锁、双向互斥和无互斥的正例。没有运行时读取研究 JSON，也未导入已有 batch-3 oracle 作为期望值。
- `tests/augment-batch3-verify-public.test.ts`：44 条均经真实公开选择；覆盖即时物品/复制器/锻造器、免费刷新费用、假人与永久纹章、六英雄进战后的源系数、七个 G6 战斗声明、炽热灵魂实际 AP/攻速贡献及三秒交接、G1 真实 PvP 奖励阈值、每次失败 2 金与第 4 次基础装备、值得等待的星级/费用/同名延后复制、珍藏财宝六次发放、金蛋无胜场时 11 次回合进入孵化、崇高冒险三个不同 2 费和次级复制器。普通存档逐字段往返；战斗继续结果一致；篡改领取时间、删除新资源、改动假人星级/纹章归属/战斗系数/贡献、删除奖励收据均要求恢复拒绝。
- `tests/augment-batch3-verify-loot.test.ts`：手抄金蛋 A–I、崇高冒险 A–F 全部奖励及权重；独立核查战争财宝三档、21 张表的 1/2/3 金字段数量及 Table0 开头的稀疏键，含缺失键。

## 原始资料定位

1. `/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json`：每项 apiName、零基记录号与手抄常量在 source 测试的元组中逐条注明。英雄关联记录为 **3/10/66/89/103/119**。其中 FishCarry 的关联是 `TFT13_Titan/TFT13_Crime`；Crime 由同档 `TFT13_Augment_ChembaronCrest` 交叉确认映射炼金男爵，不能按斯特卜本体职业猜为执法官。英雄与 Geniuses 的互斥按后者记录的反向边验证。
2. `/home/aiapps/workspace/augment-crossversion-research-2026-10-24/raw/common/14.24-map22.bin.json`：金蛋分布记录 **{95529e6b}**；A–I 分别 **{94f3596c}/{97f35e25}/{96f35c92}/{91f354b3}/{90f35320}/{93f357d9}/{92f35646}/{9df36797}/{9cf36604}**。崇高冒险分布 **{b1c71adb}**；A–F 分别 **{1f7039a5}/{1c7034ec}/{1d70367f}/{1a7031c6}/{1b703359}/{18702ea0}**。
3. 同研究包 `excerpts/clones_loot/14.24-spoils-values-and-table-audit.json` 的 **gold_table_field_inventory**，记录名 `TFT9_Augment_Spoils_Tier{1,2,3}Table{0..6}`；Table0 原始记录 **{dd92c261}/{583e76e4}/{05d241c7}**。

## 结论边界

未发现这 44 条手抄身份/等级/常量及所测奖励表与档案不一致。源浮点数按六位小数消除 float32 表示噪声；整数、字段集合和 null 精确断言。

跨版本包明确没有证实战争财宝数字键含义、七表选择方式、BonusLoot 调用时机；本次没有将实现中的“第 k 次击杀读 3k 键”或表选择 RNG 当成独立的 14.24 真值。英雄几何/选敌/跳频、炽热灵魂首 tick 的相位、选秀顺延及部分调度仍是项目 P 口径，原始静态数值不能证明这些运行时决策。测试观察到的三秒交接不构成官方执行代码证据。

本次公开流程没有穷尽赏金战士五胜、以眼还眼全部上限、健康就是财富累计 10000 治疗发金、崇高冒险两个三星期限、每个英雄完整施法伤害及每档战争财宝随机掉落；这些条目有身份/常量/入池与公开领取/存档覆盖，但不能据此宣称整套机制已完整认证。未完成组 G4、其余 G8 等不在本次实现范围。

## 验证

最终定向测试：**3 个文件通过，178 项普通测试通过，6 项已确认缺陷的预期失败，共 184 项；退出码 0，22.65 秒。** `npm run typecheck` 已通过（退出码 0）。命令：

```bash
export PATH=$HOME/.local/bin:$PATH
npm test -- --configLoader runner --maxWorkers 1 tests/augment-batch3-verify-source.test.ts tests/augment-batch3-verify-public.test.ts tests/augment-batch3-verify-loot.test.ts
npm run typecheck
```

`--configLoader runner` 用于避免默认加载器向只读的共享 `node_modules/.vite-temp` 写临时配置。只运行以上新增文件，没有运行完整测试套件；没有改动现有测试、src、证据、fixtures 或 scripts。
