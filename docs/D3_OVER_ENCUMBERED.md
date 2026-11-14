# D3 运力不足（待 D5 注册，2026-10-29）

依据：用户 D3 工单及 `/home/aiapps/workspcae/codex-briefs/d-common.md` 规则 6–8；本地 14.24 研究归档 `TFT11_Augment_OverEncumbered` 的 BenchSlots=1、components=3。下一阶段指取得阶段之后的整个阶段；取得阶段无影响。此任务不把卡加入定义总表、等级表或候选规则；`OVER_ENCUMBERED_DEFINITION` 仅供 D5 集成。规则/内容身份、摘要常量与历史证据均未改写。

## 权威行为

- `GameState.benchSize` 保持 9。可选 `usableBenchSlots=1` 与 `overflowUnitIds:string[]` 为当前阶段覆盖层，无持有者时不产生字段。
- 下一阶段 `.1` 入轮，在任何待发英雄/选秀入席前启用；该阶段 `.7` 完成结算时解除，后续阶段号仍为 6 的加时轮也不再启用。PvE、PvP、选秀均不提前结束期限。淘汰席不发完成奖励。
- 已有第 0 格优先保留；若空则按旧格序补入。其余旧备战席棋子按格序暂放玩家部署区的空格，记录 `overflowUnitIds`；不出售、不丢失资源，不自动合入参战棋子。
- 暂留棋子不计人口、羁绊和战斗阵容，只能出售，不能换位、被换位、装备、消耗品或异常选目标操作；异常超时自动选择会跳过暂留棋子。只有出售备战席单位空出席位时，才先把第一枚暂留棋子放回备战席，再重试其他奖励。正常棋子部署、出售场上或暂留棋子均不触发回席，防止轮换上阵绕过限制；仍有暂留单位时，奖励/选秀继续等待。
- 暂留锻造器沿 `openAnvil` / `sellUnit` 原流程直接打开，不加金币；只放宽权威暂留标记对应的目标资格，普通棋盘锻造器仍拒绝。恢复时原锻造器站位断言同样仅豁免限制生效且有暂留标记的单位，出生、单次消费、候选和选择收据断言保留。打开后删除该单位的暂留标记；备战席锻造器的打开等价出售腾席，可触发回席，暂留锻造器不触发。
- 限制阶段内所有商店英雄购买返回 `bench-full`，即使可用格空或购买能合星。经验、刷新、锁店和正常棋子的布阵仍按既有规则；失败保持原 state、pool、事件、序号和 RNG。
- 奖励英雄沿现有法球/容量待发；选秀沿 `heldCarouselUnits`，D14 返回与独立 owned-resources 同样在受限期间只尝试可用备战席，不用棋盘空位绕过限制，即使已无暂留单位。系统自动布阵、超时选择、选秀和结算继续运行。
- 超级巨星动态描述、敌方开场预览和可移动召唤物显示均排除暂留单位的参战贡献。B4 满席经验仍按可用席位判断，潘朵拉右侧格在限制期间禁用；买经验/刷新/锁店仍可用。
- 阶段完成给 3 件散件，沿 `G24_FORGE_POOLS.TFT_ArmoryKeyComponent` 的 8 项等权、有放回抽三次，允许重复。复用 `planAugmentGifts` 的席位/choice 私有 LCG 子流及普通装备唯一收据；不推进任何 live RNG。收据命名含 `over-encumbered-stage` 与目标阶段，重试/读档不补发。

## 接口与失败

`bench-capacity.ts`：

- `usableBenchSlots(preparation:GameState):number`：无覆盖时返回物理容量。
- `isOverflowUnit(preparation:GameState,id:string):boolean`：读取权威暂留标记。
- `combatBenchProjection(preparation:GameState):GameState`：把暂留棋子投影为物理九格中的后备棋子；保留所有拥有资源供 PvE 冻结输入与恢复核对，不修改当前站位。该投影不得用于发奖或界面摆放。

`over-encumbered.ts`：

