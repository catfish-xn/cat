# Batch 5 G1 验证记录（2026-10-27）

基线为 `codex/v25-g1`、`4495602daa21ab5b218e05a76721b7a070117ccc`，工作开始时无修改。只实现 B5-53/54，不提交 Git，不重录 epoch。两项均有允许节点，没有解除原有阶段禁选。

| 强化 | 实装数值与节点 | 执行约定 | 验证 |
| --- | --- | --- | --- |
| B5-53 幸运手套 | `NumGloves=2 / NumRounds=5`；2-1取得给2拳套，第5个后续自然轮入口给1拳套；3-2/4-2禁选 | 14.24英雄推荐8件中等概率无放回抽2件不同成装；光明手套映射对应光明装备；双形态按开战形态；不用Tier1/2表 | 真实Room选择、合成、穿戴、PvP冻结、2-2至2-6连续入轮（含2-4选秀）、补发唯一性、独立奖励oracle、三输入形式恢复和篡改拒绝均通过 |
| B5-54 幸运手套+ | `NumGloves=3`；取得立即给3拳套，无延迟；2-1禁选，3-2/4-2可选 | 与普通版同一选择器、光明映射和缓存；两版本互斥 | 真实3-2 Room选择、合成、穿戴、PvP及3-3入轮、三输入形式恢复、篡改拒绝和独立oracle均通过；阶段测试同时覆盖4-2候选 |

研究证据分歧和工程约定分别记在 `S13_RULES_GAP.md` 的 **P-B5-53 / P-B5-54（P，2026-10-27）**，并更新 `AUGMENT_BATCH5_GAPS.md` 两卡标题和“分类与后续”。官方13.23推荐池8选2属于已证实的跨版本资料；普通/+同规则、光明适用的S13–S14材料标为社区推测；等权、14.24执行路由、开战形态接线与缓存明确为用户批准约定的工程实现。原研究只读。

## 代码调用点

以下两张卡共用同一规则接线；+版只增加独立内容行、原始阶段限制和历史持有者登记，不复制选择器或延迟奖励。

| 文件 | 调用/变化 |
| --- | --- |
| `src/simulation/content/augment-pool-batch5-g1.ts`（新） | 两卡14.24双语说明、数值、位阶、礼物、推荐角色与光明/随机/形态政策；沿用已有14.24角色表，补六费角色及Viktor专用推荐池 |
| `src/simulation/augment-pool-batch5-g1.ts`（新） | `luckyGlovesRewardPlan` 按取得轮+5推导普通版唯一补发，不从生产收据反推数量 |
| `src/simulation/augment-pool-batch5-g1-equipment.ts`（新） | `luckyGlovesSelection / selectLuckyGlovesPair / equipmentRollFor / generateLuckyGlovesRolls / validateLuckyGlovesEquipment`；显式装备LCG流、拒绝采样、不可变追加缓存和完整随机流重放 |
| `src/simulation/augment-pool-grants.ts` | 通用初始礼物表纳入两卡，计划追加普通版延迟礼物；沿已有资源来源和唯一收据执行 |
| `src/simulation/match.ts` | 两个自然入轮分支的既有礼物排空门增加普通版，保证2-6入口实际补发 |
| `src/simulation/temporary-equipment.ts` | 取得/装备/部署后的通用钩子选用推荐生成器；当前投影和验证按英雄/形态缓存取roll；联机验证允许既有加时轮 |
| `src/simulation/m8/contracts.ts` | `EquipmentRoundRoll` 增加 `lucky-gloves-v1` 判别和仅该分支的选择上下文；旧普通roll没有新增字段 |
| `src/simulation/combat-input.ts` | 冻结输入恢复使用自身阵容及roll前缀选择对应缓存 |
| `src/simulation/b8-restore.ts` | 战中装备来源重建按冻结阵容选择单个对应缓存，避免把多个形态缓存重复应用 |
| `src/simulation/shared-pool.ts` | 对两项持有者复用礼物校验和装备重放；保留独立服务器authority的完整候选认证 |
| `src/simulation/augment-history-owners.ts` | 两项接入 `augment-history-v1`；取得/位置/战斗阵容均由已有历史API记录，无新历史节 |
| 共享内容注册 | `content/augments.ts`、`augment-policy.ts`、`augment-offer-rules.ts`、`augment-stage-bans.ts`、`rules-manifest.ts`、`validate-content.ts`各增加最小注册或计数 |
| 独立M5 oracle | `tests/fixtures/m5/oracle.g2.cjs / .d.cts`、`augment-rewards-oracle.cjs`增加独立身份、位阶、禁选、互斥、2+1/3奖励计划；新 `lucky-gloves-oracle.cjs` 用BigInt LCG、独立角色/光明转录和实际历史阵容校验结果，不以生产收据决定应得效果 |
| 测试辅助 | `tests/fixtures/t13-public-gloves.ts`将G1加入“普通手套隔离路线不选择赠品强化”的现有排除表；保留原断言。阶段审计和独立oracle目录大小断言按新增2项更新 |
| `src/server/` | **无修改**；既有 `Room.handle → choose/combine/equip/deploy/useConsumable`、共享入轮与冻结编排直接调用规则 |

