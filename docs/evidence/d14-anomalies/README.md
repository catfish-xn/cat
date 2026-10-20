# D14：终极英雄 / 进入未知，独立新增机制包

**未生产生效。** 生产报价、Match、restoreMatch、服务器和 UI 均未接入本包。此 PR 不表示 D14 已可玩；交付是可执行的选择/永久晋升/托管归来事务、数值投影和独立认证恢复 API，不是空定义。名片/纹章链、D7、D11 实现、TASKS.md、本机与素材均未触碰。TASKS.md 由父会话回填。

## 基线与范围

- 仓库 catfish-xn/cat，目标 multiplayer，分支 codex/anomalies-ultimate-unknown。
- fetch 最新完整基线：`a0d42c592cbd48fb075175e5f61818dabfe1b320`。
- 推送前重新 fetch 的 multiplayer 已前进到 `79bdfdc2ca34c6de86081baa3054eb085757343a`（PR229 心跳；仅服务器、UI、合同与对应测试，未改 simulation/所有权/内容）。施工分支保持原始基线，没有把这些无关 UI/服务器变更移入本任务，也没有改写历史。
- PR231 查询结果：open、merged=false，头 `6392f319baf9ea6237e0cf8338190cd20f463546`；本基线不含 D11。只读参考 `origin/codex/content-augments-anomalies-fill` 的证据及缺口说明，未合并、未移植其机制。
- 开工前 `ls-remote --heads` 没有同名远端分支；GitHub connector 按 head 搜索所有状态无同名 PR。CLI 的 GitHub API 被环境返回 Forbidden，已使用可用 connector 完成只读核对。
- 仓库 AGENTS.md 已读；仓库没有 `.agents`，环境 `/workspace/.agents/skills` 不存在，没有可用相关本地 skill。只新增 `src/simulation/d14-anomalies/`、两个测试和本证据目录。
- 保留生产异常 52 项、digest `fnv1a32-utf16:ea6b11b6`。未改注册表、版本、digest、既有数值、已有测试/夹具、timeout、断言或 golden；不跑全套。

## 逐项来源对账

保留档案目录 `src/simulation/content/source/s13-14.24b/raw/` 的实际上游版本为 **14.24**，不是完整的 14.24b 执行脚本。gzip SHA256、原始记录、标准池指针、原始中文字符串及全部 rank-4 技能字段见 [source-excerpts.json](source-excerpts.json)。测试直接解压档案核对，未替换归档字节。

|效果|raw 指针 / API|已核实内容|
|---|---|---|
|终极英雄|`{cf1ee294}` / TFT13_GoopBuff_UltimateHero|NumRounds=3；中文 description 为 3 星 1 费升 4 星；排除 AnotherAnomaly|
|进入未知|`{711fd99c}` / TFT13_GoopBuff_IntoTheUnknown|NumRounds=3，GainedAD=0.5，GainedAP=50；描述明确离场与归来时获得增益；排除 AnotherAnomaly|
|归来标记|`{560f71cc}` / TFT13_GoopBuff_IntoTheUnknown_ReturnState|布尔单位属性定义，仅能证明有此属性，不能凭名字推断执行时机或归位规则|
|标准模式准入|TFTSet13 → `{e6ddca72}`；TFTSet13_Evolved → `{cc0b6cb2}`|两池 `{9a7587b2}` 通过 `{16c534fd}` 正引用两个异常，没有擅自改权重|
|四星技能|`en_us.json.gz.setData[mutator=TFTSet13].champions[*].ability.variables[*].value[4]`|14 个一费英雄，每个变量取实际 rank 4、按已有规范 round4 后转整数×10000；不把三星期望外推为四星技能|

原始身份别名显式映射：Fish→steb、Shooter→maddie、Blue→powder、Red→violet；其余原 API 后缀转小写。rank-4 表冻结且只供终极英雄专用证书消费，不新增任何通用四星获取/合星接口。