- `overEncumberedActive(state:Pick<MatchState,'round'|'roundResults'|'augments'>):boolean`：按取得阶段和当前结算边界派生期限。
- `reconcileOverEncumbered(state:MatchState,returnOverflow?:boolean):{state:MatchState;events:MatchEvent[]}`：纯规则层原子调整容量和站位，产出既有 `unitDeployed`；`returnOverflow` 默认 false，仅出售备战席单位（含打开备战席锻造器）传 true。限制结束始终回席；调用方负责正常事件编号。
- `overEncumberedRewardPlan(state:MatchState):AugmentGift[]`：派生阶段完成奖励及唯一身份。
- `completeOverEncumbered(state:MatchState):{state:MatchState;events:MatchEvent[]}`：调整覆盖层并按既有授予接口发尚未领取的三件装备；重复调用无事件。
- `validateOverEncumbered(state:MatchState):void`：拒绝无持有者的覆盖、错误容量、重复/孤儿标记、禁用格占用、超出物理后备容量和非幂等整理。部署后的空席与暂留共存属于合法状态；原“有暂留必满席”断言按本次批准规则改为物理后备容量断言，完整命令重演和独立 authority 仍拒绝删除单位/伪造站位。非法状态抛 `RangeError('Invalid over-encumbered ...')`。

无新客户端命令或网络封套版本。购买失败沿用 `bench-full`；暂留移动/换位用 `invalid-location`，装备用 `wrong-phase`，消耗品用 `invalid-consumable-target`。原九格和人口上限断言保留，人口明确按参战阵容核对。

## 空席与暂留并存时的赠礼恢复

部署第 0 格的正常棋子后，空席与暂留单位可以同时存在。`planPurchase` 此时仍返回 `bench-full`；S3A 库存转换与学术研究锻造器均须继续延期。`validateBatch5Inventory` 的“有空位必须已发”条件现在同时要求无暂留单位；`validateAcademicGifts` 将仍有暂留单位计入 `mayDefer`。没有暂留且确有空位时，缺失收据仍拒绝；原出生、序号、候选、来源与消费校验不变。

全仓同类容量／恢复路径核对：

| 路径 | 与实际延期条件的一致性 |
| --- | --- |
| S3A / 学术研究 | 本轮补齐暂留阻塞；单人恢复与 `restoreSharedOrbSnapshot` 共用校验。 |
| 法球、直接掉落、普通单位／锻造器赠礼 | `grantMechanicUnit`、`grantDirectLoot`、`grantAnvilUnit` 最终调用 `planUnitAcquisition → planPurchase`；恢复认证出生／法球账本，未另按空席强制要求单位已发。 |
| 普通强化赠礼 / G5 | `validateBatch1GiftReceipts` 仅对非单位赠礼要求即时收据；G5 对在线英雄要求的是已入法球的收据，锻造器仍可延期。 |
| 选秀 | 入席复用 `placeCarouselUnit`，先拦暂留，再查可用席位；恢复认证暂存身份与收据，无空席必发断言。 |
| D14 | `validateD14` 直接复用带暂留拦截的 `returnLocation` 判断能否延期。 |
| owned-resources | `freeLocation` 先拦暂留；`restoreOwnership` 以独立边界与交易重演同一放置逻辑。 |

`tests/over-encumbered-gift-restore.test.ts` 通过公开命令部署腾空第 0 格，在暂留仍在且精致古董（S3A）／学术锻造器到期未发的状态，分别验证单人序列化与联机独立 authority 恢复；另验证无暂留时仍拒绝漏发，以及解除暂留后只发一次并认证出生／消费。

## 受限阶段结算期的 B8 恢复（第 3 轮复审）

`CombatInputBasis` 新增按需字段 `resourcePreparation?:GameState`：仅受限开战保存实际持有状态，含 `usableBenchSlots`、`overflowUnitIds` 和暂留棋子的真实棋盘位置。`inputs.preparation` 保持无覆盖层的九格战斗投影，原断言保留；不受限开战不增加字段。`restoreCombatInput(value,authority,parsedJsonInput?,deferFreeze?)` 在原资源前缀认证之外，检查实际快照的结构、期限、容量、暂留标记和确定性战斗投影；公开命令历史继续认证真实站位，不能靠相同战斗投影伪造暂留位置。缺少实际快照、无持有者却增加快照或投影不等均拒绝，不推测修补。

