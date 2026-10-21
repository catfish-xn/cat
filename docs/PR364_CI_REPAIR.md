# PR #364 CI 收尾（v19，离线）

## 逐项根因

| DBoE 条目 | 根因和处理 |
| --- | --- |
| 1–2 | 沿用上一轮的真实死亡退星与 schema 9 修复；本轮继续回归，不改已批准口径。 |
| 3、7、14、17、21 的 golden/回放项 | 当前入口误读 v18 golden。入口切到 v19，使用原公共命令驱动重录 v19 四路线、cannon/sniper 各 67 存档检查点及 Herald；旧版本不覆写。M6 在 golden 断言前中断，导致后续 `cannonTransition`/封套未赋值，不能据此诊断为坏存档迁移。 |
| 4 | `Set{21}` 是 `rootActionSeq`，不是 21 层 AP。新增金色姐妹改变种子 3151248 的发牌；fixture 不再选中原本仅作用后排的玻璃大炮 II，而回退选灵魂链接，改变伤害/死亡/动作序号。fixture 通过公开卡片重掷选回原强化；原动作 20、双杀、三属性各 +40、死者零击杀/助攻奖励等断言全部保留。统领耗蓝奖励和 bracer 叠层规则未改。 |
| 5 | 同一强化漂移额外带入只有 modifier、没有 triggers 的程序；算术 fixture 对所有程序强制 `.triggers.map` 抛错。只映射存在的 triggers；原 cap=2、候选 AP 集合和拒绝断言不变。 |
| 6、11、15、21 的数量项 | v19 可购买 63 英雄（1–6 费分布 14/13/13/12/8/3）、30 羁绊、61 强化。姐妹须强化解锁，不属于任何英雄的原生标签；3D 现有模型表只覆盖一至五费 60 人，工具显式过滤六费，不凭空编素材路径。非法 cost 改为 7，保留六费的独立数值测试。 |
| 8、14、17、21 的固定种子项 | 姐妹进入金色等权无放回池后，同一 LCG 词映射到新索引；抽词算法及数量未变。公共装备路线第二强化变为玻璃大炮 II，前排 700 HP 等数值断言保留。转装路线仍为 seed 4，两张付费小炮变为 unit-14/unit-24，4-7 奖励为 unit-32；由 `record-v19-transfer.cjs` 重录锚点。投资用例由独立 oracle 找到 seed 51534，保留 2-7 三装备+1 金形状及利息/投资生命的独立数值断言。成长仍按原始过量击杀包推导 125 Bps，v19 路线真实击杀为 3 次。 |
| 9 | 双持角色表补 warwick=ADFIGHTER、viktor=APCARRY、mel=APCASTER，按当前攻击/技能/资源模型明确分配；这是项目装备池角色约定，不冒充额外历史资料。 |
| 10 | 当前 schema 9 存档检查点随 v19 录制；M6 原历史兼容 fixture 不可重写。连带的封套错误须在前置路线完成后重新验证。 |
| 12 | 本轮最终 content digest 为 242e7562；D14 身份断言和 v19 录制统一更新，loot replay digest 为 df0d757c。 |
| 13 | 冠冕拒绝信息已增加家人/梅尔历史证据，更新明确文案；异常和黑玫瑰既有校验保留具体拒绝分类。Eagle Eye 公共路线在 v19 资金不足时会落到其他异常，增加合法预留预算并断言确实选中目标异常。 |
| 15 额外发现 | v19 组装英雄 trait 数组时仅浅冻结；改为递归冻结，恢复已有不可变内容约束，不改变内容值。显示桥的双形战士已启用，测试更新其 open 和桥接集合；未修改表现层文件。 |
| 16 | 物品目录为 44 普通物品+2 合成输入+22 纹章，共 68；22 个批准的自定义纹章加入 provisional 验证，铲/锅无战斗效果不要求战斗说明。 |
| 17 的预览项 | 预览只读了静态 HP，遗漏盖伦开场实际生命共享。改为读取相同认证开场计算的最大生命；按完整准备阵容+解析快照复用，只投影公开字段。 |
| 18 | 未发现召唤物获得装备。真正失败是宝箱给盖伦发生命装备时重算最大生命，丢掉既有共享生命；发装备统一经过既有生命缩放/加成函数。召唤物和建筑排除、伪造召唤物收装拒绝、双方逐 tick 恢复断言均保留。 |
| 19 | 召唤物以自己的 ID 击杀、主人仅凭真实贡献拿助攻均通过。黑玫瑰 3 没有 v19 标记，原先却被送入 v19 通用整战校验，遮盖专用伪造拒绝原因；只在 4+ 启用该路径，原 Sion/成员施法事实校验不变。 |
| 20 | 开局总池增加 3×9=27 张，1198−8 开局−40 商店=1150；持有量、预留和守恒语义不变。选择窗口改为选择不产生 forge 后续节点的合法选项，保留全席完成后立即关闭及原 deadline 断言。没有修改服务器实现。 |

