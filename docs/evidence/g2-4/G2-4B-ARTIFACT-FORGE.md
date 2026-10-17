# G2-4B 神器锻造器领域交付

日期：2026-10-17。分支：`codex/g2-4b-artifact-forge`。固定基线：#147 head `d3112d681ecff96140c451a842c36f29537e1c07`；未合并 #149，也未额外同步其他分支。原考证文档及两池完整ID见 [G2-4B-FORGES-PLAN.md](G2-4B-FORGES-PLAN.md)。原计划分支 `codex/g2-4b-forges-plan` 的提交为 `6ecdc02b11257a7fb5cb1af4cfb212dbca63cde2`。

## 交付范围与来源

用户确认神器采用29件源池与#147已实现注册表的21件交集。用户进一步确认只恢复征服者10/14，11/13等待#149。来源为固定14.24b raw、其规范化物品/奖励表；B补丁每开箱500Bps成长不变。未改物品战斗程序或源数值。

| 档 | 阈值 | 本批奖励 | 与基线差异 |
| --- | --- | --- | --- |
| 10 | 650 | 神器锻造器（4选1） | 移除14过渡金 |
| 11 | 750 | 15金 | 等#149，未恢复辅助锻造器 |
| 13 | 1000 | 拆卸器+50金 | 等#149，未恢复三件指定辅助装 |
| 14 | 1200 | 随机光明装备+50金+神器锻造器+拆卸器 | 移除额外10过渡金，补神器锻造器 |

第14档光明奖励仍为35件池中抽一件，排除光明窃贼手套；不生成光明四选一。第12/15档冠冕仍延后。15档总金币由361降至337；恢复原物品时不叠加旧过渡金。

源29件完整保留。8件暂不入选：TFT4_Item_OrnnDeathsDefiance、TFT4_Item_OrnnTheCollector、TFT9_Item_OrnnTrickstersGlass、TFT7_Item_ShimmerscaleGamblersBlade、TFT7_Item_ShimmerscaleMogulsMail、TFT_Item_Artifact_Fishbones、TFT_Item_Artifact_SuspiciousTrenchCoat、TFT_Item_Artifact_SpectralCutlass。21件精确清单由 `G24_FORGE_POOLS.TFT_ArmoryKeyOrnn` 提供，测试另列独立固定ID清单，计划§3逐一给出中文名。不会通过HorizonFocus名称片段合并两个不同ID。

## 约定值清单

| 编号 | 本批执行值与依据 |
| --- | --- |
| G24-FORGE-01 | 神器4选1；用户指定，神器另有Riot14.9外证。辅助锻造器4选1仅保留计划 |
| G24-FORGE-02 | ID排序后等权无放回抽4件；沿用G2-4a，不宣称已找到官方权重/算法 |
| G24-FORGE-03 | 神器源29∩已实现=21；用户已确认。辅助装交集仅是后续方案 |
| G24-FORGE-04 | completed-reforger维持普通36件池，拒绝神器/辅助装；现有成员检查已实现，不扩大到原版“同类型”重铸 |
| G24-FORGE-05 | 超时取offers[0]，不额外抽签，复用通用领域timeout |
| G24-FORGE-06 | 不排除已拥有、不跨窗口去重、不维护跨席有限装备池 |
| G24-FORGE-07 | 明确准入Completed与Ornn；Support暂拒绝，未知键拒绝，内容池不足4件配置错误 |
| G24-FORGE-08 | 名称继续采用“神器锻造器/辅助装锻造器”；辅助原始身份与文本已有证据，获取边界见计划。界面未改 |

其中01/03的神器数量和交集以及11/13延后由用户明确确认；其余遵循用户授权“查不到按计划约定”及既有行为，不写成独立官方结论。

## 实现、收据与恢复

- 新增 `content/g2-4-forges.ts`：冻结普通/神器池、来源全集、8件排除、选择数、抽样/跨窗口/超时声明。`resolveG24ForgePool(api)` 明确拒绝未准入选择器，消除旧分支把未知选择器落入辅助池的问题。
- `g2-3-policy.ts:g23ConquerorReward` 只解除Ornn延后；`g2-3-rewards.ts:g23RewardAtoms` 读取准入池，沿用 `${seed}:${atom.id}` 的独立LCG派生流。shop/reward/battle/G23活跃随机流不因打开或选择forge变化。
- 第10档choiceId=`g23:conqueror:10:atom:0:copy:0`；第14档choiceId=`g23:conqueror:14:atom:1:copy:0`。第14档atom0为自动光明装备、atom2为自动拆卸器。choiceId同时是唯一收据ID；不新增第二份已选账本或虚构工具库存。
- `openG23Choice`、`selectChoice`、`forfeitPendingChoice` 复用通用forge。成功领取一件永久库存物品，写 `MechanicReceipt.kind=choice / choiceKind=forge / source=conqueror / price=0 / skipped=false` 和绑定receiptId的资源出生事实；自动发物、工具、金币仍使用各自通用收据。
- `g2-3-runtime.ts:claimG23Atom` 拒绝多选item原子的直接领取（stale-choice），避免绕过选择收据。失败保持原state且无事件/资源/RNG变化；满席英雄和自动奖励路径不变。
- `g2-3-state.ts:validateG23MechanicLinks` 核对bundle来源；多选只能有forge选择收据，不能伪装自动发物、黑市、付费或跳过；必须绑定非空itemId；timedOut只能选首项。进度重演仍验证候选成员、副本序号、发奖轮次和已领取数量，拒绝旧14/60过渡金收据。
- 新增 `g2-3-restore.ts:validateG23Restoration`，从 `b8-restore.ts` 提取既有G23恢复链。`validateB8Resources`继续调用它，完整重建pending choice并对比顺序、来源、超时项和ID，进度按种子/历史重演，恢复不发奖。保留已解析JSON的等价比较路径。
- `completed-reforger`的现有preview/use/恢复均有普通池成员边界，本批只补回归，不改重铸规则代码。

