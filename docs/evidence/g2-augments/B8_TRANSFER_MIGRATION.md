# B8 live transfer：W4 公共轨迹迁移

## 范围与复跑依据

仅更新 `tests/m8-b8-live-transfer.test.ts` 中目录扩容后过期的精确轨迹断言。不改生产实现、共享 fixture/helper、服务器测试、装备迁移算法或恢复策略。

对基线 `80b893a` 与 W4 `89b219c` 分别加载各自真实 `match.ts`，运行各自 `scripts/generate-m5-route.cjs` 的 `run`。两次均使用现存 `transferPreparation()` 的完全相同参数：

- seed 4、cannon、Ezreal copyLimit 2、同时部署两副本；
- supplyChoices 为 gloves/gloves/vest，保留 gloves/vest；
- Thief's Gloves 装备第一只 Ezreal；
- anomaly 选择 mage-armor，绑定第一只 Ezreal；
- 捕获 4-7 的 start 命令执行前状态。

所有操作均是公共命令，未修改资源、商店、单位序号、receipt 或 Combat。原命令驱动同时调用独立经济 `Ledger` 和商店 LCG oracle，校验付费命令与商店 generation。此次审计临时记录了命令、选择、每轮结果及来源账本，以逐项核对而非直接从失败输出替换常量。

## 首差

首个语义命令差异为零基命令 index 10，即 2-1 的公开强化选择：

- 基线 offers：bulky-buddies-i / placebo / glass-cannon-i；选择 placebo，金币 9 → 17。
- W4 offers：backup / bulky-buddies-ii / lone-hero；选择 bulky-buddies-ii，金币 9 → 9。

其后 3-2 从 manaflow-i 改为 inspiring-epitaph；4-2 从 investment-strategy-i 改为 item-collector-i。扩容后的合法 offer 与选择引起战斗、经济及后续购买轨迹变化，不是奖励迁移或恢复重复发放。

## 逐项独立核对

两只目标 Ezreal 的付费来源不变，测试新增精确来源断言，而非仅检查“均为 shop”：

- DONOR unit-7：2-6，shop generation 8、slotIndex 4，provenance sequence 20。
- SURVIVOR unit-9：3-3，shop generation 14、slotIndex 4，provenance sequence 28。

两次 buy 命令索引分别为 26、45（零基），两边均各扣 3 金。基线对应 58→55、82→79；W4 对应 45→42、66→63。这与 Ezreal 3费及独立经济 Ledger 一致。

TG 仍是 item-9，装备 donor 的 slot 0；mage-armor 仍绑定 donor，choiceId `round:4-6:anomaly`、boundRound 23；开战前仍有 10 次 G12 roll。

4-7 前的命令数（排除即将执行的 4-7 start，排除无 command 的逐 tick step）：

| 类型 | 基线 | W4 |
|---|---:|---:|
| reroll | 35 | 29 |
| buy | 23 | 22 |
| deploy | 12 | 10 |
| continue | 23 | 23 |
| start | 20 | 20 |
| buyXp | 20 | 20 |
| select | 7 | 7 |
| equip | 4 | 4 |
| combine | 3 | 3 |
| sell | 2 | 2 |
| lock | 2 | 2 |
| target | 1 | 1 |
| anomalyReroll | 1 | 1 |
| **总计** | **153** | **144** |

W4 来源账本条数可独立分项相加：26 unit-acquired + 20 combat-growth-committed + 10 item-acquired + 6 unit-upgraded + 3 item-combined + 2 unit-sold = 67。基线为 27 + 20 + 10 + 8 + 3 + 2 = 70。测试同时钉住各类计数与总数，不放宽范围。

因此 W4 开战前 nextUnitSerial 为 27，而非 28。4-7 冻结掉落计划仍明确有一只 Ezreal，实际获得的 reward birth ID 为 unit-27；它与 donor unit-7 被合星消耗，survivor 仍是 unit-9。测试保留 reward 的独立 unit-acquired 来源、receipt 绑定以及紧接的 unit-upgraded acquisitionSequence；并验证原 Combat 不包含这只战后奖励单位。

## 七项失败的迁移

1. 开战前账本精确条数 70 → 67，nextUnitSerial 28 → 27。
2–3. TG 正常迁移/冲突返还两条路径：consumedIds 中 reward unit-28 → unit-27。
4–5. 两条路径重复命令检查：仍要求 reward 的 unit-acquired 恰好一条，改为真实 unit-27。
6. receipt 被改写为 survivor 的负例：定位真实 unit-27 receipt，恢复器仍须以精确 `Invalid resource provenance: receipt birth binding` 拒绝。旧常量导致的是测试先访问 undefined，不能算负例通过。
7. neutral death eventSeq++ 负例保留。新真实事件轨迹下该修改不再先触发序号范围/重复检查，而在 death-reaction 身份关联检查失败；精确报错改为 `Invalid Match save: neutral death event identity`。对应实现检查位于 `neutral-restore.ts:67`；没有把断言放宽为任意 throw。

## 保留的合同

- TG 迁移与冲突返还两种情形均保留。
- 原 Combat 输入基底、1星单位、装备来源 owner、父子临时装备来源均保留。
- 当前 preparation/items/anomaly/temporaryEquipment 原子迁移与 G12 下回合 roll/draw 精确计数均保留。
- 每个存储边界严格 round trip，恢复后的全部 state/events 与原路线逐 tick 相等。
- Continue 后 receipt/provenance 不重发，重复 step/选择/start/Continue 的错误语义保留。
- 原有全部 **12 项**篡改保留，均匹配精确拒绝消息。

## 定向验收

```sh
npm test -- tests/m8-b8-live-transfer.test.ts
```

结果：**1 文件、19 测试全部通过**，耗时 7.64 秒；其中原有 12 项篡改逐项通过。`git diff --check` 通过。
