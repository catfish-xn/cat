# G2-3 发布说明（#134 接入）

## v15 联机法球领取与满席折金（2026-10-20）

揭示后的线上法球跨轮保留，点击整颗领取；英雄完整星级入库/合成，满席按原售价出售，卡池仅在领取且入库时扣份。强化/征服者/黑市英雄同样走法球，deadline 不丢弃。单机规则保持。领域交付仍需 Claude 对齐 claimOrb 消息、协议 4、bot 准备入口与投影；当前不是端到端上线声明。签名、枚举、暂定值、验证与指纹见 [实现交接](../../LOOT_ORB_CLAIM_V15.md)。

## v14 强化等级与免费刷新（2026-10-19）

按用户 2026-10-19 08:15 约定，每个强化节点全员同级、三个候选同级，默认每次提供可免费整组刷新一次且锁级；三等级等权为缺少原版概率资料时的项目默认、待确认。独立派生等级不推进各席 RNG，原有提供/成功刷新各用三个 choice 词。详见 [Match 合同](../../MATCH_CONTRACT.md) 与 [实现交接](../../AUGMENT_TIER_V14_IMPLEMENTATION.md)。

运行时规则/内容身份已升至 `s13-g2-3-v14` / `s13-14.24b-g2-3-v14`，旧存档不迁移。发布级录制（release states、M5 golden、Herald raw、输入审计、P1 dual commands）已在沙箱外按发布审计基线 73ff522 重录，各 --check 与 verify 通过。#208 合入 multiplayer `4300175` 后，G2-4b release states、Herald raw、输入审计、live-reveal 审计和 P1 dual commands 改按该基线重录，各 --check 通过。

rules `s13-g2-3-v3`、content `s13-14.24b-g2-3-v3`统一发布；旧存档及旧回放输入失效，不能继续旧局。schema7/save3/replay3保持，不提供内容迁移。

本批增加12位英雄、4套按开战站位冻结的远程形态、其余羁绊规则和30个异变。征服者启用15箱，16–20无源阈值不启用；仅含延后物品的档位按Gold=max(原金币,map22整档估值)折金，并保留已实现奖励。已有拆卸器、重铸器保留。第14档60金+光明装备+拆卸器，第15档200金+本局永久光明转化。Rumble三星自爆采用官方20000%。

学院29组项目赞助池、未恢复的脚本/碰撞/召唤物属性均明确标约定值或有限近似，详见[实现对账](RECONCILIATION.md)。窃贼手套、成装锻造器、复制器、战术家之冠已在 G2-4a 发放；神器、辅助装、神器锻造器、辅助装锻造器，以及征服者奖励中的三件辅助装（`TFT_Item_ZekesHerald`、`TFT_Item_Chalice`、`TFT_Item_LocketOfTheIronSolari`）延后到 G2-4b。

已接入#134（19aa9f1）的机制容器、弹出选择、免费超时项、召唤事件和radiant kind。目录选择g2-3-item-registry超集，统一用于发奖/选择/恢复/摘要。CONTENT digest为fnv1a32-utf16:427b83b0；本次收尾因规则修正升至v2。G2-4a（征服者第4/8/9档恢复原奖励、锻造器4选1）再升至v3；冠冕（第12/15档恢复、冠冕人口）与#147神器合并后统一升至v5（rules=`s13-g2-3-v5`、content=`s13-14.24b-g2-3-v5`、policy revision `g2-4a-v5`），digest见g2-3-content-baseline.json。 辅助装（#149）与不稳定的宝箱临时成装通路（#153）随 v6 合入，#153 不另升版本，digest 见 g2-3-content-baseline.json。

服务器buildReceipt仍需Claude转发proposal.g23Facts；本PR不改server/rendering/server-entry，因此不是联机机制上线声明。夹具字节证据见release-audit.json、input-fixture-audit.json、live-reveal-audit.json，开发验证见development-validation.json；最终head全套与timing结果在PR记录。

## #136 后收尾