单人 `replayCurrentSuffix` 从实际快照起步，掉落依然受当时的一格容量和暂留阻塞。重放 direct loot 与 growth commit 后，在已认证结算边界调用相同的 `reconcileOverEncumbered`；争夺金币无资源来源事实，仍由原结算校验认证。阶段 x-7 才回席、去覆盖层，随后认证后续资源交易。容量出售、打开备战席锻造器同样按是否腾出备战席重放回席；打开暂留锻造器／退休训练假人则清理已消失单位的标记。容量出售之后才重试直接掉落；最终比较包含容量覆盖的完整 preparation，而非只比单位列表。x-7 的直接掉落在运行时解除限制前已延期，解除本身不触发重试，原 `pending-capacity` 必须保留到合法出售命令。

`validateOverEncumbered` 的最小输入为 `Pick<MatchState,'round'|'roundResults'|'augments'|'preparation'>`，用于独立认证开战实际持有快照；`reconcileOverEncumbered(state:MatchState,returnOverflow?:boolean)` 的原调用签名和事件语义不变。没有新增玩家命令、服务器计算、内容注册或格式号变化。

`tests/over-encumbered-settlement-restore.test.ts` 使用 `firstNodeSeed('over-encumbered')` 的自然报价、2-1 公开选择、2-x 公开购买储备，逐轮走完 3-1～3-7。每轮结算（含 3-4 供给轮）验证对象、JSON 对象和规范文本三种恢复；覆盖冻结快照隔离、暂留不参战、3-7 的三个 pending-capacity 掉落、恢复后出售的精确命令结果及只发一次。3-1／3-7 还拒绝缺失快照、伪造容量，以及战斗投影完全相同但实际停车位置被篡改的候选。另一条 component-anvils 真实开局路线只脚本化候选报价，保留真实获取、战斗与命令，分别验证结算期打开暂留／备战席锻造器后及选完装备后的三种恢复。冷恢复按输入入口拆成独立用例，未增加超时或放宽任何断言。

本轮验证：新增专项 **76 项**、原 D3／赠礼／B8 相关 11 文件 **284 项**、补验两份锻造器测试 **27 项**，共 **14 文件／387 项不同测试**通过，均 `--maxWorkers=4`。最后一批四文件 127 项中另重跑了已计入原回归的 late-claim 24 项；TypeScript 与生产构建通过。2D 顶层 JS 默认 `gzipSync` 合计 **632,807 B ≤ 637,144 B**，无新 lazy chunk。内容／回放身份检查与 v25 digest 比较通过；552 个历史文件及保护 manifest 字节一致，`tests/fixtures/` 与 `docs/evidence/` 无差异。v25 总检查仍在 `battle-start-audit.json` 源码 SHA 比较处失败，此前开战 fixture 字节比较通过；沿用前轮留待 D5 的来源审计事项，不宣称总检查全绿，不执行 `--write`。未提交，未编辑界面或本地素材。

## 全部调用入口

