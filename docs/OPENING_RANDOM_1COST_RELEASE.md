# 随机一费起手交付（2026-10-16）

分支 `codex/opening-random-1cost` 从 multiplayer `94eecbcbfbce72d4740923b8c793c66c483bfd51` 开出，PR 目标 multiplayer。

每席从 14 个一费英雄中独立等权抽一只一星，允许撞卡。共享初始化使用 pool.seed 和真实 seatId，扣一张基础卡；服务器继续调用已有公共初始化函数，签名不变。0G/等级1/0XP/100HP、unit-1、(1,4)、下一序号2不变。规则与算法详见 [合同 §24](MULTIPLAYER_CONTRACT.md#24-随机一费起手2026-10-16-用户决定覆盖旧固定-irelia-条款)。

单人保留原无限商店，仅统一起手选择算法，席位名为 solo；它本来没有 SharedPoolState。用户已明确确认：仅统一随机起手，保留单人商店。

按用户 2026-10-16 决定维持随机：1-2/1-3 从原五个老一费 `darius/irelia/lux/maddie/zyra` 中等权抽取，沿用 multiplayer 基线的掉落随机流、候选顺序、拒绝采样及消耗次数。与起手或购买英雄相同时按原规则合星。

规则与内容版本更新为 `s13-opening-random-1cost-v1` / `s13-14.24b-opening-random-1cost-v1`。CONTENT_DIGEST=`fnv1a32-utf16:299ec0d0`，LOOT_REPLAY_DIGEST=`fnv1a32-utf16:b9250813`。旧存档、快照与旧回放作废，严格拒绝、不迁移，活动局结束后发布。schema7/save3/replay3/commandProtocol3/50ms/lcg32-v1不变。

## 初次提交的夹具迁移与证据（历史）

历史 T13 oracle 以 oracle.t13.cjs 保留 Git 基线原始字节，原 audit.oracleSha256 继续验证它；当前 oracle.cjs 验证基线的随机奖励规则。保留全部 G2 augments 原始文件，当前测试改读独立 opening-random 文件。重录入口位于 tests/fixtures：

```sh
node tests/fixtures/record-opening-herald.cjs --write
node tests/fixtures/record-opening-fixtures.cjs --baseline-root=/tmp/opening-baseline --write
node tests/fixtures/record-opening-roles.cjs /tmp/opening-baseline
node tests/fixtures/record-opening-live.cjs /tmp/opening-baseline
```

基线导出必须是上述 Git 提交的原始内容，record-opening-fixtures 会逐文件核对 Git 对象，然后重新运行基线和当前的公共命令路线。每步仍通过独立金币/XP/商店/掉落/资源守恒 oracle；四条完整路线必须胜利，炮手和狙神各 67 个检查点逐个通过严格文本/对象恢复。C19 重新编译输入后比较原始战斗事件与终局；B8 完整战斗与回放重新哈希；Herald 由原有公共命令生成器导出原始文本，再恢复验证。

字节证据为 [fixture-migration.json](evidence/opening-random/fixture-migration.json)：前后字节长度、SHA-256、首个字节偏移和语义差异。它同时记录完整命令、事件、状态和 RNG 轨迹，不能用仅替换身份字段代替重录。

装备数值向量另见 [equipment-migration.json](evidence/opening-random/equipment-migration.json)。原 seed 6240 现在抽到 Violet，不再适合作为 Irelia 的手算装备向量；新 seed 145424 通过公共命令保留一星 Irelia、原 cloak/rod/gloves/bow/sword 组件向量和 manaflow-i/pumping-up-ii 强化向量，原手算属性断言保持通过。三种装备场景均比较前后完整状态及下一 tick 事件原始字节，并逐份执行文本/对象恢复。MatchSession 固定时钟用例改用合法抽到刀妹的 seed 0，继续要求实际 cast/shield/Mana/packetDamage。经济测试保留原金币、利息、成长和幂等断言；取消与该经济目标无关的旧单位组合 tick/event 数常量，完整轨迹由新路线夹具覆盖。

实时夹具另见 [live-migration.json](evidence/opening-random/live-migration.json)：转移、致死、揭示、满备战席、成长五类公共路线的准备状态、完整事件和终局字节比较，并逐份严格恢复。转移旧 donor7/survivor9 改为实际 Ezreal donor6/survivor8；致死目标从旧 Loris10/Rell15 改为 Loris6/Rell14；揭示目标按 definitionId 寻找。满席 seed36 实际金币18、揭示 tick75、终局 tick110。成长 seed48 保留两个真实 125bps 旧成长源，公开部署 unit14 至 (6,7)，由独立父伤害和 bounce 任务计数验证 unit15 的 125bps 当场成长，合星后共375bps。原先取第一个死亡的断言改为匹配实际揭示 tick 的有资格死亡。离线转移独跑约9秒，完整路线竞争预算设为60秒；逐 tick 恢复断言未变。

## Claude 跟进清单

- `tests/server/e2e/p7-carousel.mjs:84` 写死起手 definitionId 为 irelia；需读取状态并核对一费、一星、unit-1，而非固定英雄。文件第8行旧说明也需修改。
- `tests/server/e2e/c7-playtest.mjs:144` 用“出现扩展英雄”作为机器人购买证据；现在起手也可能是扩展英雄，需按购买事件或来源账本判断。
- `tests/server/e2e/g2-traits-tooltips.mjs` 当前 HEAD 已按 state 单位与 definitionId 检查，不存在 unit-1=Irelia 的断言；请在真实界面验收时保持这点。
- `c18b-use-consumable.mjs` 的 unit-1 用于工具目标 ID，`c18b-loot-preview.mjs` 的 Irelia 是显式展示夹具，都不等同于固定起手英雄，可保留。
- `src/server/room/room.ts:217` 的 free Irelia 注释已过时；初始化公共签名不变，服务器无需自行抽样或改参数。

本次 R1 追加修订仅顺带修改 scripts/verify-tp-node-entry.cjs 与 scripts/update-m8-b8-golden.cjs 的过时起手断言，改读实际开局；未修改 src/server、src/rendering，未运行界面 e2e。

## 验证

初次提交的全套与 timing 结果见 PR 历史。R1 仅执行下列受影响测试与脚本，不重跑全套或 timing；最终 PR 描述列出准确 head 和定向验证结果。


## OPENING-R1：按用户 2026-10-16 决定维持随机

1-2/1-3 恢复 multiplayer `94eecbc` 的 `hero(1)`；`loot-freeze.ts` 与该基线字节完全相同，包含原五英雄顺序、掉落流和拒绝采样。1-1 起手选择器、费用、允许重复、共享扣池规则保持不变；沿用本 PR 首次提交的全部版本及 CONTENT/LOOT_REPLAY digest，不再 bump。

本次只重录奖励变化影响的当前夹具：完整四路线 golden、炮手/狙神各 67 个原始检查点、首战完整状态/事件 trace、五份 Herald 原始状态及其 manifest/trajectory。装备公共夹具 seed 调整为 3151248，以真实随机抽到麦迪/拉克丝并保留原 Irelia/Lux、组件及强化手算向量；三场景字节对照见 [r1-equipment-rewards.json](evidence/opening-random/r1-equipment-rewards.json)。C19 与 B8 指纹字节保持不变。原始 G2/T13 和上述初次迁移证据保留为历史，不代表 R1 的当前轨迹；equipment/live-migration 中的旧单位 ID/事件属于初次 head，当前实时奖励用例恢复基线向量。

当前字节证据见 [r1-random-rewards.json](evidence/opening-random/r1-random-rewards.json)：逐文件前后字节长度、SHA-256、首个差异偏移；记录基线全掉落账本（除发布身份）及 RNG 完全一致的对照，包含拒绝采样 seed；四路线仍为 33 场战斗且胜利，134 个检查点逐份严格文本/对象恢复。`opening-random-identity` 同时验证原迁移证据→R1 的 golden SHA 链接。

重录命令（Node 22.23.3，按 package-lock 的依赖；baseline 是上述 Git 提交的未改导出）：

```sh
node tests/fixtures/record-opening-herald.cjs --write
node tests/fixtures/record-opening-r1.cjs /tmp/opening-baseline
# 原 PR head 2e21f18 的未改导出，仅用于装备前后字节对照
node tests/fixtures/record-opening-r1.cjs /tmp/opening-previous --equipment-only
```

既有测试改为随机候选范围/确定性 seed 向量，未新增测试用例；公开奖励路线带来的单位 ID、合星来源、满席金币与战斗 tick 恢复基线断言。两处历史脚本改读实际起手；TP 同时按当前 48 英雄目录校验有限池，并以实际两席抽取结果构造稀缺池。


R1 定向验证共 18 个现有测试文件最终通过：`opening-random-1cost`、`opening-random-identity`、`m5-route`、`m8-b8-loot-runtime`、`m8-b8-oracle`、`m8-b8-golden-guard`、`m8-b8-loot-view`、`m8-b8-equipment-fixture`、`m8-b8-live-{capacity,cross-round,economy,growth,reveal,transfer}`、`t3-timeout-loot`、`t5r-loot-view`、`tp-rewards-and-rounds`、`t12-offline-transfer`（均位于 tests，后缀为 .test.ts，golden-guard 为 .test.mjs）。未跑全套、timing 或界面 e2e。

脚本验证：Node 22.23.3 下执行 `node scripts/build-server.cjs` 后，`node scripts/verify-tp-node-entry.cjs` 通过；`update-m8-b8-golden.cjs` 的既有 guard 测试通过，且 `originalChecks` 在原完整 B8 cannon 录制上通过，接受实际 Amumu 一费起手、拒绝 Leona 二费起手。历史 B8 capture/audit/apply 仍绑定历史 schema/content/source，未执行该历史全量迁移或改写历史 golden。
