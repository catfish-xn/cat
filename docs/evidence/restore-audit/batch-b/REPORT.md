# B 批准备期经济一致性修复：功能候选，性能未闭环

## 固定版本与状态

- 分支：`codex/restore-fix-batch-b`
- 起点：`d9cf5829549e275cd8322019933b971c6e1e1614`（当次核实的 `origin/multiplayer`）
- 代码/正式测试 WIP 提交：`0e33b306238c43ebb1da4a1bf78f3236d15b1989`
- 对应 tree：`28e3ead55ae30654a02beb76011fce1fcf8f775e`
- 本报告与原始日志另做证据提交，不把证据 HEAD 冒充受测代码 SHA。
- 依据：审查分支 `546d086` 的 MA1、MA2、MA2b。没有改动其他批次的规则、数值、版本、digest、夹具、CI、超时或服务器/界面文件。
- **不是签收或可合入结论。** 新增功能专项通过，但现有 B5 历史装备测试出现真实性能回退；没有全套验证，也没有 33 战性能验收。

## 权威和接线

新增 `MatchBase.preparationLedger`：

- `version: 'preparation-command-ledger-v1'`
- `commands: readonly { name, args, repeats }[]`：只记录成功且产生新状态的玩家公开命令输入，不接受“授予任意金币/物品/单位”这类外部奖励指令。
- `events: readonly MatchEvent[]`：完整 Match 域事件历史。`accept` 在学院授予、选择弹出、结算等原有副作用全部完成后，原样记录加过序号的 Match 事件；战斗域事件仍由原有战斗档案负责。

记录入口：部署、买入、卖出、锁店、刷新、买经验、开战、step、下一轮、消耗品、合成、装备、选异常目标、刷新异常、选择结果、领取已存在 G23 奖励。`chooseG23Junker` / `chooseG23BlackMarket` 复用已记录的 `selectChoice`，不双记。失败返回原对象；锁店同值和非战斗 step 等原本 no-op 不记日志。

重建只以 `createMatch(seed)` 为起点，逐条调用同一真实公开命令。上一战的实际重演生成结算余额，下一轮准备收入/支出在此基础上真实执行。不以候选存档的 `goldBefore`、结算余额或中间快照为重放起点，不调用恢复/序列化递归自证，不做跨调用缓存。

连续 `stepMatch` 以 repeats 压缩。进入循环前要求整数、至少 1、至多生产规则 `MAX_COMBAT_TICKS = 1200`；其余命令 repeats 必须为 1。每次重放还必须实际成功且改变状态；没有按未核实计数 `Array.from` 分配。免费部署和锁店操作理论上无穷，不添加任意命令数量上限；只遍历输入里真正存在的日志条目，文件层沿用原体积限制。

最后比较：gold、level/xp、shop 全体（含 generation/锁店/槽位）、四个 RNG、完整 Match 事件、nextMatchEventSeq（也必须等于重演事件条数）、命令规范化结果、当前战斗身份/tick/status/result、round/phase、roundResults、combatInputBasis、scheduleReceipts、resourceProvenance、阵容/装备/强化/异常/成长、序号、HP、seatMechanics、consumables/reforgeState、equipmentState/temporaryEquipment、m8 掉落与准备状态。

对象入口保留原结构/来源校验及动态 getter 资源拒绝顺序；账本最终核对放在独立 `structuredClone` **之后**，验证实际返回图，防止 getter 在校验后读入不同 gold/commands。JSON 入口核对已解析且独立的数据图。之后才执行原有不可变元数据共享。

公共函数参数与玩法返回事件不变。新增的是强制持久态字段和恢复约束。multiplayer/shared/carousel 状态仍不属于 `restoreMatch` 离线档入口；本轮不把服务器任意授予、回调式 UnitLootPolicy 或外部共享布局列入可由存档自报的命令。

## 正反例与原审计闭环

1. `tests/restore-audit/match-authority.test.ts`：MA1/MA2/MA2b 原“接受篡改”改为具体错误断言。金币、免费经验、协调改金币/经验、四 RNG、商店代数、事件序号、缺账本共 10 项，对象/JSON 均拒。
2. `tests/restore-audit/preparation-ledger.test.ts`：16 项。
   - seed 42 和 1：真实非空首战，记录原始 BattleHistory，正常进入下一准备期，只改 gold+1；对象/JSON 拒 `Invalid Match save: preparation-ledger-gold`。
   - 同一原始 battles 不变，`validateBattleCollection`、`validateEnvelope`、`validateFile` 都拒；空历史回调也不能跳过 Match 账本检查。
   - 合法集合/文件正控通过。
   - 足够金币的真实公开路线至 2-2，伪造买 4 XP 同时扣 4G，双入口仍拒，不能仅算术配平。
   - 多轮买卖、刷新和买 XP：准备路径执行 5 轮，使用空场快速结算；随后恢复部署实际单位，进行一场非空战斗，tick 1 保存，对象/JSON 恢复后逐 tick 比较整个结果（状态和事件）。**不把这项写成 5 场大规模战斗性能验证。**
   - 失败/no-op 不记日志；伪造十亿 repeats 在循环前拒；删除/改名事件拒；任意外部 grant 指令拒。
   - gold / commands getter 仅在 structuredClone 时偷换，仍拒。
