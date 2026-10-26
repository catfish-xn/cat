【完成】强化池漂移：`tests/v15-anomaly-availability.test.ts:11` 精确更新为224（56异常不变，7例）；`tests/blistering-restore.test.ts:43` 改seed491，仍同时要求Blistering与Powder并逐tick恢复（5例）；`tests/g2-4b-trench-gold.test.ts:17` 选真实Automata Crest，保留独立金币随机数与2/1/2次收益断言（1例）。  
【完成】无赠品/购入阵容控制：`tests/m5-match-integration.test.ts:32` 选Built Different且仍要求零物品（3例）；`tests/m8-b6-gate-preparation.test.js:43` 用seed307的Clear Mind，保留仅真实2-4剑的断言（8例）；`tests/match-session.test.ts:39` 定向选Slammin而非赠英雄的Sentinel Slam，严格保留原阵容及序号（18例）。  
【完成】恢复夹具：`tests/g2-4b-resists-restore.test.ts:98` 明确Dominator Crest，护盾精确133（21例）；`tests/fixtures/g24-natural-forge.ts:45` 用Trade Sector避开新Slammin历史要求；`tests/g2-4b-pr161-restore.test.ts:39` 用Immovable Object避免Family Crown赠品挤满复制器备战席，精确校验unit-64/item-26与完整历史（11例）；共用路线回归`tests/b8-late-claim-receipt-order.test.ts`（24例）。  
【完成】开场单档恢复：`tests/match-helpers.ts:30` 新增仅显式调用生效的强化排除参数；`tests/opening-encounters-pr5.test.ts:17`、`tests/opening-encounters-pr6.test.ts:250` 排除B4XP及随后出现的Spoils，避开与猴子/Mel开场测试无关的全历史认证；保留领取一次、伪造拒绝与恢复断言，分别31/42例。  
【完成】Sion夹具：`tests/task-mechanism-restore.test.ts:72`、`tests/bracer-multikill-stacks.test.ts:444` 的seed26新选Gold For Dummies致备战席满且击杀轨迹改变；改seed59/Long Distance Pals，必要时公开出售闲置备战席，精确要求294 tick击杀enemy-r8-4、持有者零贡献/零助攻和逐tick恢复，分别20/25例。  
【完成】遍历节点：`tests/m5-growth.test.ts:97` 的真实资金路线现在跨4-6，公开取得异常并断言目标不是随后购买的Tristana，不跳节点且保留独立商店计价（12例）；`tests/t7-integration.test.ts:21` 用seed42保留真实augment/component/forge三类完整覆盖（4例）。  
【完成】对象资格与耗时：`tests/t12-combat-equip.test.ts:361` 原先选中死亡假人，改选永久正式英雄并保留装备/下一战属性断言（74例）；`tests/d11-wiring-match.test.ts:23` 原种子逐个重放开场导致单跑也超时，改首节点候选搜索后真实路线复核，另排除不能上场的铁砧（5例）。  
【完成】保留伪造、准确拒绝：`tests/g2-4a-crown-history.test.ts:57` 只同步新增XP类别的完整缺证据文案（56例）；`tests/restore-audit/cd-replay-facts.test.ts:247` 与Sion负例保持原篡改，改断言准确的`Invalid authoritative Mirror forge replay`（CD 34例）；`src/simulation/serialization-structure.ts:331` 先调用全动态重放，`src/simulation/g2-4b-gold-restore.ts:98` 比较完整运行态后拒绝，其Mirror forge为旧通用错误标签，确实严于后续G23/Sion局部检查。  
【完成】服务器夹具：`tests/server/battle-start-slices.test.ts:107` 重录后seat-1为0金且首个备战席是铁砧，先公开出售棋盘英雄，再买卖1费Amumu以保留全部FIFO成功/冻结/等价断言，23轮阵容精确更新为8/8/8/8/7/8/8（12例）；`tests/server/carousel-room.test.ts:489` 新轨迹为5-6、距5-4两战，保留真实持有和共享池归还核验（20例）。  
【完成】分段联机根因：`tests/server/v17-avarice-pvp.test.ts:28` 新薇古丝低AD使小额增幅被整数取整吞掉，另一方+1金未跨2金档；连续三次合法支出仍要求实际回放改变且逐笔样本不串席（3842例）；`tests/server/net/v17-avarice-reconnect.test.ts:49` seed11提前死亡，换能存活至4-6的seed2并六次刷新形成可见差异，仍逐笔比对样本、两次重连回放与一次结算（1921例）；未改slow-route或生产服务器。  
【完成】验证：指定22文件加直接受影响夹具回归1文件，以`--maxWorkers=8`集中复跑，23/23文件、6196/6196用例全部通过（79.65s，`/tmp/fresid3-verified.log`、`/tmp/fresid3-verified.json`）；`npm run typecheck`及`git diff --check`通过。决策记为`docs/S13_RULES_GAP.md:1246`的P（2026-10-25）。报告对应基线codex/v23-fresid3 / 3bffa561；仅tests/docs有改动，未提交。  
【未完成】无功能修复待办；没有按“单跑通过”忽略任何纯超时（d11单跑仍超时，已优化并通过）；按要求未运行完整测试套件，只运行清单22文件、共用夹具直接覆盖的1文件及已删除的定向搜索探针。  
【需要我决定】无；夹具取舍已依授权自行决定并记录P。  
【风险】固定种子仍会随将来强化池变化失效，意图与数值断言会明确报错；本轮未改生产源码、规则、数值、保存格式、身份版本、独立oracle、golden、证据文件或前端，也未新增超时或放宽断言。  
【下一步】交叉评审这些测试/夹具差异，再与独立v23 epoch重录结果一起验收；本报告不代表完整fast套件已重跑。
