# D0–D1：对手实扣血与真心本色（2026-10-29）

本单以用户转述的 D0–D5 设计及 2026-10-28 已定规则为依据；原设计文件本机不可用。规则/内容身份保持 v25，schema/save/replay/command、规则网络及 WebSocket 封套版本不变。**D1 只实现效果与测试，不加入强化定义目录、候选池或阶段禁令；统一注册归 D5。**

2026-10-29 用户已明确接受 D0 的 `damageDealt` 导致 v25 源码 SHA 与联机快照变化，留待 D5/集成由 Claude 统一重录。本单只运行 check，不运行 `--write`，不改 v24 及以前证据，不更新 v25 录制文件或源码摘要。

## D0 字段与结算边界

| 字段 | 含义 |
| --- | --- |
| `RoundSettlementReceipt.damage` / `RoundResult.playerDamage` | 本席本轮承受的未截断伤害请求；维持原值，仍用于原有规则和名次校验 |
| `RoundResult.hpLost` | 本席伤害结算实际掉血，已截过杀并包含梅尔保命；战后升级或吸血治疗不回减该值 |
| `RoundSettlementReceipt.damageDealt?` / `RoundResult.damageDealt?` | 本席本轮造成的**对手玩家生命**实际损失，真实双边 PvP 等于对手同轮 `hpLost`；对镜像为 0 |

`damageDealt` 是非负安全整数，上限 `MAX_SUPPORTED_PLAYER_HP`（当前 120）。房间生成的 PvP 收据必带此字段；为兼容旧的直接规则调用，类型为可选，未持有 D1 的直接调用可以省略。显式带 `undefined`、负数、小数、非有限值、非数字或超上限值均返回 `invalid-receipt`。单人、联机 PvE 与选秀结果**不新增此键**。未实现表现层时也不能从棋子输出统计的同名 `damageDealt` 推导玩家扣血。

新增只读公开函数（`src/server-entry/index.ts` 导出）：

```ts
function pvpSettlementHpLost(
  state: MatchState,
  proposal: { readonly damage: number; readonly g23Facts?: G23BattleFacts },
): number;
```

输入必须来自可信、已验证的活跃席位及该席位的本轮提案。返回伤害结算点的 HP 损失，包含本轮施法达成的梅尔保命，不包括后续回血；不修改状态、不发事件、不耗 RNG。`damage` 不是非负安全整数时抛 `RangeError('Invalid PvP damage')`。这是内部服务器规则交接接口，不认证任意客户端提供的状态/提案。

`Room.planSteps` 用对手**实时结算前状态**与对手提案调用该函数，禁止用冻结开战 HP 或未截断 damage 代替。每一席成功调用 `runSharedMatchCommand(..., {type:'settleRound', receipt})` 后，全轮在发布前交叉检查：本席待提交收据、规则保存收据、规则 RoundResult 的 `damageDealt` 全部等于对手同轮 `hpLost`。镜像为 0，不把镜像来源席在另一场战斗的损失算进去。任一值不符整轮返回 `{ok:false, detail:'seat <id>: damageDealt disagrees with opponent hpLost'}`，不发布部分状态/卡池/事件。原有 HP、保命事件、收入、成长与卡池断言保留。

投影读取路径：

- 服务端内部：`match.multiplayer.receipts[i].damageDealt` 与 `match.roundResults[i].damageDealt`。
- 网络、本地房间、2D/3D 共用：`toSeatPrivateView(match).roundResults[i].damageDealt`；底层同一白名单函数为 `toPrivateSeatView`。原 `round` / `roundId` 可用于匹配本轮。
- `toDisplayMatch(view).roundResults[i].damageDealt` 保留投影字段；UI 只消费数据。PvP 扣血表现和 3D 弹道本单未接线。
- 公共棋盘投影不增加字段，不外发 `multiplayer`、内部收据或 `settlementId`。

## D1 效果与奖励

ID 为 `what-you-really-are`，研究行 `TFT13_Augment_Grant6Cost_Warwick`（真心本色，棱彩）。独立只读来源为 `/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json`：`PlayerDamage=35`，取得给饮血剑，达标给一星沃里克与斯特拉克的挑战护手。归档标记为 14.24，不另声称已独立证明服务器 14.24b 热修；项目采用值由用户本单批准。

