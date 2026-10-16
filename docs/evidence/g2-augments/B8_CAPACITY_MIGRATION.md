# W4 满席与致死掉落场景迁移

首次标准全套：89b219c898b0bc993ccdf2955e576d3df638bbb2。
`live-capacity` 与 `loot-view` 的 beforeAll 报 `T13 public bench full`，不是允许的超时噪声。
30池改变强化选择/经济轨迹后，seed38准备路线在3-7有11个单位，不能把全员放入9个备战位。
原prepare包装直接尝试reserve，因此整组未执行；未通过skip保留这种失败。

## 真实命令适配

只在测试driver增加可选 `emptyBoardRounds` / `protectedUnitIds`。
默认空数组，不改变四条标准路线或原计时负载。
致死测试传入原来的14个主动空场败战回合，另含目标4-7的开战前准备：
单位数超过9时，按星级低优先、ID固定序出售未保护的单位；然后逐个公开deploy到备战席。
每个sell/deploy都经过原driver的command与独立Ledger，不能藏在start包装里漏掉账本。
保护原Loris unit-10及Rell unit-15，不凭空造单位或装备、不改HP、掉落或RNG。
目标4-7仍在start前捕获，之后用公开部署与买牌回填满席。

新固定前缀仍HP3，历史扣血97，九个真实单位和27金币。队伍含二星Loris unit-10、
二星Rell unit-15、二星Ezreal unit-21。旧一英雄位置已不保持击杀能力，因此保留三个
不同结果场景，改用同一真实二星Loris的两种部署位置：

| 场景 | 新合法部署 | 真实死亡记录 | 终局 |
|---|---|---|---|
| 两个来源死亡 | unit-10, col1,row6 | r00 tick392,eventSeq341；r01 tick468,eventSeq414 | tick472败战、HP0 |
| 仅掉落携带者死亡 | unit-10, col1,row7 | r00 tick398,eventSeq349 | tick451败战、HP0 |
| 无来源死亡 | 全空场 | 空 | 败战、HP0 |

前两项仍四条earned进度：granted/granted/retained-terminal/granted；仅发三份收据，
满席英雄不消费unit serial，不可重发或继续。第三项仍四条forfeited、零实际奖励，
不得把隐藏fallback/未击杀来源暴露给LootView。全部原恢复/篡改/命令拒绝断言保留。

另一seed36自然满席胜利场景：第一reveal仍tick74，战斗结束tick122→121；保留精确新时点，
并继续从tick74逐步比较生产恢复前后的完整状态和事件，验证pending-capacity不发行英雄收据。
准备金币21与九席、不合并新英雄、出售后一次授予等不变量不变。

## 复现

`npm test -- tests/m8-b8-live-capacity.test.ts tests/m8-b8-loot-view.test.ts tests/m8-b8-live-economy.test.ts`

2026-10-16专项结果：3文件16/16，6.21秒。正式最终全套另列，专项不是签收。