## 界面只读合同

`toPrivateSeatView(state: MatchState)` 新增：

- `familyReunion.eligible: boolean`、`participantIds: readonly string[]`：权威准备阵容与家人纹章资格；不会消耗 RNG、资源或触发彩蛋。
- `familyReunion.downgraded: boolean`、`downgradedAtTick: number | null`：本场实际死亡退星事实；无事实为 false/null，下一场依据新 combat 重算。`readG23MechanismState(state).familyReunion` 同字段。
- `shopOdds.sixCostBps: number`：每格当前六费档位概率，整数基点，10000=100%；4-6 前为 0，4-6 为 20（10 级为 180），下一回合为 24/184。这是档位规则概率，具体共享池耗尽回退仍由服务器规则处理。

本轮不修改 `src/presentation/`、`src/rendering/`、`src/server/` 或素材。六费目前沿用现有无官方头像时的代码图形回退；若 Claude 要新增头像映射，ID 为 `warwick`、`viktor`、`mel`，新增羁绊 ID 为 `sisters`、`form-swapper`、`blood-hunter`、`machine-herald`、`banished-mage`。

## 版本与验证

身份：rules/content=`s13-g2-3-v19` / `s13-14.24b-g2-3-v19`；schema/save/replay/command=`9/5/4/4`，50ms、lcg32-v1 不变。完整摘要为 `fnv1a32-utf16:242e7562` / `fnv1a32-utf16:df0d757c`。

录制/验证使用 `scripts/verify-v19-epoch.cjs` 九个顺序步骤；历史 byte audit 继续保护 v15–v18 及 g2-4b manifest。四个 fast 分片由 Node 运行同一 `npm test` 对应的 Vitest 入口；沙箱须附 `--configLoader runner --maxWorkers=2`，默认 esbuild 配置加载无法读取祖先目录。最终分片结果另存本次验证证据；初次诊断日志不作为最终通过依据。

最终结果见 [ci-repair-verification.json](evidence/v19/ci-repair-verification.json)：

| 完整分片 | 通过 | 失败 | 跳过 | 剩余原因 |
| --- | ---: | ---: | ---: | --- |
| 1/4 | 1371 | 10 | 0 | 8 项素材目录 EPERM；2 项 resumable-battle 默认 5 秒超时 |
| 2/4 | 1526 | 12 | 1 | 12 项素材目录 EPERM；跳过的是既有 extraction-record filesystem 用例 |
| 3/4 | 1704 | 2 | 0 | bracer 压力测试的 esbuild 子进程无法读取沙箱祖先目录 |
| 4/4 | 1488 | 4 | 0 | 4 项素材打包目录 EPERM；该最终重跑使用 maxWorkers=1 |

总计 6089 通过、28 失败、1 项原有跳过。没有将环境失败算作通过；不能声称完整 CI 全绿。分片 1 的超时文件用单 worker、仅命令行 `--testTimeout=20000` 复核，15 项通过；项目默认时限未修改，完整分片仍保留这 2 项超时记录。用户需在沙箱外按原命令复核这些残余。

`tsc --noEmit` 退出码 0；epoch 九步全部退出码 0、complete=true；release/input/Herald 的录制源哈希与最终代码逐项一致。125 份 v15–v18 历史文件、历史断言前缀和受保护 manifest 原字节一致，manifest SHA256=`b39c443bedb12f205230ce0ffbf6a93c2184d73d73cb92ee46eaadf08e086a22`。

未联网、未执行 Git 写操作、未修改服务器/表现层/素材。本地 `origin/multiplayer` 仍停在 #355，且没有本地 multiplayer 分支，因此无法离线断言与 #360–#363 的精确冲突；外部合并重点核对 `private-seat-view.ts`、`encounter-selectors.ts`、恢复模块、`units.ts` 和 `scripts/assets3d/runtime.mjs`。