3. 本基线没有 #157 的 `battle-record-validation.ts` / `serialization-structure.ts` 拆分文件。实际历史入口是 `src/replay/history.ts`，文件入口为 `src/persistence/format.ts` / `compatibility.ts`。按本基线实际路径验证，不冒充已测试 #157 的历史参数接口。
4. 日志能够证明状态存在一条合法、确定性的公开命令轨迹；它不是用户动作的签名或不可修改审计凭证。攻击者若重新构造另一条完整合法轨迹及所有对应状态，属于另一个合法对局记录，不应把本实现描述成密码学防篡改认证。

## 相关测试结果（未跑全套）

命令口径均为 `npm test -- <相关文件>`，没有调整 pool/workers/isolate、时限或门槛。typecheck 使用 `npm run typecheck`。

| 文件 | 结果 | 运行总耗时 |
|---|---:|---:|
| restore-audit/match-authority | 10/10 | 与专项一起末轮运行见日志 |
| restore-audit/preparation-ledger | 16/16 | 4.83s |
| m5-serialization | 33/33 | 3.15s |
| m6-replay | 9/9 | 4.53s |
| m8-b8-restore-fold-reuse | 5/5 | 2.24s |
| m6-persistence | 44/44 | 3.80s |
| m5-economy | 42/42 | 0.283s |
| m5-command-phases | 13/13 | 1.73s |
| m8-b8-restore | 7/7 | 6.80s |
| m8-b5-equipment-history | 5 过 / 3 失败 / 1 未执行 | 69.08s |

9 个全通过文件共 179 项；计入 B5 为 184 过、3 超时、1 因 hook 失败未执行。该“未执行”是 Vitest 在 hook 失败后的结果，不是新增 skip。最后 typecheck 通过。源码及测试最终 SHA 如上；日志保留开发期间每次结果，不能把早期相关文件结果当成某个远端 CI 结论。

### 必须保留的失败

- 第一次新增集成测试：假设 `createMatch(42)` 已有 Match 事件，但开局事件为 0；改用实际完成首战后的事件历史，保留日志 `b-ledger-integration.log`。
- 最后配平负例初版：首战后只有 2G，不能声称可扣 4G；两 seed 均失败。改用公开路线 2-2 达到真实资金，再实施同一篡改，保留 `b-ledger-final-targeted.log`；最终16项日志为 `b-ledger-final-targeted-fixed.log`。
- 初期 typecheck 的泛型索引/测试窄化问题已修，原日志保留；最终 `b-ledger-final-typecheck-fixed.log` 通过。
- **B5 是实际新增性能回退，不能归入旧 fixture 或偶发**：
  - historical level5 forged as level7：5076ms > 5000ms；
  - legal pre-F through settled/historical：16169ms > 5000ms；
  - same-round F first equip：9951ms > 5000ms；
  - archived save envelope 的原 beforeAll >10000ms，导致一项未执行。
  - 未修改原文件、断言、门槛，也未无变化重跑。

## 有限性能定位及停止点

`profile-test-source.txt` 是临时诊断测试原文，未进入默认测试目录。可将它放回仓库 tests 根目录的临时文件，通过相关单文件命令复现，然后移出；不修改其原时限。它复用 B5 的完整真实路线，并只对一次生产恢复启用 Node inspector CPU profiler。

原始文件：`b-ledger-profile-result.json`、`b-ledger-restore.cpuprofile`、`logs/b-ledger-profile.log`。

- 目标 4-5，ordinal 22；196 条压缩命令，90 条 Match 事件，7216 个实际 combat step。
- 准备 3652.38ms；**带 profiler 的单次 restore 3151.23ms**。此插桩时间不能和未插桩验收数据直接比较，也不代表性能门禁通过。
- CPU 采样累计：restore 2699ms，账本重演2674ms，stepMatchImpl2561ms（约95.8%账本重演采样）；记账 recordPreparationCommand 合计约37ms，事件追加<1ms。
- 主要成本是重打既有战斗，不是复制命令数组。为约1%开销引入私有缓冲/缓存不能解决三个超时，因此本轮没有盲目追加优化。
- 诊断测试总准备+采样超过原5秒，诊断自身报超时；保留全部输出，不作为正式通过数。

单次恢复为历史战斗线性重演；集合逐条 context 验证会重复前缀，整体可能呈二次成本。**33 战未执行。** 后续应设计一个仅覆盖单次 envelope/collection 调用的验证作用域，复用该次已真正重演并核实的前缀；不得信任自报快照，不得跨调用缓存，不得通过减少历史检查或放宽时限解决。还须保持 #157 的 history 参数和证据合同，不能以旧单参数接口覆盖其规则。该方案本轮未实施，需要另行明确集成设计。

## 格式版本、交接与未完成

- 缺 `preparationLedger` 的旧 Match 明确拒绝 `Invalid Match save: preparation-ledger-missing`，无迁移/补账后门。
- 本提交按要求没有改任何版本号。集成时须统一升级 Match schema（当前7）、存档格式（当前3）；战斗档案 context 内嵌 Match，因此 replay 格式（当前3）也须同步评估/升级，并绑定一致的恢复规则身份。精确版本字符串由合并顺序决定。
- commandProtocol 参数未变；内容数值与目录未变，不为本批随意改 CONTENT/LOOT digest。若最终统一 policy/rules/content revision，须由集成负责统一更新关联身份和夹具。
- 旧 raw fixture 不含新强制账本，最终迁移应由合法公开命令重录；本轮没有重录，不能通过补伪造日志让旧 fixture 看似兼容。
- 未完成：B5 性能回归、33战与全套、最终版本/夹具迁移、远端 CI、独立签收、合并。不可宣布可合入。
- 平台推送受限，交接使用 git bundle；不绕过，不把本地提交描述为远端存在。