| 入口 | 接线 |
| --- | --- |
| 单人 Match / 本地单人 | `nextRound` 在入轮转换前调整覆盖；`accept` 与 `traceHistoryCommand` 统一维护覆盖/阶段完成发奖，不因空席自动回席；`buyUnit` 拒买，`sellUnit/openAnvil` 仅腾出备战席时先回席后发其他奖励；`freezeCombatInput/readCombatStrategyInputs` 保留全部资源、只让参战棋子进战斗。 |
| 真实联机 server | `Room.handle → buySharedUnit/sellSharedUnit/runSharedMatchCommand → Match`；`nextSharedRound → nextRound`；PvP `snapshotForBattle` 排除暂留，PvE 使用同一冻结投影；`applyRoundSettlement` 调同一完成规则。服务器只透传展示标记，不计算期限、容量、奖励或伤害。 |
| 浏览器本地房间 | `LocalRoomClient` 使用同一 `Room`，无另一套规则。 |
| bot / 自动操作 | bot 使用公共命令预检，优先出售暂留棋子；`autoDeployToCap` 按实际参战人口部署正常备战棋子。选秀与法球重试使用共同容量接口。 |
| 持有/发奖工具 | `planPurchase`、选秀入席、D14 返回、owned-resources、复制器、学术/库存待发恢复检查均使用可用容量。历史阵容以九格后备投影记录，右侧潘朵拉席位转换排除禁用格。 |
| 2D / 远程 Session | 私有 view 透传容量和暂留 ID，现有 adapter 保留字段；BoardScene 为禁用格画叉，UnitView 显示“暂留不参战”，可拖到出售区；布阵失败仍由服务器裁决。 |
| 3D / 侦察 | BoardFrame 的 `usableBenchSlots` 与 BoardPiece 的 `nonCombat` 只读显示；程序棋盘与已加载棋盘都标禁用格，头顶显示“暂留不参战”。公开侦察 view 只增 `nonCombat?:true`，2D/3D 侦察显示并从羁绊中排除。 |

## 验收与 D5 交接

`tests/over-encumbered.test.ts` 以测试内一换一内容 mock 验证未注册卡的真实命令、单人序列化重演、八席 Room / bot / 生产选秀绑定和联机独立恢复认证；另明确断言生产定义/等级表不含该卡。不弱化内容总数、恢复、人口或池守恒断言，不提高超时。

当前工作区 node_modules 为只读链接，默认 Vitest 配置打包会遇到 EROFS。`artifacts/d3-vitest.config.ts` 仅在生成物中改用可写缓存并关闭纯规则测试不需要的浏览器 globalSetup；运行 `npm test -- --config artifacts/d3-vitest.config.ts --configLoader runner <相关文件> --maxWorkers=4`。构建同理使用 `vite build --configLoader runner`。不改变仓库测试/构建配置。

没有 `CODEX_BROWSER_CLIENT` / `PLAYWRIGHT_WS_ENDPOINT`，故本任务不执行浏览器验收；真实 2D/3D 目视与交互验收需 Claude 用 `codex-browser exec` 新启动连接。源码摘要变化由 D5 统一重录，不运行 `--write`。本地 `assets3d-local/` 不编辑，`.git` 不写入、不提交。

## 本轮赠礼恢复复审验证

- 新增赠礼恢复专项 **80 项**通过，覆盖精致古董与学术研究各自的真实单人命令路线、八席 Room 路线、三种恢复输入、无阻塞漏发拒绝和解除暂留后的单次出生／消费；逐回合认证单人重演，沿用原 5 秒测试限制。
- 相关 8 个文件 **196 项**通过（原 D3、S3A、精致古董、S3B、法球、锻造器、D14、owned-resources），合计 **276 项**，均 `--maxWorkers=4`。
- TypeScript 与生产构建通过；2D 顶层 JS 用 Node 默认 `gzipSync` 合计 **632,800 B ≤ 637,144 B**，没有新 lazy chunk。
- 内容／回放身份只读检查通过，仍为 `fnv1a32-utf16:f671ab88` / `fnv1a32-utf16:36ebfac2`；`git diff --check` 通过，`tests/fixtures/` 与 `docs/evidence/` 无差异。未提交，未编辑本地素材。
- v25 digest 比较通过；重跑总检查在 `record-battle-start` 的 `docs/evidence/v25-online-rules/battle-start-audit.json` 源码 SHA 比较处失败，先行的 battle-start fixture 字节比较已通过。该既有源码审计差异仍按工单留待 D5，不运行 `--write`，不宣称 v25 总检查全绿。

## 前轮五项复核验证记录

