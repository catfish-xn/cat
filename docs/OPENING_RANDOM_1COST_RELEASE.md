# 随机一费起手交付（2026-10-16）

分支 `codex/opening-random-1cost` 从 multiplayer `94eecbcbfbce72d4740923b8c793c66c483bfd51` 开出，PR 目标 multiplayer。

每席从 14 个一费英雄中独立等权抽一只一星，允许撞卡。共享初始化使用 pool.seed 和真实 seatId，扣一张基础卡；服务器继续调用已有公共初始化函数，签名不变。0G/等级1/0XP/100HP、unit-1、(1,4)、下一序号2不变。规则与算法详见 [合同 §24](MULTIPLAYER_CONTRACT.md#24-随机一费起手2026-10-16-用户决定覆盖旧固定-irelia-条款)。

单人保留原无限商店，仅统一起手选择算法，席位名为 solo；它本来没有 SharedPoolState。用户已明确确认：仅统一随机起手，保留单人商店。

基线实际把 1-2/1-3 奖励随机化了。本次按明确要求固定为麦迪/拉克丝；保留各自原有一词掉落流位置，不改变后续掉落抽样位置。与起手或购买英雄相同时按原规则合星。

规则与内容版本更新为 `s13-opening-random-1cost-v1` / `s13-14.24b-opening-random-1cost-v1`。CONTENT_DIGEST=`fnv1a32-utf16:299ec0d0`，LOOT_REPLAY_DIGEST=`fnv1a32-utf16:b9250813`。旧存档、快照与旧回放作废，严格拒绝、不迁移，活动局结束后发布。schema7/save3/replay3/commandProtocol3/50ms/lcg32-v1不变。

## 夹具迁移与证据

保留全部 G2 augments 原始文件，当前测试改读独立 opening-random 文件。重录入口位于 tests/fixtures，未修改 scripts：

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

本任务未修改 src/server、src/rendering 或 scripts，未运行界面 e2e。

## 验证

最终 PR 描述记录准确的 head SHA、完整 npm test / npm run test:timing 命令与结果；诊断和重录过程中的失败不算最终通过。