源阶段标签原样暂存于 `WHAT_YOU_REALLY_ARE.source.item_tags_raw`：`{cf1fd3af}`、`{d02ae323}`、`{d12ae4b6}`、`{b72bd3bf}`、`{92e7310e}`、`{86d6da1b}`、`{7aaa3b47}`；D5 再按现有标签映射生成禁令，本单不开放任何出现节点。

内部纯查询签名：

```ts
function whatYouReallyAreProgress(state: MatchState): {
  count: number; completedRound?: number;
};
function whatYouReallyAreGiftPlan(state: MatchState): AugmentGift[];
```

`count` 从已提交 RoundResult 与相同 `settlementId` 的服务器收据重推，**从取得当轮起**累计联机 PvP 的 `damageDealt`，达到后显示封顶 35。取得前结果、PvE、选秀、收到的 `playerDamage`/`hpLost` 均不计；镜像计 0。没有拥有者或 multiplayer 时 count 为 0，不猜测单机对手 HP。缺失/非法 D0 数据或收据不匹配抛 `RangeError('Invalid D1 damageDealt authority')`；若发生于 `applyRoundSettlement`，沿用 `invalid-receipt` 原子拒绝。达标轮 `hpAfter===0` 的淘汰者不发达标奖励。

饮血剑使用现有 acquisition gift 收据。首次存活达标轮的奖励通过 `planAugmentGifts` 的独立完成命名空间 `JSON.stringify([choiceId, 'what-you-really-are', 'completed'])` 发一次，source 沿用 `augment-pool-batch1`。沃里克进入现有奖励法球，领取时走共享有限卡池、容量与缺货补金规则；护手直接进装备库存。不会提前占池、挤掉备战席或绕开合星流程。重复 drain、重复提交、可信服务器状态 JSON 复制不重发、不推进 RNG。没有新增计数器保存字段或客户端命令。

拥有者动态值：`toSeatPrivateView(match).augmentDynamicValues['what-you-really-are'].values[0]`。候选预览如将来由 D5 开放则为 null；当前不在池中。规则只接受可信服务器持有状态；`restoreMatch` 仍拒绝 multiplayer，JSON 复制测试不等于新增不可信多人存档恢复能力。

## 全部入口与职责

| 入口 | 调用链／本单影响 |
| --- | --- |
| 单人 | `Match` 公共命令 → 原 `settleRound`；不产生 damageDealt。取得奖励共用 `drainP2Gifts → drainBatch1Gifts → whatYouReallyAreGiftPlan`，但 D1 未注册且不伪造单人 PvP 计数 |
| 联机 server | `net/server.ts → Lobby → Room.planSteps → pvpSettlementHpLost / runSharedMatchCommand → applyRoundSettlement`；规则提交 damageDealt 并结算 D1，房间随后双边校验 |
| 本地房间 | `rendering/online/local-room-client.ts → Lobby/Room`；同服务器规则，不另实现结算；`VITE_LOCAL_ROOM=1` 构建亦须通过 |
| bot | `Lobby → BotDriver → Room.handle/claimBotOrbs`；同席位结算；沃里克沿 `claimBotPreparationOrbs` 自动领取，不新增 bot 规则 |
| 2D | 网络 `state` / 本地房间 → `toSeatPrivateView → toDisplayMatch`；只提供字段，显示接线由 Claude 后续任务完成 |
| 3D | 与 2D 共用远程 Session/display state；读取同一 roundResults 路径，本单没有改 3D 或其战斗事件 |
| 直接规则调用 | `applyRoundSettlement` / `runSharedMatchCommand`；旧无 D1 载荷可省略字段，有 D1 的取得轮及之后需要匹配 D0 收据 |

## 验收记录

专项用例位于 `tests/augment-d1.test.ts`、`tests/d01-damage-dealt.test.ts`、`tests/server/d01-damage-dealt-room.test.ts`。D1 不在池中，因此拥有者/临界前 34 点使用明确标注的内部事务夹具；最后一战、房间原子提交、奖励法球领取与共享池守恒使用真实公开命令。D5 需另补真实候选选择后的全程验收。

