# PR #161 必改项修复验收

基线：`b2de81a4d57f2f6b44ed31627505b848c72cad42`；仅修恢复与奖励身份稳定性，不改规则、数值、奖励、版本或内容文件。

- P1-a：B8 战后后缀按已校验的选择收据重演 mechanic 物品出生，核对实例序号、资源账本序列、收据顺序和覆盖范围。多次锻造后可恢复；调换收据、实例、序号或来源被拒绝。
- P1-b：征服者按源数据经过现有转换策略的字段顺序生成 atom（第 4 档仍先英雄后复制器）；黑市按匹配的源奖励字段顺序生成。传入对象键序和缓存命中不影响 atom、抽取种子、候选或 choiceId。
- P2：按 source 和实际待领奖励重建权威窗口，比较完整窗口，包括 ID、候选顺序、超时项。普通日程窗口仍由原有日程校验负责。

## 复审补充：待选军械库的真实来源

结论属于“没有其他合法来源”：生产代码中 `openMechanicChoice` 的调用者只有 `g2-3-runtime.ts:openG23Choice`，分别从炼金黑市 offer、兰博 `g23JunkerMenu` 和征服者/黑市 reward atom 推导窗口。`match.ts:enterScheduledEvents` 的强化、异常和组件窗口走独立日程构造，不设置这些 mechanic `payload.source`。通用开窗函数能接受任意非空 source，不代表正常游戏存在对应的非 G23 产出路径。

`g2-3-netcode-hooks.test.ts` 原来直接构造的 `armory-1 / junker-king` 没有兰博参战与军械库资格，恢复拒绝是正确的。本次保留恢复校验，从既有公共命令夹具提取 `publicPendingArmory`：商店购买兰博、部署、真实参战三轮，再由 Match 自动打开 `g23:junker:1`；没有直接开窗、伪造进度或奖励。原测试名称和待选窗口相等断言保留，另核对三轮资格、真实持有兰博、窗口内容、三入口完整状态，以及把真实窗口改名为 `armory-1` 后仍被拒绝。

本轮在 M1 提交 `7a6a07f` 上追加验证：仅运行 `g2-4b-pr161-restore`、`g2-4b-artifact-forge`、`g2-4a-conqueror-items`、`m5-serialization`、`m8-b8-restore`、`g2-4b-reward-order`、`g2-3-netcode-hooks` 七个测试文件，74 项全部通过；typecheck 通过。以下保留此前提交的验收记录。

## 回归证据

`tests/g2-4b-pr161-restore.test.ts`：seed 42，通过 grant 接口搭六名三星征服者，真实战斗在回合 26（5-2）、654 层打开 `g23:conqueror:10:atom:0:copy:0`；选探索者护臂后 serialize、object restore、JSON restore 均成功。另验多次锻造、出生篡改、收据倒序及保留 conqueror source 的改前缀/普通成装候选攻击。

冷启动用真实 `serializeMatch` 输出的完整存档，写入磁盘，再由独立 Node 进程分别恢复文本和解析对象，比较完整 G23 进度/claims 与待选窗口，覆盖第 4、10、14 档。第 4、10 档来自自然单人战斗；第 14 档明确使用历史权威收据边界的九征服者/30 击杀向量，经原经济 planner 生成奖励与金币，外围保留真实单人历史与资产，不声称六征服者自然到达 1200 层。

`tests/g2-4b-reward-order.test.ts` 覆盖全部征服者与黑市奖励的倒序/规范化键序，分别验证首次生成及缓存命中。

新增四项回归在独立 `b2de81a` 源码副本中全部失败：capacity sale boundary、冷进程 Invalid G2-3 match progression、改前缀未拒绝、atom 顺序变化；修复后通过。

## 定向验证

仅运行指定七个测试文件和新增测试：9 个文件、90 项全部通过；typecheck 通过，不运行全套。冷启动的文本/对象恢复分别使用独立进程，也覆盖第 10 档领取前后。

```sh
npm test -- tests/g2-4b-artifact-forge.test.ts tests/g2-4a-conqueror-items.test.ts tests/m5-serialization.test.ts tests/m8-b8-restore.test.ts tests/r3r4-consumables.test.ts tests/m8-contracts.test.ts tests/match-contract.test.ts tests/g2-4b-pr161-restore.test.ts tests/g2-4b-reward-order.test.ts
npm run typecheck
node scripts/verify-g24-reward-compatibility.cjs b2de81a
```

对照脚本从 Git 只读导出基线并独立打包，对比完整 atom、每份 choiceId、候选顺序、数量/金币和默认超时项。每个新 seed/tier 的候选首先以倒序键输入生成，再验证正常键序的缓存命中。

| 对照范围 | 一致数 |
| --- | ---: |
| 其他 13 档，seed 0–1023 | 13,312 / 13,312 |
| 第 10、14 档完整 atom（含神器），seed 0–1023 | 2,048 / 2,048 |
| 第 14 档光明 atom | 1,024 / 1,024 |
| 全部 35 个黑市选项，seed 0–31 | 1,120 / 1,120 |

content digest 仍为 `fnv1a32-utf16:c33d9695`；loot 内容/算法及其 digest 输入未改，版本未升。