- Opus 复核修正后，D3 专项 67 项、相关回归 271 项，共 338 项通过（均 `--maxWorkers=4`）；包括多个暂留锻造器直接打开/出售、出生与消费账本、腾席回席、部署后空席恢复认证、6-7 后加时不重启、不绕过返回容量、三处显示投影，以及原单人/八席 Room/bot/选秀/3D 标记回归。
- TypeScript 检查与生产构建通过；2D 顶层 JS 默认 gzip 合计 **632,797 B ≤ 637,144 B**，未增加 lazy chunk。
- 内容/回放摘要检查通过，仍为 `fnv1a32-utf16:f671ab88` / `fnv1a32-utf16:36ebfac2`；v25 digest 比较、552 个历史文件与保护 manifest 的字节检查通过。
- v25 总检查仍在 `battle-start-audit.json` 的源码 SHA 审计停下；此前比较的 battle-start fixture 字节相同。该来源审计按工单留待 D5，不宣称总检查全绿。没有 `--write`，没有修改 `tests/fixtures/`；`playtest-1022b-bench.test.ts` 产生的计时 JSON 已用 `git show HEAD:` 还原，`docs/evidence/` 无差异。
- 无浏览器连接，未做 2D/3D 实机目视和交互验收。

D5 注册时还须一并纳入内容归档/摘要、内容总数校验与研究阶段标签/禁令生成；本任务不预先开放任何候选。

## 2026-10-30 历史 pending-capacity 出售重试修复

结论：真 bug。没有“旧回合待发改在运力不足结束时统一发放”的规则依据。§权威行为要求先回席、再重试奖励；`M8B_CONTRACT_ADDENDUM.md:130` 要求完成自选后在 settlement 出售释放空间，由领域自动重试；阶段解除本身不触发直接掉落重试的约定仍保留。

原因与定位（以下为修复后的行号）：

- `pve-loot-carry.ts:22` 将非致命败局未击杀载体的奖励顺延至下一 PvE；因此案例中的 2-7 奖励在 3-7 才首次尝试，不是从 2-7 起每轮一直处于容量待发。
- `match.ts:584` 先发当轮奖励，`:585` 再以显式列表发到期的顺延奖励。`loot-runtime.ts:155` 在容量不足时把英雄变为 `pending-capacity`；`loot-runtime.ts:209` 的到期查询只筛 `carried`，故首次失败后不会再次从该查询出队。
- `match.ts:424` 检测全部待发、允许合法容量出售，`:437` 调 `grantDirectLoot` 重试。但旧实现 `loot-runtime.ts:128` 只取 `currentPlan(state).encounterPlan.drops`，遗漏来源仍为 2-7 的条目；3-7 本轮条目在该计划内，所以出售后能发放。全局待发守卫仍拦 Continue，旧条目既不丢弃也不发放，实际卡住对局。
- 原 `b8-restore.ts` 的 `replayCurrentSuffix` 只为当轮 direct 建立待发预期，顺延条目按最终 `granted` 状态倒推为结算前授予；出售重试也只遍历当轮 direct。故原实现中“只有旧待发”的出售结果还会被 `capacity sale boundary` 拒绝恢复。

修复：`loot-runtime.ts:131` 默认按冻结回合顺序收集交付轮为当轮的历史容量待发，再按当前计划处理；每轮内部保持 `sourceUnitId → slotOrdinal → entryOrdinal` 的原顺序。容量再次用尽的条目保留、后续出售继续重试；已授予条目沿原状态和唯一收据跳过。显式 `claimedDrops` 与联机领取仍仅处理指定列表，不提前领取其他奖励。`b8-restore.ts` 独立重演顺延奖励的首次尝试、出售后的 FIFO 重试、完整收据顺序与最终状态，不以最终收据自证更早的发放时机。`content/loot.ts:15` 将运行时修订标识改为 `orb-combo-v17-capacity-fifo-v1`；输入输出、失败原因、存档形状、冻结抽样和 RNG 不变。

两个顺序分别保留：**结算首发是当轮先于顺延**（`match.ts:584-585`，原有行为）；**出售重试按 dropId 排队，即旧回合先于当轮**（`M8_RULES.md:185`）。本修复不改变这两个顺序，恢复重演分别按首发顺序和出售重试顺序验证。

新增 `tests/over-encumbered-pending-capacity.test.ts`：