辅助接口预留：未来#149合并后，在同一选择器映射增加Support执行池、解除对应延后并恢复11/13；重新升policy/rules/content，重录夹具。当前不加入空实现、不开放Support selector，也不要求本批等待#149。合并本批前应先合入#147及其最终修订；若#147/#149在集成中共用v5，必须重新统一递增版本/digest，不直接合并冲突的夹具。

服务器/界面交接见MATCH_CONTRACT、MULTIPLAYER_CONTRACT、UI_REQUESTS。本批未改 `src/server/`、`src/rendering/`、`src/presentation/`，也未改CI门槛。

## 版本与夹具

| 项 | 值 |
| --- | --- |
| policy revision | g2-4b-artifact-forge-v5 |
| forge policy revision | g24-forge-v1 |
| rules / content | s13-g2-3-v5 / s13-14.24b-g2-3-v5 |
| content digest | fnv1a32-utf16:c33d9695 |
| loot replay digest | fnv1a32-utf16:276e5203 |
| schema / save / replay / command | 7 / 3 / 3 / 3（不变） |

`m8/version.ts`及`m8/contracts.ts`统一版本字面量；旧v4存档/回放因版本/digest不兼容而拒绝，无迁移。manifest加入全部池、排除项和行为约定，改池即改变digest。

重录采用原脚本，不手改hash或降低断言：

```sh
node scripts/record-g2-3-release.cjs
node tests/fixtures/record-g2-3-herald.cjs --write
node scripts/record-g2-3-inputs.cjs
node scripts/record-g2-3-live-reveal.cjs
```

输出包括四条完整公共命令路线golden、cannon/sniper压缩状态、内容baseline、五组Herald原始存档及manifest、C19/B8输入指纹和审计JSON。历史源归档/旧版本夹具保持不变。

## 验证边界与构建体积

提交前相关测试9文件/140项通过，包含新神器文件7项及成装锻造器、G23奖励/集成/通用选择、版本合同。`npm run build`通过（含typecheck）。新测试覆盖固定21ID和29源池、Python独立整数oracle固定候选、四项去重/跨窗口可重复、拥有物品不排除、10/14与11/13奖励边界、多档结算、领取/超时防重、pending/收据篡改、旧金币收据拒绝、普通重铸可恢复与神器输入/伪造重铸事实拒绝。

高档征服者测试使用真实开局/命令历史和通用grant来源，在领域信任边界输入六征服者/30个不同击杀的服务器结算向量；JSON往返后调用与存档相同的G23恢复函数，验证待选、手选、超时三态。该向量不声称来自自然战斗，也不等于整房恢复。单人通用神器forge窗口/选中物品另通过完整serializeMatch/restoreMatch；单人restoreMatch原本拒绝multiplayer，本批保留。完整公共路线、Herald与原有恢复测试继续提供外围回归。

JS gzip按scripts/m7-budget.cjs同一算法：`dist/assets/*.js`逐文件gzip level9后求和。签署M7基线15313a75c6e74beec739fe52a2875c104c55eae3与当前用同一Node24.21.0、同一工具链构建：

- M7：424,763字节；本批：560,225字节。
- 倍数：**1.3189119579624402×**，通过既有**1.50×**门槛。未测首次交互时间，未改预算。

最终提交head验收命令：`npm test -- --maxWorkers=2 --reporter=verbose`及`npm run test:timing`。首个head 68ca3a6的全套运行发现旧神器测试将policy revision固定为v4，随后主动结束该轮；该轮不计通过，也不是OOM。第二个head 609b784开始测试后，收据复核补上forge必须绑定非空itemId的约束及负向测试，因此主动结束该轮，并以原脚本重新生成源码审计夹具。两轮中止均不计最终成绩。新head重新完整运行全部测试，fast用两个worker、timing仍串行（可用内存恢复至约4.3GiB）；所有fast/timing测试仍被选择，不改配置、门槛或skip。最终结果、exit code与`/usr/bin/time -v`峰值另随该head交付日志，本文不预先宣称最终全套已通过。若进程被OOM杀死，记录峰值并停止强行重跑。
