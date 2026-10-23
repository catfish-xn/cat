# 安蓓萨真实冲刺：缺证报告（2026-10-23）

后续状态（2026-10-23）：协调者转达新任务，授权按 **P（项目决定）** 先行实现锁链最近空邻格、拳击后撤 1 格；等待用户最终决定后才可合并，之后统一 v22。实现与验证见 [AMBESSA_DASH](AMBESSA_DASH.md)。本报告以下“未实现/暂停”为上一轮缺证核查的历史结论，来源缺口仍然成立，不改写为原版已证实数值。

原核查状态：**未实现，按用户“查不到就停下”要求停止规则修改**。仅增加本报告与 UI 请求状态，不交付冲刺事件或落点算法。

分支 `codex/ambessa-dash`，起始 HEAD `5d7fb72ccd6169728e1794d6ed07264a1f3883c4`，与本地远程跟踪引用 `origin/codex/encounters-pr9-epoch` 相同；未联网核对 PR 状态。初始工作区干净，`node_modules -> ../cat/node_modules`。

## 数据来源与缺口

| 仓库来源（文件:行） | 可确认内容 |
| --- | --- |
| `src/simulation/content/source/s13-14.24b/provenance/manifest.json:3` | 参考版本 S13-14.24b，归档版本 14.24；第 16 行记录原始 en_us SHA-256。 |
| `src/simulation/content/source/s13-14.24b/normalized/g2-2-champions.json:125` | 锁链施法冲向目标后打击；拳击短暂晕眩、砸击后冲刺撤离。两姿态方向和先后关系不同，不能都实现为向目标前冲。 |
| 同文件 `:128` | 完整 ability.variables 只有 PercentChainAttackAD、PercentStrikeAD、PercentOmnivamp、AttackSpeed、SlamDamageAD；到第 189 行结束，没有距离、速度、冲刺时长或撤离终止条件。 |
| `src/simulation/content/g2-2-abilities.ts:43` | 运行时技能忠实保留上述描述和五个变量；没有可直接使用的位移参数。 |
| `docs/evidence/g2-2/RECONCILIATION.md:72` | 对账表同样只有这五个变量。第 560 行明确记载原有限实现无冲刺，短晕固定 5 ticks。 |
| `docs/UI_REQUESTS.md:1225` | Claude 要求权威落格、冲突、撤离距离与时序，并同步 replay 白名单。 |

另外直接解压核查了以下本地原件（gzip 文件用 JSON 指针定位，不虚构行号）：

- `raw/en_us.json.gz` 的 `/setData/1/champions/61/ability`：与 normalized 相同，仅五个变量，非生成过程漏采位移字段。
- `raw/en_us.tft.stringtable.json.gz` 和 `raw/zh_cn.tft.stringtable.json.gz` 的 `/entries/spell_tft13_ambessaspell_tooltip`：分别确认“dash to target / dash away”和“冲刺至目标处 / 冲刺撤离”，均未给距离。
- `raw/map22.bin.json.gz` 中 Ambessa 的可识别引用：`/{42abd90a}` 是商店展示记录，`/Characters/TFT13_Ambessa` 是角色文件引用；其余查到羁绊、阵容、奇遇、音效等引用，没有可绑定至该技能的冲刺数值。无法识别的字段不视为已知规则值。
- 同一 raw 目录未归档 `tft13_ambessa` 角色技能 bin。未从 3D 动画、粒子尺寸、其他英雄技能或其他版本推算数值。

阻塞点：至少缺少拳击撤离距离或确定终点的原始规则，不能选“后退一格/两格/退到锁链射程”作为默认。锁链的“+1 Range”是普攻射程奖励，不是冲刺距离。文本可证明行为方向，不能证明完整格子落点和冲刺时序。

## 当前实现及给 Claude 的接入点

- `src/simulation/combat-g2-2.ts:66`：奇数次施法为锁链伤害，偶数次为拳击伤害与短晕；没有修改 `cell`。本单未改变姿态、伤害、晕眩、RNG 或其他规则。
- 现有通用事件在 `src/simulation/combat-types.ts:128`：`{type:'movement', tick, unitId, from:{col,row}, to:{col,row}}`；进入领域账本时带 `domain:'combat'`、`combatId`、`eventSeq`。**这是既有移动事件格式，不是本次新增的冲刺接口。**
- `src/simulation/combat-ledger.ts:4` 的 `toLedgerEvents` 接受已盖章领域事件；`src/simulation/m8/contracts.ts:499` 已包含 movement。
- `src/simulation/combat-replay-view.ts:63` 当前公开投影仅输出 `type,tick,eventSeq,unitId,from,to`；新增 source/cause/actionSeq 时必须明确扩充此白名单，否则新增字段不会传出。
- `src/server/room/projection.ts:349` 的 `mirrorReplayTick` 与第 366 行的 movement 分支镜像 from/to；`src/server/room/combat-stream.ts:116` 使用该路径提供另一侧流式视角。若另建 `unitDashed`，需显式补投影及镜像处理，不能仅向账本添加一种类型。
- 表现层后续消费已投影的权威坐标与事件序号；本单无已交付的冲刺 source/cause/actionSeq 字段，Claude 暂无新接口可接。

## 手算向量与验证边界

未编写冲刺落点断言或手算期望值，因为缺失终点规则会使这些期望值变成自定数值。补证后必须覆盖：两姿态正常落点、路径阻挡与终点占格、目标死亡、目标移动、边界格、无合法空格，以及同步/切片/JSON 恢复/回放/双方镜像流式事件一致性和 RNG 不变。本次通过的原有技能测试不能证明这些行为成立。

基线验证（未跑全套）：

- `npm test -- --configLoader runner --no-cache tests/g2-2-skills.test.ts tests/g2-2-ability-display.test.ts tests/g2-2-identity.test.ts`：3 文件、96 测试通过，0 失败。
- 默认配置加载首次启动因软链指向只读目录，写入 `node_modules/.vite-temp` 报 EROFS；上述重跑只调整调用参数，未改 Vitest 配置、测试断言、夹具或 CI 门槛。
- `npm run typecheck`：通过（退出码 0）。
- 因本单规则变化失败的旧 epoch/digest/golden 测试清单：无（本单没有规则变化；未运行完整历史夹具套件，不能宣称全套通过）。

未录 epoch，未改 digest/golden，未改 simulation/server/rendering 或生产代码，生产 JS 增量为零，未 git commit。

## 后续所需证据

补入可追溯至锁定版本的 Ambessa 技能脚本/数值来源，明确两姿态终点规则，尤其拳击撤离距离，以及必要的格子单位换算和执行时序。若用户希望改用项目自定规则，须另行明确授权并标明其不是 14.24b 源数值；本任务当前约束不允许自行采用此方案。
