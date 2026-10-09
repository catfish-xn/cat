# B6 已授权的 B8/B9 显式跳过清单

用户于2026-10-09明确授权：原断言保留，只跳过明确依赖B8/B9的项；清单之外所有检查必须通过。该清单不是B8/B9验收，也不能把历史失败改写成通过。最终审计包须绑定固定SHA；任何后续修改重新打包。

## Vitest（9个显式 `it.skip`，其他同文件断言继续）

| 文件/位置 | 测试名或参数 | 归属/依赖 | 保留的原断言与恢复条件 |
| --- | --- | --- | --- |
| `tests/m5-route.test.ts:37` | `[B8] sniper-caitlyn: complete-build battles and full component grant chain` | B8，缺开场/PvE装备链 | 保留formedBattles>=3。Caitlyn正常购买、实际出战/施法/伤害、胜利、golden继续执行。B8真实掉落接入后取消skip并重跑。 |
| 同上 | `[B8] cannon: complete-build battles and full component grant chain` | B8，缺起手过渡英雄及完整组件 | 保留formed>=3、transitioned=true、卖过渡棋回收装备、15次组件授予。其余胜利/独立账本/四来源同场/异常/升星/锁店/终态拒绝全部继续。B8接线后恢复。 |
| 同上 | `[B8] sniper: complete-build battles and full component grant chain` | 同上 | 同上，独立参数实例。 |
| 同上 | `[B8] mage: complete-build battles and full component grant chain` | 同上 | 同上，独立参数实例。 |
| `tests/m6-integration.test.ts:108` | `[B9] cannon: full 33-battle envelope acceptance` | B9，应用存档上限仍30战 | 保留完整envelope通过与原删整战拒绝；33战逐tick回放/前缀/暂停/篡改检查继续。另在合法两战+当前prefix上明确拒绝“历史缺战或重战”，避免容量假阳性。B9容量接线后恢复。 |
| 同上 | `[B9] sniper: full 33-battle envelope acceptance` | 同上 | 保留完整envelope通过；每战回放仍执行。 |
| 同上 | `[B9] mage: full 33-battle envelope acceptance` | 同上 | 同上，独立参数实例。 |
| 同上 | `[B9] sniper-caitlyn: full 33-battle envelope acceptance` | 同上 | 同上，独立参数实例。 |
| `tests/m6-replay.test.ts:142` | `[B8] keeps completed records through after-choice and exposes frozen history/snapshot references` | B8，缺真正战后奖励choice | 完整原场景代码保留。普通结束战斗的冻结history/snapshot引用另有正常执行测试，不连带跳过。B8战后choice接线后恢复。 |

## Node/浏览器脚本（逐项 stdout `SKIPPED [B8/B9]`，manifest.skipped）

`scripts/b6-deferred-assertions.cjs`只记录跳过，不执行callback，也不给跳过项添加passed字段。保留callback中的原代码。整任务仍运行，只有其非跳过检查全通过才退出0。