- `:18` 两个自然种子用公开命令选卡、购买储备并走完阶段；每回合独立验证序列化前缀，沿用原 5 秒限制。
- `:56` seed 6133 在 3-7 有 4 条旧 2-7 容量待发，首次出售全部发放；seed 6389 有 3 条，第一次按序发 2 条后满席，`:96` 再出售发最后 1 条。出售不重算既有经济、XP、成长、战斗输入或 RNG。
- `:90` 对象、JSON 对象、规范序列化文本三入口恢复，恢复后的出售结果完全一致；`:110` 拒绝重复/乱序旧收据；`:121` 恢复后继续 4-1 不重发。
- `:148` 独立纯授予向量用真实冻结 payload，让旧/当轮奖励竞争单个空位，验证逐次 FIFO、重复重试无事件，以及显式领取范围不扩散。

摘要影响（只读重算，未重录任何生成常量、纪元或 golden）：基线 `recomputeContentDigest()` 已为 `fnv1a32-utf16:8f298696`，与保存常量 `1d3bc95f` 不同；本次运行时修订使重算值变为 `fnv1a32-utf16:5b7b22ac`。`recomputeLootReplayDigest()` 前后均为 `fnv1a32-utf16:a56b2c4a`，与保存常量 `73d95fed` 的差异属于基线已有漂移。历史源码 SHA 与修复路线的命令/奖励轨迹也会变化，交由统一重录处理；不宣称纪元门禁已通过。

验证命令均使用 `--maxWorkers=2 --configLoader runner`。本工作区没有浏览器连接，纯领域测试使用忽略目录内的 `artifacts/a4-vitest.config.ts`，只省去原 globalSetup 的浏览器启动，保留原项目筛选、worker setup、断言和超时，并把 Vite 缓存放到可写 `/tmp`。

- 新增专项加 `pve-loot-carryover.test.ts`、`m8-b8-loot-runtime.test.ts`：**103 项通过**，其中新增专项 **82 项通过**。
- 额外运行的 `m8-b8-live-capacity.test.ts` 在收集期被独立 oracle 的强化候选前提阻塞（期望 `pandoras-items-ii/academic-research/replication`，实际 `noxian-guillotine/academic-research/rebel-resurgence`）；`b8-late-claim-receipt-order.test.ts` 的 **24 项**停在 seed 21 的 2-1 报价不含 `inspiring-epitaph`。两份文件以只读 HEAD 源码替换本次三个生产改动文件重跑，得到相同失败，故保留原测试与 fixture，不重录。
- `over-encumbered-settlement-restore.test.ts:81` 原路线在 3-7 实际为 **0** 条待发，原断言要求 **3** 条；后续容量出售因此 `wrong-phase`，共 **6 项失败**。同样以只读 HEAD 源码运行完整文件得到 **70 通过／6 失败**，与修复版一致。没有修改该文件的输入或任何断言。
- 最终指定命令 `npm test -- tests/over-encumbered*.test.ts --maxWorkers=2 --configLoader runner --config artifacts/a4-vitest.config.ts`：**4 文件，331 通过／6 失败**，失败均为上述基线问题；新增专项 **82/82 通过**。日志为忽略目录内 `artifacts/a4-final-d3.log`。`npm run typecheck`、`git diff --check` 均通过。

剩余事项：原路线测试的强化候选/掉落前提与摘要纪元由集成任务统一处理；本修复留在工作区供 Claude 审查提交。未运行全套、Vite build、浏览器或任何 `--write`，未编辑服务器、界面、本地素材、历史 fixture/evidence，也未写入 git。

## 第二轮审核：顺延交付轮防篡改

seed 23 的自然对局在 3-3 settlement 有一条来源 2-7、交付轮 3-7 的英雄处于 `carried`。上一轮实现允许将其篡改为 `pending-capacity` 后恢复，并在出售时提前发放；`retained-terminal` 也缺少交付边界验证。

