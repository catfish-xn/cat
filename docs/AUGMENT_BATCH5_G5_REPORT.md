【完成】B5-82、B5-85 已按 2026-10-27 批准的约定完成联机实现；保留原阶段限制，没有开放其它强化。分支 `codex/v25-g5`，起点 `4495602daa21ab5b218e05a76721b7a070117ccc`；未提交 Git、未重录 epoch。

| B5-82 意料之中的意外 | 实装结果 |
| --- | --- |
| 骰子与时点 | 3d6；三骰相同优先进入头奖，其余分 4–8／9–11／12–15／16–17。2-1 取得当时、3-1、4-1 各一次，分别用阶段 2／3／4 表。216 个组合精确计数为 54／78／69／9／6。 |
| 阶段 2 数值（上述四档／头奖） | 7 次免费刷新；2 个随机 4 费；2 金＋成装锻造器＋3 重铸器；2 金＋杰作升级；5 金＋金铲铲冠冕。 |
| 阶段 3 数值 | 15 金；10 金＋4 个次级英雄复制器；2 金＋神器锻造器；2 金＋3 随机散件；5 金＋2 随机纹章。 |
| 阶段 4 数值 | 20 金；3 个随机 5 费；2 金＋辅助装锻造器；2 金＋1 随机成装＋2 随机散件；5 金＋2 随机 5 费＋英雄复制器。 |
| 约定与证据 | **P-B5-82，2026-10-27**。三次触发文本、NumStages=2 与匿名 7／15／20 是已证实字段；同期 18 点个案是社区推测；Gemini 混合 S13／S14 的完整映射、3d6、分档与精确时点按约定处理，取正文首列方案。经济档保留 7 刷／15 金／20 金。独立高位分桶拒绝抽样，礼物内部抽样沿用 P-AG1／P-AG2；只在 2-1 报价。 |
| 测试 | **24 项通过**：`augment-pool-batch5-g5-dice.test.ts` 4 项、`server/batch5-g5-dice-room.test.ts` 20 项。覆盖三个报价节点、全部 216 组合与 15 档、独立 oracle、真实选取与免费刷新、3-1／4-1、满备战席锻造器暂存、对象／JSON 往返、缺 authority／删历史／改金币／删改收据／改免费计数／删持有者拒绝。 |
| 调用点与文件 | 新内容 `content/augment-pool-batch5-g5.ts`、新规则 `augment-pool-batch5-g5.ts`；最小接入 `augment-pool-grants`、`free-rerolls`、`match` 入轮、`shared-pool` 恢复与 `augment-history-owners` 的 acquire 登记。共同注册表为 augments／augment-policy／augment-offer-rules／augment-stage-bans／rules-manifest／validate-content；独立 M5 oracle 和总数断言同步。**src/server 改动 0**：沿用 Room.handle → runSharedMatchCommand、nextSharedRound 与 Room.augmentHistoryAuthority。 |

