# 存档一致性 A 批（一）：A1 / A3 历史重演

仓库：catfish-xn/cat；分支：`codex/save-audit-a-replay`。
开工先 fetch，随后 ls-remote 核实并显式拉取 multiplayer，基线为 `0719ced60ade353a238024d757cf9440701f6aaa`。

## 完成内容及位置

| 位置 | 结果 |
| --- | --- |
| `src/simulation/serialization.ts:10` | object / JSON 两入口：任何已结算战斗均要求完整 `battles`；序列化同样要求证据，缺证旧孤立 Match 直接拒绝。 |
| `src/simulation/battle-record-validation.ts:98` | 复用既有重演缓存，改用完整规范化记录内容作键；有界 66 条。外部输入先复制并冻结，缓存仅含真实重演成功的私有结果，公开返回另行复制。 |
| `src/simulation/battle-record-validation.ts:107` | 单条回放先校验其完整已结算历史，再重演当前记录。 |
| `src/simulation/battle-record-validation.ts:186` | 历史经济、资源（含 sourceDeltas）、机制、装备前缀均须继承已验证结算；历史 earnedEvidence 额外逐项绑定真实源死亡 tick / eventSeq，`combat=null` 后仍验证。 |
| `src/simulation/battle-record-validation.ts:213` | 每条 BattleRecord 从已核来源的开战上下文，通过原 Start / Step 生产规则重演，核对所有事件、终局、胜负、幸存者和结算。原结算内的 g23BattleFacts 重新推导各项事实；Tristana 增量来自真实击杀触发。按轮顺序走一次完整历史。 |
| `src/simulation/g2-3-restore.ts:24` | 每个非 supply 已结算轮必须恰好一条 facts，不能缺失或重复。 |
| `src/replay/history.ts:78` | 恢复当前记录前缀时总是传完整已完成历史。 |
| `docs/MATCH_CONTRACT.md:77` | 更新函数合同、拒绝原因、缺证策略、缓存依据和调用方式。 |
| `tests/fixtures/record-g2-3-herald.cjs:34` | 公开命令生成时另录真实回放；保持原始导出先于 serialization 模块加载，再携证验证恢复。 |

## 新增测试

- `tests/restore-audit/g23-history-facts.test.ts:49`：13 条。公开命令跨轮合法正例；征服者、炼金、Rumble、highRollerGold、宝箱、黑市收益自洽伪造在 object / JSON 两入口拒绝；真实源死亡 tick / eventSeq；历史胜负、幸存者；缺失／重复 facts、缺战／重战／乱序；multiplayer.g23Facts 不能代替证据。
- `tests/restore-audit/tristana-history-growth.test.ts:25`：2 条。先走公开命令获得真实 Tristana 击杀成长，清空 combat 后恢复；再同时增加 sourceDeltas 与 persistentGrowth 125，结构折叠自洽仍因缺少真实击杀而拒绝。
- 负例均保留真实回放不变。多数先验证原结构校验仍接受其自洽数据，再确认历史验证在指定边界拒绝，防止仅凭缺证错误使测试假绿。

## 修改的测试与夹具

- `tests/crown-restore-cache.test.ts`：同内容外部克隆仅重演一次，修改记录后必须重新验证并拒绝；新轮只重演新增战斗，候选仍逐次核对。
- `tests/restore-audit/bounds-preflight.test.ts`：向原校验入口传入实际公开路线记录，保留原预检次序断言。
- G2-3：`g2-3-followup.test.ts`、`g2-3-identity.test.ts`、`g2-3-integration.test.ts`、`g2-3-netcode-hooks.test.ts`。合法正例携带真实历史；原来凭空添加 removedUnitIds 的正例改为拒绝，同时保留未篡改正例。
- B8：`m8-b8-restore.test.ts`、`m8-b8-restore-fold-reuse.test.ts`、`m8-b8-equipment-fixture.test.ts`、`m8-b8-live-capacity.test.ts`、`m8-b8-live-cross-round.test.ts`、`m8-b8-live-economy.test.ts`、`m8-b8-live-growth.test.ts`、`m8-b8-live-reveal.test.ts`、`m8-b8-live-transfer.test.ts`、`m8-b8-loot-view.test.ts`。保留全部原测试／断言和时限，补传公开路线证据。
- `tests/fixtures/history-evidence.ts` 只选择公开记录器发布的真实回放，最终仍调用实际生产序列化／恢复。相同结算摘要的分支分别保留，按资源前缀／真实终局选择；不制造验证标记或修改候选。
- `b8-public-equipment.ts`、`g2-3-armory-public.ts`、`m8-neutral-public-route.ts`、`t13-loot-public.ts` 及 `tests/match-helpers.ts` 补录公开命令历史。