- `b8-restore.ts` 的 `validateEligibility` 与历史 direct 校验均要求：非当轮来源的 `pending-capacity`／`retained-terminal` 必须有交付轮等于当轮的 carry，且当轮战斗已经 `finished`。`carried` 只允许交付轮晚于当轮，或等于当轮而战斗尚未结束；不允许已到期条目伪装为仍在顺延。
- `loot-runtime.ts` 的历史 pending 集合只包含 `carry.deliverRoundId === state.roundDefinitionId` 的条目，与恢复重演的 `carriedDirect` 范围一致。即便内存状态被直接篡改，出售也不会提前发放未来交付条目。
- `tests/over-encumbered-pending-capacity.test.ts` 新增 seed 23 的逐轮公开命令路线，覆盖提前篡改的三入口拒绝（`serializeMatch`、`restoreMatch(obj)`、`restoreMatch(JSON)`）、合法存档三种恢复及续跑一致、出售的实时防御；另用原 seed 6133／6389 路线覆盖交付轮战斗未结束时拒绝容量状态、合法 `carried` 可恢复、战斗结束后拒绝 `carried`。纯授予向量补齐真实到期 carry 前提，原 FIFO 与显式领取断言保留。

本轮新增 **32 项**，专项共 **114 项全部通过**；修复前 seed 23 的两个提前容量状态与出售防御用例均失败，证明回归命中了原漏洞。最终运行：

```sh
npx vitest run --configLoader=runner --maxWorkers=2 --config artifacts/a4-vitest.config.ts tests/over-encumbered-pending-capacity.test.ts tests/pve-loot-carryover.test.ts tests/m8-b8-loot-runtime.test.ts tests/over-encumbered-settlement-restore.test.ts
npm run typecheck
```

四文件 **205 通过／6 失败（211 项，无跳过）**。沿用上轮纯领域配置，未改变任何断言、检查或超时。失败仍是原 settlement 路线 3-7 预期 3 条待发、实际 0 条及其后续 `wrong-phase`。使用 `artifacts/a4-baseline-vitest.config.ts` 只读加载 HEAD 的 `b8-restore.ts`、`loot-runtime.ts`、`content/loot.ts`，复跑后两个文件得 **88 通过／同样 6 失败**，失败用例名称逐项一致，没有新增失败。日志分别为 `artifacts/a4-round2-tests.log`、`artifacts/a4-round2-baseline.log`。`npm run typecheck` 与 `git diff --check` 均通过；未重录纪元、摘要或 golden，未运行全套或 build，改动留在工作区供 Claude 提交。


## 第三轮审核：顺延 forge 满席失败的恢复豁免

第二轮的 `pve carry delivery boundary` 误拒合法锻造器：`grantDirectLoot` 的 forge 分支满席时不改状态，交付轮结束后仍为 `carried`，且不阻止 Continue。`b8-restore.ts` 仅为冻结 payload 为 forge、交付轮已过或当轮交付战斗已结束的条目豁免此时间限制；英雄与自选的严格边界、顺延来源认证、收据和资源重演保持。

`tests/over-encumbered-pending-capacity.test.ts` 新增 seed 249 的真实公开命令路线：2-7 的自然金色法球包含完成装锻造器与两个英雄，出售棋盘英雄输掉该轮后顺延到 3-7；九格满席让锻造器保持 `carried`、两个英雄进入 `pending-capacity`。用较早的自然 forge 掉落覆盖与巨蟹铁砧相同的直接授予分支，不改写合法状态、冻结计划或收据。三种恢复形式覆盖交付前后、出售结果一致、Continue 到 4-1、战中逐步续跑一致、4-1 战后及 4-2；每项沿用原超时。负向检查在同一真实状态把英雄进度改回 `carried`，三入口必须明确报交付边界错误，另验证把 forge 冻结 payload 换成 unit 时三入口仍拒绝。

本轮新增 **28 项**，指定两文件共 **145 项全部通过，无跳过**；直接使用仓库配置执行 `npx vitest run --configLoader=runner --maxWorkers=2 tests/over-encumbered-pending-capacity.test.ts tests/pve-loot-carryover.test.ts`，未加临时配置。`npm run typecheck` 与 `git diff --check` 通过。未修改既有断言、超时或阈值，未运行全套、Vite build 或重录，改动留在工作区由 Claude 提交。
