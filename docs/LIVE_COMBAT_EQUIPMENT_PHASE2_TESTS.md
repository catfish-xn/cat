# 战斗装备阶段 2：验证与预期失败（2026-10-22）

基线 `9d9ea671`，独立克隆分支 `codex/battle-equipment-phase2`。仅本地读取及 `127.0.0.1` WebSocket；没有联网取数、Git 提交、epoch 录制、golden/baseline/recorded-state 改写或 CI 门槛修改。

## 通过的相关测试

10 文件联合运行 **111/111 通过**；随后补上镜像拒绝向量并复验受影响的 4 文件，**28/28 通过**。当前去重后相关用例为 **112 项**。收紧 beforeTick 批次校验后，规则与旧流输入 2 文件 **24/24** 再通过。期间旧 T12 的 8 个「战斗完全不变」预期已改为本需求要求的「安装前不变、下一 tick 安装、恢复续算一致」断言；没有改 epoch/digest/golden 断言。`tests/m8-contracts.test.ts` 仅将类型样例的 currentRulesVersion 改读 M8_VERSION，保持断言。

| 文件 | 用例数 | 覆盖 |
| --- | ---: | --- |
| `tests/battle-equipment-phase2.test.ts` | 17 | PvE/PvP、beforeTick 正向注入、下一 tick、同拍合成、静态属性/缺失生命、阵亡不复活、失败原对象/RNG、私有回放、B 侧映射、重复输入/镜像拒绝、周期装备、窃贼 roll、纹章冻结、待执行和已安装恢复、篡改/删日志拒绝 |
| `tests/server/battle-equipment-phase2.test.ts` | 3 | PvE/PvP 命令、原子失败、整拍闸门、下一帧装备、全部席位终局抽检、私有数据不进公共流 |
| `tests/server/net/battle-equipment-wire.test.ts` | 1 | 127.0.0.1 真 WebSocket：分片期间无提前回执、跨重连 dedupe、关键帧+尾段恢复、观战同帧、私有日志不泄露 |
| `tests/live-combat-inputs.test.ts` | 7 | 无装备输入的原首遍/分片/完整账本逐字节一致，未认证输入原子拒绝 |
| `tests/t12-combat-equip.test.ts` | 48 | 原装备权限/配方/来源/临时装备/死亡/战后合星回归，更新实时生效语义 |
| `tests/t12-recovery-boundary.test.ts` | 5 | 原单人恢复、联机 Match 不可导入的边界 |
| `tests/server/combat-stream.test.ts` | 15 | 原流式与旧解析器一致、50 ms 边界、切片、结算一次、恢复及终局抽检 |
| `tests/content-identity-constants.test.ts` | 6 | 完整归档 root 的 content/loot digest 一致；运行依赖图边界 |
| `tests/m8-contracts.test.ts` | 6 | M8 类型/机制合同 |
| `tests/server/purity.test.ts` | 4 | 服务器纯调度约束/禁止时钟入口 |

`npm run typecheck` 通过。`git diff --check` 通过。界面目录、`.github/`、CI、历史夹具及 epoch 证据没有修改。

最终补齐周期装备的安装时钟和合成后旧装备程序清理后，再跑规则阶段 2 与 T12 装备回归，**65/65 通过**（33.60 s）；最终 typecheck 再通过。以上复验不重复计入 112 项。

测试命令：

```sh
export PATH=$HOME/.local/bin:$PATH
npm run typecheck
npm test -- --configLoader runner --maxWorkers 2 \
  tests/battle-equipment-phase2.test.ts tests/live-combat-inputs.test.ts \
  tests/t12-combat-equip.test.ts tests/t12-recovery-boundary.test.ts \
  tests/content-identity-constants.test.ts tests/m8-contracts.test.ts \
  tests/server/battle-equipment-phase2.test.ts tests/server/combat-stream.test.ts \
  tests/server/net/battle-equipment-wire.test.ts tests/server/purity.test.ts
```

依赖为只读目录软链，默认 Vite bundled config 会尝试写 `node_modules/.vite-temp` 并失败；使用 runner loader 绕开该缓存写入。没有改依赖或测试配置。未运行全套、浏览器、完整 headless 或 epoch 录制命令。

## 实测预期失败：旧 epoch 未录制

`tests/opening-random-identity.test.ts` 共 **150 项：14 通过，136 预期失败**。本文件及引用的旧字节全部保留：

| 失败用例 | 数量 | 原因 |
| --- | ---: | --- |
| `binds v20-black-market to fresh public rules and preserved v20-live-combat byte evidence` | 1 | 新规则/content/digest 与旧 black-market baseline 不同 |
| `cannon: checkpoint N survives strict text/object restore`，N=0…66 | 67 | 旧 recorded states 的 rules/content 身份被 `unsupported-version` 拒绝 |
| `sniper: checkpoint N survives strict text/object restore`，N=0…66 | 67 | 同上 |
| `recomputes the first battle terminal and every event hash from public commands` | 1 | 按新身份生成的状态 hash 与旧记录不同 |

该文件与当时的规则/T12 测试一起运行：3 文件合计 **78 通过、136 预期失败**，32.91 s。未把这些失败改绿；它们由与开局奇遇合流后的统一 epoch 录制解决。其他完整路线、B8/C19/Herald 旧 epoch 检查未运行，仍是集成录制验收范围，不能据此宣称通过。

## 当前身份与剩余工作

候选 `v20-battle-equipment`：CONTENT `fnv1a32-utf16:c17a536b`、LOOT `fnv1a32-utf16:d9012397`，schema/save/replay/command **11/7/5/5**、NET6。只运行离线 `node scripts/update-content-identities.cjs --write` 更新运行常量，未调用任何 epoch recorder。

Claude 后续接拖拽和 `CombatViewUnit.equipment`；用户界面尚未因此开放拖放。联机只有运行中断线重连，没有新增房间落盘/重启恢复。羁绊成员/档位、全队开场/召唤和冠冕收益资格保持开战冻结；只同步装备自己的数值及机制。新私有来源凭据按成功装备次数增长，未做全局负载/浏览器性能验收。
