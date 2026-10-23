# 五费技能几何（项目决定 P，v22 候选）

基线：`codex/five-cost-3star-fixes` / `94f8b96b211d6af32cf07063efe65aa8b0565f47`。本单离线、无 commit；只处理金克丝、杰斯、莫德凯撒、玛尔扎哈。**完成三项；杰斯缺落点定义，待确认，尚未完成。** 本文接续 [上一单报告](FIVE_COST_3STAR_FIXES.md)，覆盖其中金克丝三星/莫德凯撒暂停说明。

依据：用户 2026-10-23 批准的 `/home/aiapps/workspcae/perf-1022/rules-1023/approved-1023-batch2.md`「五费/六费」四条；补充调研 `/home/aiapps/workspace/champion-skills-research-2026-10-23/champion-skills-report.zh-CN.md` 第 2–5 节。几何及整数余数顺序标为项目决定 **P**，不称为已验证的 Riot 服务器算法。原始内容表、伤害/控制数值、CI、表现层、服务器均未改。**版本/epoch/digest/golden：待 v22 统一录制**，当前候选不能与旧规则混跑或发布。

## 实现位置与执行约定

| 项目 | 位置 | 行为 |
| --- | --- | --- |
| 共用几何 | `src/simulation/combat-skill-lines.ts:5` / `:13` | 使用 odd-row 格中心，邻格中心距为 1；宽度是全宽，矩形边界闭合，起点后方和终点之外不命中。以双倍坐标和整数平方比较，不抽 RNG、不读像素、不作浮点角度排序。方向编号沿已有 E、SE、SW、W、NW、NE。板边只裁去板外目标，不删候选方向。 |
| 金克丝 | `src/simulation/combat-g2-2.ts:61` | 仅三星第一招电击改为朝当前目标的 14×1 穿透直线，可打到目标后方；1/2 星及另外两招保持原行为。三星基础眩晕仍为 200 tick。 |
| 莫德凯撒 | `src/simulation/combat-g2-2.ts:70` | 自身出发枚举六条 8×3 直线，依次比较命中数、是否覆盖当前目标、方向编号；一次命中每人一包。最近四人的既有 25% 额外伤害仍按全体敌人距离/ID 排序，不因选线重选四人。未扩展位移或强化普攻规则。 |
| 玛尔扎哈 | `src/simulation/combat-g2.ts:111` | 当前 HEAD 实际已是总计五个感染任务；本单明确按命中 ID 顺序稳定分配，保留轮转五层的精简实现，补齐 1–5 人向量。每人 floor(5/N) 层，前 5%N 人多一层；不是每人固定一层。横门、单层伤害、死亡传播及脉冲相位保持原有。 |
| 杰斯（未完成） | `src/simulation/combat-g2-3.ts:129`（未修改） | 批准条目规定从落点返回原位、两侧 1 格各伤一次，却未定义落点；当前代码只有施法者→目标的旧路径，没有落点状态。调研第 4 节明确第二门位置/方向未确认。已询问是否采用朝目标方向延至板边作为返回起点；收到确认前保留旧实现。没有擅自把 480/290 换算成新的格数。 |

矩形判定：令双倍坐标差为 `(dx,dy)`，目标相对起点为 `(px,py)`，`N=dx²+3dy²`、`D=dx·px+3dy·py`、`C=dx·py−dy·px`。长度 L、全宽 W 的命中条件是 `N>0`、`D≥0`、`D²≤4L²N`、`3C²≤W²N`。此为项目离散棋盘的几何表达，不从调研中的客户端宽度字段推测碰撞体。

Match 公共函数签名、输入输出、失败 reason、事件封套、存档结构均不新增。直线在原施法规划时冻结，伤害仍经过原同步结算屏障；新增计算不消费 RNG。仍用已有 `cast` / `packetDamage` / `statusApplied` 数据，界面不得另算命中。相关合同仅同步本单状态。

## 独立手算向量

测试：`tests/five-cost-geometry.test.ts:28` 起；AD=100、AP=100、双抗=0，禁用普攻和移动，直接规划的 RNG 回调一旦被调用便抛错；另有真实 step 零抽词断言。