公开命令、内部新增函数签名、输入输出、失败语义和保存边界已写入 `MATCH_CONTRACT.md`。没有新增客户端命令，没有把规则搬进服务器，也没有修改界面或素材。

## 通过的验证

所有 Vitest 调用均为 `--configLoader runner --maxWorkers=3`；未提高超时、未删除断言、未跑全套。

```text
npm test -- --configLoader runner --maxWorkers=3 \
  tests/augment-pool-batch5-g1-lucky.test.ts \
  tests/augment-pool-batch5-g1-plus.test.ts \
  tests/augment-pool-batch5-g1-equipment.test.ts \
  tests/server/augment-pool-batch5-g1-lucky-room.test.ts \
  tests/server/augment-pool-batch5-g1-plus-room.test.ts \
  tests/augment-stage-bans-audit.test.ts \
  tests/augment-text-identity.test.ts \
  tests/m5-oracle-augment-ledger.test.ts \
  scripts/tests/production-size.test.ts
```

结果：**9文件、103项通过**，其中新增G1文件5个、40项。最后补强了全部可招募英雄的角色覆盖、每个完整8件推荐池与独立原始转录一致，再单跑 `augment-pool-batch5-g1-lucky.test.ts`：8项通过。共享装备测试还覆盖已装备普通/光明手套后取得强化、旧roll前缀保留、卸下重穿不重抽、Elise前后排切换及返回原形态缓存、光明临时装备、失败命令无状态/RNG变化。现有普通手套不能用masterwork升级的规则保留，光明手套测试由合法测试授予后调用公共装备命令。

`npm run typecheck`、`vite build --configLoader runner`、`npm run build:game`、内容身份`--check`和`git diff --check`通过；Vite仍有既有的大chunk提示，不影响构建结果。

已运行 `node scripts/update-content-identities.cjs --write`，并同步 `scripts/tests/production-size.test.ts`：

- content：`fnv1a32-utf16:e28aeb28`
- loot replay：`fnv1a32-utf16:d79c1eb4`

没有改外层保存/命令/协议版本，没有重录epoch或修改旧epoch断言；新内容身份与旧epoch发生漂移，留待集成阶段独立录制。

## 已知基线失败与验证限制

额外运行既有 `tests/m8-b5-temporary.test.ts` 时，原普通手套路线有 `TG seed42 must offer Watcher Crest` 固定候选失败，以及group4期待旧 `shield projection` 文案但收到严格历史重放拒绝的失败。将未修改HEAD独立解包到 `/tmp/cat-b5-g1-baseline` 后，分别用原测试名过滤复现这两类失败，未改原断言或超时。新增候选曾让group0误选幸运手套；按该辅助器原有隔离意图仅排除新G1赠品卡后，group0已通过，不修改生产规则来迁就固定候选。

**约束偏离如实记录**：额外旧TG回归内含既有512候选的纯规划，运行后检查代码才发现其范围超出本任务0..100限制，发现后未再运行该规划。新增G1测试的查找均限制0..100；没有为本任务新增或扩展宽种子扫描。未运行完整对局套件、浏览器或真实网络端到端测试；在线验证为真实Room/规则命令与战斗路径。