## 指纹与约束

- 编辑前确认 simulation 源文件和强化 Herald 原始文件为 LF；交付前复核所有改动文件。
- 按顺序执行 `node tests/fixtures/record-g2-3-herald.cjs`，补传证据后用该脚本 `--write` 重算清单，随后 `node scripts/record-g2-3-inputs.cjs`、`node scripts/record-g2-3-inputs.cjs --check`；最后再运行 Herald 默认 verify。
- Herald 重算写入验证：80.18 秒；默认 verify：85.79 秒。五组原始 Match、trajectory 逐字节不变，仅 g2-3 manifest 的源指纹及 input-fixture-audit 中对应清单指纹更新。
- `tests/fixtures/g2-augments-herald-raw/` 的 7 个文件均为 LF，和 origin/multiplayer 逐字节一致；未使用 `verify-m8-herald-fixtures.cjs --write`。
- 不升版本，不改规则数值，不改测试时限，不删除／跳过测试，不放宽读档校验，不运行全套测试。

## 自行决定

1. 沿用 SaveEnvelope 已有的完整 BattleRecord 和原历史验证链，不另加一套存档内“自证”的 facts 或 basis；真实 Start / Step 重演同时覆盖 A1、A3，避免维护第二套规则。
2. 将强制完整历史的条件从冠冕推广到所有已结算战斗；已有格式已携带 battles，不改版本。缺证旧孤立 Match 直接拒绝，不兼容迁移。
3. 基线没有用户提及的 `g23-history-facts.test.ts` 三条刻画用例，因此新增同名套件，重建三类拒绝断言并扩展收益／掉落／结果用例。
4. 当前 multiplayer 没有合入 #166 的新缓存；复用现有 battle-record-validation 重演缓存并改为内容键，保留每次候选前缀校验，避免以对象引用授权。
5. 离线入口继续拒绝联机元数据，multiplayer.g23Facts 仅作声明，不能补足缺少的回放；未扩大可信服务器快照的恢复合同。
6. 合法测试统一补录真实公开路线历史；保留结算相同但装备事务不同的分支记录，防止夹具选择错误证据。

## 最终验证

- 最终相关回归：34 文件、566 条全部通过，144.31 秒。命令：`npx vitest run --project fast tests/restore-audit tests/m8-b8-*.test.ts tests/g2-3-*.test.ts tests/crown-restore-cache.test.ts tests/g2-4a-crown-history.test.ts --maxWorkers=1`。
- 新增审计套件单独复核：2 文件、15 条全部通过，5.52 秒。
- `npm run typecheck` 通过；`git diff --check` 通过；输入指纹 `--check` 通过，CONTENT_DIGEST 仍为 `fnv1a32-utf16:cf9dcfe5`。
- 交付前再次 fetch / ls-remote 核实 multiplayer 仍为开工基线，未出现 #170 合入后的新 head，因此没有可追加合并的更新。
- 只运行相关测试，未运行全套；没有删除或跳过测试，没有修改任何原测试时限。

## 未完成

无本批遗留项。缺完整历史的旧孤立 Match 按既定策略拒绝，不提供迁移；SaveEnvelope 仍使用原有 battles 字段。