本地日志与临时测试配置位于忽略目录 `artifacts/d01/`。当前无浏览器桥接环境，规则测试用临时配置仅禁用 `g4-global-setup` 的 Chrome 启动，保留原项目选择、worker setup、所有断言及超时；不运行 UI 浏览器测试、不自行启动 Chrome。

- 专项 29 项通过；最终去重 G23 读取后相关回归 **22 文件 / 300 项全部通过**（已含专项）。覆盖原 T3、梅尔完整/流式结算、G23 转发、HP 账本、房间原子提交、私有/公共及 wire 投影、本地房间、bot、动态值、历史与奖励法球的容量/缺货路径。结果见 `artifacts/d01/regressions-final.log`，一律 `--maxWorkers=4`。
- `npm run typecheck` 通过。默认 `npm run build` 的类型检查通过，但 Vite 默认 bundled config 想写只读 symlink `node_modules/.vite-temp`，失败于 EROFS；随后 `npx vite build --configLoader runner` 的真实生产构建通过，`VITE_LOCAL_ROOM=1 ... --outDir artifacts/d01/local-dist` 亦通过，未改配置或权限。
- 正式生产 `dist/assets/*.js` 顶层逐文件 gzip level 9 合计 **631,339 B**（index 507,440 + Phaser 123,899），上限 637,144 B，余量 **5,805 B**；没有新增 lazy chunk，不需改 `assets/ui/` 列表。`VITE_LOCAL_ROOM=1` 是单独调试构建，不混入正式 dist 计量。
- `node scripts/update-content-identities.cjs --check` 通过：内容摘要 `fnv1a32-utf16:f671ab88`，loot replay 摘要 `fnv1a32-utf16:36ebfac2`，没有更改身份/摘要文件。
- `node scripts/verify-v25-online-rules-epoch.cjs`（无 `--write`）的身份步骤通过，随后在 `record-battle-start --check` 比较 `tests/server/fixtures/battle-start.json` 时因联机快照字节差异失败；后续步骤未执行，不能视为全套 epoch 通过。按用户已批准例外保留快照和源码 SHA 待 D5 重录。本次报告 `artifacts/v25-online-rules-recording/epoch-verification.json` 为 `complete:false, trackedFilesUnchanged:true, changedTrackedFiles:[]`；没有替换正式 evidence。
- 额外的旧 `npm run test:server-entry` **未通过**，停在 `scripts/build-server.cjs:18` 的原依赖边界断言：`src/simulation/combat-replay-view.ts:18 → src/presentation/combat-status.ts`。用 esbuild 的只读 onLoad 将所有源码替换为 `git show HEAD:<path>` 后，HEAD 也有相同违规输入；本单不修改这个遗留依赖或放宽断言。生成的当前 Node ESM 另做独立运行时冒烟，新增 D0 导出与私有投影可用，且拦截浏览器全局/`Math.random`/`Date.now` 后通过；这不冒称旧入口门禁已修复。
- 2D 包隔离、整局房间排名计时、一个真人加七个 bot 的整局计时均通过。八 bot 整局计时 **未通过原 60,000 ms 门槛**：首轮 69,036 ms，去除 D0 重复 G23 读取并单独复验后 64,204 ms。只读加载全部 HEAD 源码（包含原 Room/round-settlement/augment-pool-grants，实际 SHA 记录在 `bot-timing-head.log`）运行同一未改测试，基线也失败，为 66,734 ms。对应 `isolation-timing.log`、`bot-timing-final.log`、`bot-timing-head.log`；没有切 report 模式，没有提高阈值或超时，**不宣称门禁全绿**。该遗留性能问题与旧 Node 入口依赖需要独立修复／复验后才能完成最终验收。
- 静态审计：`src/server` 新增行没有 `setTimeout` / `Date.now` / `performance.now` / `window`；没有改既有测试/阈值/超时、界面目录、历史录制文件或 `.git`。没有提交。

交付状态：D0/D1 效果、专项测试及合同已完成；**最终验收未签通过**，除已批准的 v25 待重录差异外，仍有上面两项可在 HEAD 复现的遗留门禁失败。建议分别修复基线性能和 Node 入口依赖，再与 D5 的真实入池流程统一复验；不通过重录或调大预算掩盖这些失败。