复查的第一手来源：
- [CommunityDragon 14.24 map22](https://raw.communitydragon.org/14.24/game/data/maps/shipping/map22/map22.bin.json)（本次 web 工具无法直接打开大文件，采用已哈希的本地归档）。
- [CommunityDragon 14.24 en_us](https://raw.communitydragon.org/14.24/cdragon/tft/en_us.json)。
- [Riot 14.24 公告，含 12/17 B 更新](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/)：明确终极英雄新增 3 回合延迟；B 更新明确辛吉德四星减伤由 70% 降至 60%，因此新增四星投影用 DR=6000，raw 表仍保留 0.7。已有一至三星表不改，既有有意覆盖保持原样。
- [既有 D3 Q3 来源核对](../s13-d3/Q3_SOURCE_REVIEW.md)：已查 raw、14.23/14.24 官方公告仍无法确认满席、交互限制、特殊回合计数。本次再次读 raw 和 14.24 公告，没有取得能补足这些缺口的脚本；不把“未找到冲突”当作原版事实。

## 每条项目约定、建议与值

下表是可审阅的项目执行政策，**不是已恢复的原版脚本事实**。Q2 范围按用户 10-19 仅终极英雄专用永久晋升；Q3 在查询原版不能确认后采用托管兜底。新提出的数值及执行选择留给集成审阅，本包不生产激活。

|编号|本包执行值 / 行为|证据性质 / 建议|
|---|---|---|
|D14-C1|以选择时 lastSettled ordinal 为基点，未来第 3 次真实结算晋升/到期；同轮重报不推进，禁止跳轮|3 来自 raw；按 ordinal 计、准备阶段生效是项目时序约定；建议接唯一权威结算屏障|
|D14-C2|轮选/补给与加时都计一次真实 ordinal|复用已交付 Q3 兜底；原版特殊回合细节未知|
|D14-C3|进入未知离场单位和附着装备从可见 preparation/items 移到 D3 held；保留 unitId、星级、绑定、成长与共享池来源；不能出售、装备或复制此目标，也不参与可见合星|Q3 托管政策；不将离场冒充死亡、出售或退池|
|D14-C4|到期先空板凳（slot 升序），再合法棋盘（row/col 升序）且不超人口；满席继续同实例托管，后续 settle/deploy/sell/claim 腾位再归来|复用 D3；不恢复原格、不挤人、不随机选位；原格仅证据。建议保持此政策直至取得同版本执行证据|
|D14-C5|归来才启用 AD +5000Bps / AP +50；full-seat 到期但未放置时不授予。与其它 statPercent 求和、flat 先加、最终 floor；跨战斗永久，正常合星随绑定迁移，出售终止|数值来自 raw；持久性、叠加顺序及迁移是项目解释，建议按现有唯一效果解析器执行，不在两个地方重复加|
|D14-C6|终极英雄的有效星级永久为 4，物理持有单位仍 3 星 / 9 个共享池份额；不新增单位、装备、金币、RNG 或额外 18 个池份额|专用晋升证书设计；不会被普通三合一或跨战斗清理回退；有效星级与物理份额必须分开|
|D14-C7|四星 HP/AD 暂按既有 100/180/324% 序列再递推一次为 **583.2%（58320Bps）**，从现有生产 1 星底值 floor；其它基础属性保持，技能用实际 rank 4|**来源缺口，暂行项目约定/建议值，未核实为原版四星基础倍率**。本次检索归档与官方公告未取得此倍率的版本执行证据；集成前须显式评审，不伪称事实|
|D14-C8|已晋升单位仍按 9 个物理份额出售：一费售价 9 金、退池 9；不复制晋升，出售清绑定/返装备并退休证书|项目物理所有权政策；不是原版四星售价的考证。建议专用晋升维持真实资源守恒，而非套用普通四星 27 份|
|D14-C9|仅在场普通英雄可绑定；终极英雄额外要求 3 星 1 费及完整 rank-4 表；每席仅接受一个独立认证异常选择，已有绑定拒绝|保守项目选择边界；AnotherAnomaly 排除来自 raw，本包不实现其它异常共存|
|D14-C10|一次选择仅一次证书；ID 相同内容相同返回原 state、空事件；同 ID 冲突拒绝；接受的无副作用结算仍记录命令但不发资源事件|项目收据与重试规则；固定纯函数，无时钟/网络/随机数|

## 公共接口与独立恢复合同

导入路径 `src/simulation/d14-anomalies`；完整参数类型见新增 `types.ts`。

```ts
createD14State(boundary: D14Boundary): D14State
transactD14(state: D14State, command: D14Command, authority: D14Authority): D14Result
projectD14Unit(state: D14State, seatId: string, unitId: string,
  otherSources?: readonly SourcedEffect[]): (ResolvedEffects & {
    effectiveStarLevel: 1 | 2 | 3 | 4; physicalStarLevel: 1 | 2 | 3;
    unitId: string; location: UnitLocation
  }) | null
restoreD14(input: unknown, boundary: D14Boundary, authority: D14Authority,
  verifiedCommands: readonly D14Command[]): D14State
serializeD14(state: D14State, boundary: D14Boundary, authority: D14Authority,
  verifiedCommands: readonly D14Command[]): string
```

`D14State` 持有 D3 OwnershipState、选择/阶段/到期 ordinal/当前绑定身份的 records，以及完整已接纳 commands；`activation='unwired-d14'`。`select` 需要与 authority.selections 的独立认证事实完全一致；authority.ownership.grants 是独立资源奖励清单。`resources` 只透传 acquire/claim/duplicate/deploy/sell/merge-live/equip，禁止用通用 hold/settle 绕开异常计时；`settle` 只接受当前或下个真实 ordinal。成功 `{ok:true,state,events}`；失败 `{ok:false,state:原引用,reason}`，没有可提交的中间资源/事件。

失败枚举：继承 D3 `invalid-state, invalid-transaction, receipt-conflict, unauthorized-grant, already-acquired, unknown-seat, unknown-unit, unknown-item, unknown-duplicator, unknown-holding, not-inventory, not-returnable, invalid-round, full-seat, pool-empty, invalid-target, invalid-location`，新增 `unauthorized-choice, unsupported-operation`。非法目录 roundId 当前归为 invalid-state；合法目录内跳轮为 invalid-round。投影对未知 seat、非法晋升证书抛 RangeError；不在可见阵容的 unit 返回 null。

恢复四者分离：候选存档、可信初始共享边界、独立认证奖励与选择、独立认证完整接纳命令日志。先匹配日志，再从可信边界逐条重演，最后比较整个候选（包括多余字段、装备、池份额、绑定、时序、证书、所有资源事实）。不得将 candidate.commands 当 verifiedCommands，不得从 candidate 自造 authority/boundary。模块不能独自认证外部输入的可信性或阻止无外部检查点的整体历史回滚。恢复不发事件、同命令重试不重复授予。

**所有 restoreD14 测试都是独立 API 测试。未调用/修改生产 restoreMatch；没有宣称生产保存格式支持这些机制。**

## 最小接线依赖 / 尚未完成

1. **生产内容选择**：由最终集成方将两个异常接目录、目标条件和实际 schedule receipts，认证选择并提供正确 lastSettled 边界。不能把 raw 定义或此模块的导入当作已注册内容。
2. **唯一资源权威**：将 D3 输出作为后续共享池、单位、装备、金币、绑定和成长的同一事务视图；不能与旧 MatchState 混用。现有购买、部署、合星、装备、出售和结算需统一适配，所有席位保持共享池原子提交；新模块没有改这些旧入口。
3. **回合生命周期**：每个实际结算触发一次 settle；新准备期与满席腾位触发 D3 的同实例归位。死亡/胜负/淘汰与最终释放要从同源资源事实集成，本包不调 Match 结算。
4. **战斗编译**：只用可见 D3 preparation 算人口/羁绊与阵容；把全部装备、羁绊、成长源一次传入 projectD14Unit，在 resolveEffects 前替代基础属性/技能求值。null 表示离场，不得编入战斗。独立测试手工把真实投影交给现有 combat 引擎，不能据此宣称 buildStrategySnapshot 已接入。
5. **有效星级消费**：现有 Unit.starLevel/StarLevel 仍为 1–3。集成方需仅对终极英雄读取 effectiveStarLevel=4，覆盖星级比较（例如 bully）、友谊之力/使者等按星级效果、对手伤害、展示数据与四星恢复校验；不能把物理星级粗暴改 4 而让共享池误算 27 份。此部分受“只能新增文件”限制尚未实现，UI 由其负责人接数据，不在本 PR 修改。
6. **持久化/回放**：保存 D14 全快照和独立验证命令证据，生产 restoreMatch 先验证边界/来源，再调用 restoreD14，并把经过认证的四星基础/技能投影用于战斗重建。当前 m8/restore 的 1–3 星基底会拒绝额外四星 HP/技能，必须由集成方显式适配，禁止放宽校验蒙混过关。
7. **统一版本与验收**：注册表、版本、digest、既有夹具与端到端场景由最终集成方处理；本次不更新。D14-C7/8 建议政策及生产星级语义需集成审阅，本包只提供明确可测试的方案，不声称原版完整复现。

## 验证

最终 4 文件 **120/120** 通过（新增 D14 46 项、原有回归 74 项），Vitest **3.20s** / shell **3.711s**；tsc 通过 **12.286s**。命令、条数及实际耗时写入 final-validation.json，完整最后一轮日志在 validation.txt。只运行新增 D14 两文件、复用 D3 所有权文件、已有异常文件，以及 tsc；不跑全套、不改测试门槛、不跳测试。

主效果独立数值：Lux 三星 1620HP/97AD，专用四星约定投影 2916HP/174AD，rank4 技能 1260 伤害/300 护盾；实际引擎普攻 174、强化魔法 1260。进入未知 Lux 1星归来 45AD/150AP，实际普攻45、强化魔法540；合并 +10AD flat/+20%AD/+25AP 外源得 68AD/175AP。正常升星绑定转移到另一个 survivor 后保持 81AD/150AP；复制体不继承。含等待/晋升/暂离/归来独立恢复正控、相同续步与幂等，以及证书、时钟、装备、位置、身份、金币、卡池份额、物理星级、资源事实、日志删改/整体回滚/伪造选择拒绝。