| 文件/位置 | skip ID | 归属/依赖 | 继续执行/恢复条件 |
| --- | --- | --- | --- |
| `scripts/verify-m5-headless.cjs:9` | `${build}-42-formed-battles` | B8，formed>=3需完整装备 | 24 seeds、3次性能重复、全部战斗/事件/账本、时钟/RSS采样、胜利和异常出战阈值不改。每次seed42测量都记录skip；B8接线后恢复原formed断言。 |
| `scripts/verify-m5-input.cjs:183` | `mouse-back-to-back-opening-components` | B8，旧连续起手组件链已移除 | 同一原生双击/保护期D/F用真实2-1强化choice继续跑且断言至少执行1次；连续组件子场景保留明确待办。B8接线后核对新开场选择链并恢复。 |
| 同上 | `touch-back-to-back-opening-components` | 同上 | 同上，真实触摸参数仍运行。 |
| `scripts/verify-m5-input.cjs:335` | `normal-opening-rageblade-recipe-and-equipment` | B8，首战Lux和两组件不存在 | 原配方、装备、选择Lux代码完整保留。不能到3-4替代首战。B8英雄/组件链接入后恢复原场景。 |
| `scripts/verify-m5-input.cjs:365` | `normal-opening-rageblade-stat-event` | B8，缺首战羊刀 | 原statChanged事件断言保留。普通1-2原速首战、整账本、4Hz只读观察继续。B8接入后恢复。 |
| `scripts/verify-m5-input.cjs:374` | `normal-opening-rageblade-dynamic-as` | B8，缺首战羊刀动态攻速 | 原Lux/攻速变化断言保留；当前选择unit-1的六项属性UI精确投影继续，产物明确命名current-stats，不能声称动态AS已验。 |
| `scripts/verify-m7-presentation.cjs:215` | `help-over-reward-choice` | B8，2-7真正战后奖励choice缺失 | F02整个依赖场景代码保留；帮助D/F/E、reduced-motion、双激活、回放、404头像继续。B8战后choice接入后恢复。 |
| `tests/m6-application-failures.cjs:21` | `G02-opening_choice_1-3` | B8，1-3开场选择尚未接线 | 原阶段存在断言保留；已废弃旧ordinal1双组件标签按新roundId迁移，不能伪造该样本。B8接线后恢复。 |
| 同上 | `G02-opening_choice_1-4` | B8，1-4开场选择尚未接线 | 同上。 |
| 同上 | `G02-post_pve_choice` | B8，真正战后PvE奖励选择缺失 | supply_choice另列且继续跑，不冒充post-PvE。B8接线后恢复。 |
| `tests/m6-application-failures.cjs:66` | `G02-game_over` | B9，完整终态33战超30 | 仅超现有MAX_BATTLE_RECORDS的实际样本跳过，其他G02准备/强化/异常/39-41tick/结算/补给choice导入、重启、下一命令全保留。若出现其他超限label须先更新本清单审核，不把任意失败吞掉。 |
| `tests/m6-application-failures.cjs:72` | `ROOT_03_same_run_completion_archive_refresh` | B9，首次import即需32完成+当前prefix | 整个既有场景callback保留；缺的是完整档案应用覆盖，不声称已通过。B9接线时按目录升级旧30/90显示期望并恢复。 |
| `tests/m6-application-failures.cjs:86` | `P2-stale-archive-success` | B9，场景前置需完整33战存档 | 原旧归档完成与新激活竞争全部代码保留；B9正式容量后恢复。 |
| 同上 | `P2-stale-archive-reject` | B9，同run新epoch前置需满档 | 同上，拒绝分支独立记录。 |
| `tests/m6-application-failures.cjs:101` | `R4_inflight_combat_then_pending_terminal_commit` | B9，完整末战prefix前置超30 | 原tick80与真正终战提交顺序/30战90归档断言保留；B9容量与目录断言接线后恢复。 |

## 明确保留的门禁

- 不跳整个npm任务、CI job或测试文件，不动CI配置、超时、性能阈值、采样方法、G12。
- M6 retention原30次生命周期、m6-persistence-retry前三战CAS/旧epoch/quota/abort、repository层存储测试全部保留。
- application-failures的G04、ROOT04a/b/c及容量内G02全部保留。没有用截断满档或伪造数据代替33战。
- Input单组件拖拽/取消/旋转/命中用真实2-4供给后Continue到2-5准备期，全部原断言保留；快捷键用真实2+3+5=10G，DDFE后10-2-2-4+1=3，原失败F仍确实资金不足。
- Input首战测量另行New Match回1-2，显式核验空历史、空物品、仅unit-1；没有用后续战斗替换原测量场景。
- 浏览器随机/固定种子复现双方同样完成公开空阵1-2获2G再重抽，保留完整状态、事件和RNG对比；M6布局焦点从真实2-1强化choice测试，不因开场无模态而跳过。

### 新暴露的B8历史子断言

`tests/m6-integration.test.ts` 的 `[B8] cannon: completed history retains sold opening transition units` 单独保留“路线实际卖出”和“旧历史仍含已售英雄”两条断言。新起手不含原过渡英雄，route.buyShop只购买最终编队成员；B8英雄链缺失使这两条在解开容量短路后才暴露。普通首战卖出与冻结历史另由m6-replay真实覆盖；B8接线后恢复此完整路线断言。Vitest清单因此为10个明确跳过，不是9个。

### 待实施的B9浏览器尾段（本检查点仍失败）

CI140 artifact11604394523确认6-5第31战后触发应用30战限制，6-6tick0停住；见`ci140-browser/README.md`。尚未把此新发现加入任何执行跳过；下一检查点需要保留容量内完整浏览器/回放/生命周期覆盖，并逐条保留31～33战与完整终态比较的B9断言，不得整任务skip或增加超时。