机器人统一读取普通、光明和炼金物品超集，未知物品安全跳过；恢复补回选秀出生登记、机制收据结构校验和removedUnitIds校验。Power Absorption按官方14.24修复说明在百分比AD后加固定AD；Titan后不再重复出售付费升级。征服者5%成长保持线性，Rumble一/二星自爆明确为项目约定值。

经济恢复使用有界、完整内容键的重放缓存及前缀复用；奖励原子缓存不保留外部可变对象；单次恢复内共享机制声明计算，跨次恢复仍重新校验。回放快照保留经过证明的不可变子图，激活存档复用该快照边界，外部可变数据仍脱离。整档导出按原属性顺序拼接，复用私有冻结战斗档案的UTF-8 Blob；逐字节回归保证与JSON.stringify一致，外部档案不缓存。自动钩子返回失败时发mechanicFailed事件，失败原子不写收据或消耗资源。

U6首跑失败（[run38938055193](https://github.com/catfish-xn/cat/actions/runs/38938055193)，job117098416536）出在先读领域状态、再异步读DOM：两次读取之间战斗可结算，revealed断言失效。验证改为同一浏览器任务读取两者，仍强制观测到有效的战中揭示；未发现随机流不确定性。

v1的存档和回放输入按身份拒绝；v2夹具通过原公共指令生成器重录，历史夹具保留。性能门槛、单测超时和CI实际作业时限均未放宽；预算文档同步已有45分钟input作业时限。收尾逐项测试映射和开发测量见[FOLLOWUP_VALIDATION.md](FOLLOWUP_VALIDATION.md)，最终head的测试和性能结果见PR。

## PR #149 辅助装合入当前 multiplayer

以 `65db5d2` 的13件辅助装效果和数值为准，merge `311017e`（含 #147 神器、#148 战术家之冠及 #158/#159/#160/#165）；复用主线的 `supportStage` 与 `holder-death`，不重复定义或触发。规则版本 `s13-g2-3-v6`，内容版本 `s13-14.24b-g2-3-v6`，policy revision `g2-4b-support-v6`；schema/save/replay 格式不变，content digest 为 `fnv1a32-utf16:e73164da`（见 `tests/g2-3-content-baseline.json`）。夹具按 release → herald → inputs → live-reveal 顺序重录。

验证：`npm run typecheck` 通过；仅运行 `tests/g2-4b-support-items.test.ts`、`tests/m8-contracts.test.ts`、`tests/match-contract.test.ts`、`tests/g2-4a-crown.test.ts`、`tests/explorer-bracer-restore.test.ts`，5文件63测试全部通过。请求中的 `tests/g2-4a-crown-gold.test.ts` 在本分支及 `311017e` 均不存在，使用实际冠冕测试 `tests/g2-4a-crown.test.ts`。未运行全套，未修改测试时限。四步夹具录制完成，最终 `node scripts/record-g2-3-inputs.cjs --check` 9案例通过。

## G2-4a 冠冕胜利掉金

在冠冕人口版本上保留历史合入 `148d6a2d87a438f580a41bf55f1651c2d5a9d8a3`（冻结输入rewardClaims前缀校验），规则/content升为v7，policy=`g2-4a-crown-gold-v7`，合入 multiplayer v6 后统一升到 v7。当前digest见 `tests/g2-3-content-baseline.json`。

已实现源 `PercentGoldChance=10`：开战场上装备的每顶冠冕在PvE/PvP胜利时独立10%直接到账1金币；背包/备战不算，持有者阵亡仍算，输/平不算。采用用户确认的 G24-CROWN-GOLD-01..05（见RECONCILIATION），G23 lcg32随机流排在黑市之后。冠冕掷骰推进共享RNG，会改变后续黑市结果，本战已经完成的黑市掷骰不变。经济收据保存冠冕数量/命中金币，并与唯一资源收据 `g23:crown:<battleId>` 交叉验证，恢复与重复结算不能重发。不新增界面/服务器逻辑；沿用mechanicGranted事件。

M1：冠冕历史恢复改为复用现有完整回放，逐轮核对开战资格、来源、胜负、经济和资源收据前缀。只携带冠冕 Match、缺少历史证据的恢复会明确拒绝；调用方须给 `restoreMatch`／`serializeMatch` 传入 `battles`，或使用完整 SaveEnvelope 验证入口。字段、digest 和五条玩法约定不变，详见 [恢复 API 合同](../../MATCH_CONTRACT.md#g2-4a-冠冕历史恢复-apim1方案-a)。

专项测试验证源概率、独立叠加、PvE/PvP、场上/备战/背包、死亡持有者、黑市随机次序、真实战斗恢复及Continue防重复；release/inputs/live-reveal/herald均从脚本重录，旧新SHA/bytes及冻结source hashes见 `crown-gold-recording-audit.json`。最终head全套由发布协调者单独执行一次。

合入 multiplayer `8c7f6ac`（含 #149 辅助装、#153 不稳定宝箱、#167 上界预检、#166 前序修复）后升为规则/content `s13-g2-3-v7` / `s13-14.24b-g2-3-v7`，policy=`g2-4a-crown-gold-v7`；schema7/save3/replay3 与资源来源版本号不变，存档格式变化（有序穿戴记录 `equipmentHistory`）由规则版本校验隔离：v6 及更早存档按 `unsupported-version` 拒绝，不做迁移（用户 12:06 旧存档政策）。release/herald/inputs/live-reveal 按顺序从脚本重录。

## G2-4B 神器锻造器增量

基于神器#147 d3112d6：21件已实现神器开放四选一，第10档移除14过渡金，第14档恢复50金+随机光明装+神器锻造器+拆卸器。用户确认11/13等#149，仍15金/拆卸器+50金。policy升g2-4b-artifact-forge-v5，rules/content升v5；合入 multiplayer `0cdd6eb`（v7，含 #149、#153、#157）后统一升为 rules/content `s13-g2-3-v8` / `s13-14.24b-g2-3-v8`、policy `g2-4b-artifact-forge-v8`，v7 及更早存档/输入按版本和 digest 拒绝，digest由manifest重算。收据与超时走通用forge；恢复加强来源、选择类型、免费和超时默认校验，直接领取不能绕过多选。原脚本重录夹具，具体验证与JS gzip见[交付记录](../g2-4/G2-4B-ARTIFACT-FORGE.md)。

## PR #170：次级微光复制器 v9

从 `f0f1d99` merge multiplayer `d6156ab`，再 merge 最新 `0719ced`（#162，仅界面及其测试增量），保留 #161 的出生顺序/神器奖励校验与复制器出生时目标、冻结前缀校验。黑市次级微光复制器仅复制≤3费炼金男爵；征服者次级英雄复制器仍复制≤3费英雄，沿用已批准规则，不改数值。规则版本 `s13-g2-3-v9`，内容版本 `s13-14.24b-g2-3-v9`，policy revision `g2-3-lesser-shimmer-duplicator-v9`；schema7/save3/replay3 不变。按 release → herald → inputs → live-reveal 重录，当前 digest 见 `tests/g2-3-content-baseline.json`；旧 g2-augments Herald 原始夹具保持与 multiplayer 逐字节一致。

## PR #164 v10：护臂多杀计层规则身份与夹具迁移

- 起点 `f2b7c39`，已合 multiplayer `563a7f9`；本轮将已批准的逐目标参与击杀计层登记为 rules `s13-g2-3-v10`、content `s13-14.24b-g2-3-v10`、policy `g2-4b-bracer-multikill-v10`。
- 护臂同一动作击杀两个不同目标各算一层，同目标不重复；不改变其数值、其他物品触发或恢复校验。
- schema/save/replay/command 保持 7/3/3/3，NET_PROTOCOL 保持3。旧规则存档遵循已有不迁移政策。
- 从公开命令重新生成当前规则四路线 golden、cannon/sniper 录制态、Herald、输入指纹和掉落揭示证据；历史原始目录不改。命令、前后字节证据、实测结果见 `bracer-multikill-v10/REPORT.md`。

## v11：辅助装锻造器与锻造池补齐（G2-4b）

- 起点 multiplayer `0257178`（#180：#150 新机制 11 件 + #152 虚空生物联机）。rules `s13-g2-3-v11`、content `s13-14.24b-g2-3-v11`、policy `g2-4b-support-forge-v11`；content digest `fnv1a32-utf16:601f574f`。
- 征服者第 11 档按原始数据发辅助装锻造器（`TFT_ArmoryKeySupport`），第 13 档发基克的先驱、钢铁烈阳之匣、能量圣杯、拆卸器和 20 金；不再有延后折金的征服者奖励。锻造器沿用 G24-FORGE-01…08（四选一、等权无放回、超时取第一项、可重复出现、不足 4 件拒绝）。
- 合入 #150 后 29 件神器、17 件辅助装都有实现，神器锻造池和辅助装锻造池补齐为 29/17，排除表为空。抽取期望由独立 Python uint32 计算得出，同一脚本复现旧 21/13 池的原期望。
- schema/save/replay/command 保持 7/3/3/3。v10 存档按既有不迁移政策拒绝。G2-4b 录制态、golden、Herald、输入指纹和掉落揭示证据按 `docs/evidence/g2-4b/MIGRATION.md` 顺序重录（baseline `0369a0b`），四项 `--check` 通过；G2-3 历史目录不改。

## v12：慢炖与终身黄铜修复（PR #187）

- 起点 multiplayer `075e9a4`（v11）。rules `s13-g2-3-v12`、content `s13-14.24b-g2-3-v12`、policy `g2-4b-augment-anomaly-fixes-v12`；content digest `fnv1a32-utf16:9535ffff`。
- 慢炖每秒伤害改为携带者最大生命 ×3%（原为目标最大生命）；数值不变。
- 终身黄铜 I/II 补齐 9 个 S13 铜级羁绊（伏击者、先知、炼金男爵、统治者、搏击手、实验体、斗士、黑玫瑰、迅击战士），首档阈值取自原始数据 style 1，只在当前激活档等于铜档时计数；该强化不改羁绊计数，战斗和结算的征服者/炼金男爵档位一致。
- 超高速规则不变，测试改为真实施法两次并核对攻击间隔。
- schema/save/replay/command 保持 7/3/3/3，v11 存档按既有不迁移政策拒绝。G2-4b 证据按 MIGRATION.md 顺序重录（baseline `075e9a4`），四项 `--check` 通过；G2-3 与 g2-augments 历史目录不改。

## v13：S13 强化与异常批次（P1–P4，集成分支 `integration/s13-augments`）

- 起点 multiplayer `73ff522`（v12）。rules `s13-g2-3-v13`、content `s13-14.24b-g2-3-v13`、policy `g2-4b-s13-augments-anomalies-v13`；content digest `fnv1a32-utf16:a1fc26ff`。
- 合入 P4 #192、P2 #188、P3 #189、P1 #191，以及机制包 D3 #198（资源所有权）、D4 #197（羁绊投影）：强化 57 个、异常 52 个（各包内容与数值依据见各自 PR 和 `docs/evidence/s13-augments/`）。规则数值不因合包改变；池变大使固定种子的报价、商店和战斗走向变化，相关测试的处理见 `docs/evidence/s13-augments/SEED_ROUTE_DEFERRED.md`。
- 合包时修正穿刺莲花读档校验：后一次暴击刷新同一状态时到期顺延，读档接受该顺延。
- schema/save/replay/command 保持 7/3/3/3，v12 存档按既有不迁移政策拒绝。G2-4b 证据按 MIGRATION.md 顺序重录（baseline `73ff522`），S13 P1 双选录制重录；G2-3 与 g2-augments 历史目录不改。