| B5-85 棱彩管道 | 实装结果 |
| --- | --- |
| 额外球与阶段 | 2-1 选取在 2-7 增加一球，3-2 选取在 3-7 增加一球；保留 4-2 禁用。挂在首个中立怪的自然法球槽之后，击杀载体后可领取；仅一球，不改全桌自然布局和既有 RNG。 |
| 早期加奖 | **2-1 取得固定 Early**：每个之后自己完全打开的棱彩球＋8 金；不会随当前阶段升级到 Late。 |
| 后期加奖 | **3-2 取得固定 Late**：34%＋16 金；33%＋2 随机非铲锅散件；33%＋2 随机 5 费英雄与6 金。英雄沿用共享有限卡池奖励球。 |
| 主表 | 已有 `ORB_BOXES.ultraPlus` 标准表，因此按批准条件复用 `sampleOrbBox`，不替换成另一张 Gemini 表。既有 9 行权重依次 10／15／10／15／10／10／10／10／10，总计 100。保留其既有六费与杰作升级裁剪，详见风险。 |
| 约定与证据 | **P-B5-85，2026-10-27**。金球加奖移除、Early 8 金及 Late 三项显式权重／内容是已证实的补丁或静态配置；选择节点分界的社区比较按社区推测层级保留；绑定、主表复用、所有来源及发奖生命周期按约定。通过历史 API 记录 `orb-opened`，无来源过滤；取得前已开不补发，取得后完全开启才加奖。 |
| 测试 | **40 项通过**：`augment-pool-batch5-g5-pipeline.test.ts` 4 项、`augment-pool-batch5-g5-pipeline-claims.test.ts` 2 项、`server/batch5-g5-pipeline-room.test.ts` 15 项、`server/batch5-g5-pipeline-late-room.test.ts` 19 项。覆盖报价节点、100 个权重槽、独立底表／加奖抽样、真实早晚期 Room 选取与 PvE、自然球和额外球、普通球不加奖、战斗排队、满备战席部分领取与重试、独立 authority 往返、恢复后重复领取拒绝及历史／金币／奖励／来源／进度篡改。 |
| 调用点与文件 | 新规则 `augment-pool-batch5-g5-pipeline.ts`；最小接入 `orb-claim` 的统一领取包装、`loot-runtime` 的额外掉落资格、`consumables` 的额外球来源校验、`augment-pool-grants`／`match` 入轮／`shared-pool` 恢复。`augment-history-types` 增加 orb-opened，owners 登记持有者，沿用现有 append/read API；共同注册表及 M5 oracle 同上。**src/server 改动 0**：继续通过原 claimOrb、结算 FIFO 和独立 authority 编排，未新增时钟或界面依赖。 |

共同验证：**12 个文件、170 项全部通过**（64 项新增功能验证＋106 项相关回归及压缩语义验证），Vitest 使用 `--maxWorkers=3`，未跑全量、未扩大种子扫描到 0..100 之外、未删除既有断言或提高超时。机器报告：`artifacts/augment-batch5-g5-vitest.json`。因共享 node_modules 只读，使用 `--configLoader runner --cache=false`，不改变沙盒权限。

类型检查与 Vite 客户端构建通过；`npm run build:game` 实际联机服务构建通过。Node 规则入口在禁止浏览器全局、Math.random 和 Date.now 的检查下可导入，且真实 createMatch → serializeMatch → restoreMatch 往返一致。`npm run build:server` 标准脚本的边界检查存在下述基线阻塞。规则／内容保持 v25，外层 schema/save/replay/command 保持 12/8/8/7。内容身份已执行 `node scripts/update-content-identities.cjs --write` 并同步 `scripts/tests/production-size.test.ts`：content=`fnv1a32-utf16:8134008a`，loot=`fnv1a32-utf16:518d1dd4`。`S13_RULES_GAP` 已记录两项 P，`AUGMENT_BATCH5_GAPS` 两卡分类与后续已更新；Match 契约和历史 API 文档同步。

【未完成】两张强化无未完成项。未扩展单人棱彩管道额外球生命周期，符合本任务只面向联机的范围；单人既有入口保持可执行。没有运行全量验收，也没有重录任何历史 epoch。

【需要我决定】无。现有标准棱彩主表触发了用户批准的“已有主表则复用”条件，未擅自覆盖共享奖励表。

【风险】`npm run build:server` 的“纯规则入口”检查失败：依赖图已有 `src/presentation/combat-status.ts`。用只读 `git show HEAD:<path>` 的原文件覆盖本次修改进行 esbuild 对照，HEAD `4495602` 与当前图均含同一文件；属于基线问题，本任务未修改表现层或放宽该检查。另：B5-82 全表属于明确约定；标准 `ultraPlus` 的成装／24 金行原本不带杰作升级，六费行原本裁剪了六费英雄，均按复用条件保留。内容身份改变会拒绝旧身份存档，未做迁移。

【下一步】由集成方交叉验收两张卡与既有主表保留项，再按集成流程处理；纯规则服务器入口的既有表现层依赖单独修复。
