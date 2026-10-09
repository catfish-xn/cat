# H1 B4重触发模块负载（独立诊断）

## 范围

`h1-b4-module.cjs` 在空白桌面Chromium页面通过Vite dev加载固定97f38a0的真实stepCombat、目录和统计查询；复用既有无Vitest依赖的B4单元构造fixture。**这是受控引擎模块负载，不是正常玩家命令生成的整局，也不是完整Phaser/保存/回放UI生命周期。** 不用它替代原浏览器堆门禁或宣称完整应用无泄漏。

四组每次独立战斗seed42，最多1200 tick自然结束，五个固定位置高血量敌人。每战combatId唯一，防止一直复用standalone掩盖按战斗ID保留的对象。玩家HP/Mana仅在构造时设置，运行中不回填HP、不修改状态来延长战斗。

| 组 | 装备 | 触发覆盖依据 |
| --- | --- | --- |
| 多目标派生 | 电刀、卢安娜、鬼索 | 电刀/卢安娜packetDamage、鬼索statChanged均须非零 |
| 状态刷新 | 红Buff、莫雷洛、日炎 | 三者statusChanged均须非零，多来源状态活动，另记reason分布 |
| 周期 | 大天使、救赎、龙牙 | 大天使statChanged、救赎/龙牙heal均须非零 |
| 反击/封顶 | 荆棘、泰坦、石像鬼 | 荆棘packetDamage须非零、每战泰坦达到既定25层；石像鬼只记录实际armor查询，不将数值反推为独立oracle |

每战单独检查覆盖并记录coveredBattles，预热也要求战斗结束且覆盖满足；statusChanged另记reason分布，不仅统计总量。这些是“实际触发路径存在”的覆盖断言，不是装备数值正确性的全套验收。B4原签收测试不改。未覆盖饮血一次性盾、所有装备组合或完整应用B4导入路线。

## 内存方法

默认每组先2战预热，再6个窗口，每窗每组30战（合计120战/窗）。每步真实stepCombat，事件即时归并为固定种类计数，不保存完整events、历史CombatState、console对象或逐tick快照。生产自己的状态/账本不截断；每战自然结束后只导出标量，函数返回后释放诊断方引用。

每窗记录运行前post-GC、末尾GC前、末尾post-GC三个堆读数以及真实ticks/触发计数、最大runtime条目/状态贡献/周期任务数、最终RNG状态。GC前末尾读数不是全程峰值。最后释放固定诊断闭包再取独立读数，仍不能把浏览器模块缓存视为必须归零。

没有新内存阈值，也不复用preview1MiB/dev1.5MiB来判该空白页通过。`completed`仅指脚本/覆盖检查完成，堆走势必须另行解释。原门禁/CI/运行代码不修改。

## 已做验证

源src指纹及两个构造fixture文件哈希始末分别核对。没有无装备/空循环对照，混合负载不能定位某件装备或排除JIT/Playwright/harness影响。

本机Node校准四组各1战，均自然结束、覆盖满足，指纹始末一致；结果见 `docs/evidence/h1-b4/node-calibration.json`。这不是Chromium内存数据；本机源工作树存在未跟踪node_modules链接，已原样记入sourceStatus，不冒充干净浏览器实测。

校准观察（非反推测试预期）：多目标995tick、鬼索220次statChanged/卢安娜179包/电刀213包；状态组1200tick；周期组龙牙30次heal、救赎12次heal、大天使12次statChanged；反击组荆棘23包、泰坦25层。数字只用于识别负载是否实际运作，CI仍从固定源重新执行并输出完整计数。

```bash
node scripts/diagnostics/h1-b4-module.cjs --source /absolute/97f38a0 --output /tmp/h1-b4-calibration --calibrate-only
# 在已安装项目锁定依赖和Chromium153的环境中：
node scripts/diagnostics/h1-b4-module.cjs --source /absolute/clean-97f38a0 --output /tmp/h1-b4-measure --windows 6 --battles 30
```

临时workflow的b4-module组仅允许mode=dev，避免把Vite源模块模式标成preview。该组需先把临时YAML配置改为b4-module，再单独重贴专用标签；当前配置仍是extended，B4浏览器负载尚未运行。