- 金克丝三星：起点 (2,4)，目标 (4,4)，命中 (3,4)/(4,4)/(16,4)，(17,4) 超长、(5,5) 侧外、(1,4) 后方不命中；3 人×2000=**6000 raw**，每人眩晕 **200 tick**。1/2 星同场仅目标一包 **265**。斜线 (1,1)→(2,2) 可继续打到 (3,4)，不打 (3,2)。
- 莫德凯撒：自身 (3,4)，当前目标 (4,4)，西侧 (0,3)/(0,4)/(0,5) 三人，比东侧一人优先；AP100 的 1/2/3 星每人 **200/300/1000**，三人总 **600/900/3000 raw**。东、西各一人时优先当前目标所在方向；若当前目标在起点且两线都覆盖，则取编号 0（东）。五名东侧敌人由近到远，一星包为 **200/200/200/200/160**，总 **960 raw**，第五人没有额外25%。
- 宽长边界：自身 (2,4) 朝东，宽3/长8包含 (3,3)/(3,4)/(3,5)/(10,4)，排除 (3,2)/(3,6)/(11,4)/(1,4)。顶边仍保留六方向的稳定编号。
- 玛尔扎哈：命中 1/2/3/4/5 人时感染层分布为 **[5] / [3,2] / [2,2,1] / [2,1,1,1] / [1,1,1,1,1]**。五层单层 raw14，总每秒 **70**，首脉冲始终 tick21；此前已有的 1/2/3 星传播/宿主再死亡测试继续通过，未改层伤害表。
- 杰斯仅能确定 AD100 主伤 **500/500/2000**、次伤每人 **225/225/1500**；缺起点不能给出可信命中人数向量，本单不冒充通过。

## 验收

所有 Vitest 调用使用 `--configLoader runner --no-file-parallelism`，避开只读共享 node_modules 的临时配置缓存；没有联网/安装依赖或修改配置。

| 检查 | 结果 |
| --- | --- |
| 最终独立几何 + 上单五费向量 + 回放/恢复 | 52/52 通过，见 `evidence/five-cost-geometry/final.log` |
| 扩展相关回归 | 14 文件、227 项：216 通过 / 11 失败，见 [related.log](evidence/five-cost-geometry/related.log) |
| 基线隔离复核 | 原 HEAD 副本中 11/11 同原因失败；[baseline.log](evidence/five-cost-geometry/baseline.log) / [baseline-pr161.log](evidence/five-cost-geometry/baseline-pr161.log)。不改旧断言。 |
| 确定性 | 金克丝/莫德凯撒/玛尔扎哈全状态、完整事件、RNG 的输入倒序与 JSON checkpoint 一致；同步和 1/7 tick 切片及完整回放逐字节一致；施法后从认证输入恢复，再 step 与原战斗一致。 |
| 类型/差异 | `npm run typecheck`、`git diff --check` 通过 |
| 生产 JS 增量 | Vite 原配置、仅省略 public 原样复制；2D minified **+529 B**，gzip-9 **+278 B**（664005→664283），Phaser chunk 不变。见 [bundle.json](evidence/five-cost-geometry/bundle.json)。不是发布预算门禁，未调整阈值。 |

旧失败清单（均在本单改动前 HEAD 复现）：

| 旧测试 | 数量 | 原因 |
| --- | ---: | --- |
| `b8-resumable-battle-helper.ts:70`：pre-change byte fingerprint，0/1/9 units per side | 3 | 旧 v21 指纹不匹配；待 v22 统一录制。 |
| `v19-part2.test.ts:60`：freezes stage/level odds and preserves two words per shop slot | 1 | 六费旧期望20、实际16；超出本单，需协调者核查，不自动改断言。 |
| `v19-part2.test.ts:73`：shared six-cost reservations are finite… | 1 | `pool-empty`，未进入本单技能。 |
| `task-mechanism-restore.test.ts:287`：restores a living Bulky Buddies holder after its Forge buddy dies… | 1 | 准备路径 `bench-full`。 |
| `g2-3-identity.test.ts:52`：restores a real paid armory purchase after settlement… | 1 | 旧运营 oracle `earned source must be dead`，尚未进入购买恢复路径。 |
| `g2-4b-pr161-restore.test.ts:237`：restores automatic heroes/duplicator…；`:294`：rejects edited automatic birth serials…；`:382`：cold Node processes restore actual canonical saves… | 3 | 旧征服者轨迹期望 `[5-3,1172,13]`，基线已为 `[5-4,1208,14]`。 |
| `g2-4b-pr161-restore.test.ts:333`：seed42 naturally opens tier10 at 5-2/654 stacks… | 1 | 旧轨迹期望 `[26,5-2,654]`，基线已为 `[27,5-3,690]`。 |

本单未跑浏览器或全仓完整运营测试，未重录任何 epoch/digest/golden。下一步先确认杰斯返回起点，再补实现、手算命中人数和同样的一致性验收；其后交 v22 汇总规则身份。
