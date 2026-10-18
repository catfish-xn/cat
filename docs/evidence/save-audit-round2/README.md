# PR #171 第二轮复审暂停检查点

已按用户要求暂停。下方 87 文件表来自最后完整的一轮：1940/1943 通过、3 条超时。三处随后已修复，77/77 重点复验通过；最终全集在 129.740 秒时应用户要求中断，尚未完成验收。表中失败数不是修复后的最终结果。

原始 head `f7ddedfaca353adeeeff653216026413d6de448e`，先 fetch、ls-remote 核对，再合入 multiplayer `7142dc6e7a40129aace7e47a851b712877fba7d2`（合并提交 `c2fcaf5`）。

## 共用辅助函数与校验边界

- `tests/fixtures/recorded-match.ts`：观察真实公共命令和完整战斗事件；`copyRecordedMatch` 复制独立的真实观察快照。
- `tests/fixtures/history-evidence.ts`：按文件隔离历史注册表，用完整内容区分状态和分支；worker 全局容器让 resetModules 前后的实例能正确清理同一文件。每次读写仍调用生产严格校验。
- `tests/fixtures/completed-battle-history.ts`：保留真实前缀及 runId，完整保留事件；只在必要边界构建快照。
- `tests/fixtures/recorded-fixture.ts` 与 `save-history/*.json.gz`：仅保存真实录制状态、上下文、事件和哈希，不存“已验证”标志。
- `tests/fixtures/verify-recorded-history.ts`：冷历史校验是可见的计时测试，每条保留默认 5 秒限制，全部计入进程总耗时。
- `tests/fixtures/recorded-route-history.ts`：从既有命令驱动器的真实前后状态和完整事件，为 F1 等脚本建立历史。
- `scripts/record-save-checkpoint-history.cjs`：检查 67 个原始炮手检查点与 33 战实录逐项一致。
- `scripts/record-armory-history.cjs`：从真实开局重录购买 Rumble 及三战后的军械库，24 战完整历史；--check 对比独立重录结果。加载仅复制原始状态和账本，首次验证仍在原读档用例/计时校验中。

## 命令与计时

父进程使用单调时钟，包含启动、导入、夹具加载、冷校验、全部测试和退出。B7、炮手和全集顺序独立运行，无其他重负载争用。B7 和炮手使用 Node 默认堆；全集使用单 worker，保持 fast 的 isolate:false，没有改测试时限。全集的 old-space 上限与完整命令记录在 time.json / summary.json 中。

| 项目 | 进程总秒数 | 退出码 |
| --- | ---: | ---: |
| 三处修复前 87 文件（1940/1943） | 1085.690 | 1 |
| B7 独立 | 91.878 | 0 |
| M5 炮手独立 | 165.996 | 0 |
| 最终 typecheck | 23.798 | 0 |
| Herald --write | 146.494 | 0 |
| inputs 重算 | 4.769 | 0 |
| inputs --check | 5.427 | 0 |
| 炮手实录 --check | 17.232 | 0 |
| 引擎可移植性 | 0.908 | 0 |
| Node 入口 | 3.387 | 0 |
| 修复中 16 文件重点复验 | 230.287 | 0 |
| 定稿前缓存观察隔离回归 | 8.368 | 0 |
| 军械库真实路线 --write | 19.508 | 0 |
| 军械库真实路线 --check | 19.636 | 0 |
| 最后 6 文件重点复验 | 104.914 | 0 |
| 蓝霸符原料实录探测 | 9.032 | 0 |
| 最终摘要碰撞回归 | 3.042 | 0 |
| 最终 5 文件组合复验（2 条超时） | 88.595 | 1 |
| 双饮血剑真实获取路线探测 | 6.041 | 0 |
| 最后三处耗时修复复验 | 50.647 | 0 |
| 最终全集（用户要求暂停而中断） | 129.740 | 130 |

B7：127/127 通过；97 条冷历史校验共 53.954 秒，原 30 条用例共 22.778 秒。40 秒目标未达到。炮手保留原 180 秒时限。

指纹严格按以下顺序完成：

```sh
node tests/fixtures/record-g2-3-herald.cjs --write
node scripts/record-g2-3-inputs.cjs
node scripts/record-g2-3-inputs.cjs --check
```

Herald 来源指纹 `e173951aba842d6815447362b6f79125bb87478f38e2518e498de2456e607ecb`，其固定的来源文件均与当前内容一致。未运行 `verify-m8-herald-fixtures.cjs --write`。历史 `g2-augments-herald-raw/` 的 7 个文件与 multiplayer 逐字节一致，见 [字节比较](historical-raw-bytes.json)。

## 最近完整一轮 87 文件逐文件结果（在最后三处修复前）

```sh
rg -l 'restoreMatch|serializeMatch|parseSave|readCompatibility|importFile' tests --glob '*.test.ts' | sort > /tmp/restore-files
NODE_OPTIONS=--max-old-space-size=3072 ./node_modules/.bin/vitest run --project fast $(cat /tmp/restore-files) --maxWorkers=1 --reporter=verbose --reporter=json --outputFile=/tmp/restore-results.json
```

共 87 文件，1940/1943 通过，3 条失败、0 条未执行。其中 540 条为该轮新增的可见夹具校验或回归；原用例没有删除或主动跳过。

| 文件（相对于 tests/） | 通过/总数 | 新增夹具校验/回归 | 失败 | 测试秒数 |
| --- | ---: | ---: | ---: | ---: |
| [chest-bracer-integration-trial.test.ts](../../../tests/chest-bracer-integration-trial.test.ts) | 10/11 | 0 | 1 | 19.903 |
| [crown-restore-cache.test.ts](../../../tests/crown-restore-cache.test.ts) | 6/6 | 0 | 0 | 2.658 |
| [explorer-bracer-restore.test.ts](../../../tests/explorer-bracer-restore.test.ts) | 24/24 | 0 | 0 | 8.599 |
| [g2-2-identity.test.ts](../../../tests/g2-2-identity.test.ts) | 1/1 | 0 | 0 | 0.200 |
| [g2-3-followup.test.ts](../../../tests/g2-3-followup.test.ts) | 11/11 | 0 | 0 | 0.287 |
| [g2-3-identity.test.ts](../../../tests/g2-3-identity.test.ts) | 14/14 | 0 | 0 | 8.024 |
| [g2-3-integration.test.ts](../../../tests/g2-3-integration.test.ts) | 18/18 | 0 | 0 | 1.668 |
| [g2-3-lesser-shimmer-duplicator.test.ts](../../../tests/g2-3-lesser-shimmer-duplicator.test.ts) | 37/37 | 0 | 0 | 17.225 |
| [g2-3-netcode-hooks.test.ts](../../../tests/g2-3-netcode-hooks.test.ts) | 14/14 | 0 | 0 | 6.241 |
| [g2-4a-crown-gold.test.ts](../../../tests/g2-4a-crown-gold.test.ts) | 9/9 | 0 | 0 | 3.294 |
| [g2-4a-crown-history.test.ts](../../../tests/g2-4a-crown-history.test.ts) | 56/56 | 0 | 0 | 27.353 |
| [g2-4a-crown.test.ts](../../../tests/g2-4a-crown.test.ts) | 6/6 | 0 | 0 | 0.227 |
| [g2-4b-artifact-forge.test.ts](../../../tests/g2-4b-artifact-forge.test.ts) | 7/7 | 0 | 0 | 2.281 |
| [g2-4b-pr161-restore.test.ts](../../../tests/g2-4b-pr161-restore.test.ts) | 11/11 | 0 | 0 | 41.337 |
| [g2-4b-resists-restore.test.ts](../../../tests/g2-4b-resists-restore.test.ts) | 21/21 | 0 | 0 | 10.387 |
| [g2-4b-unstable-chest.test.ts](../../../tests/g2-4b-unstable-chest.test.ts) | 39/39 | 0 | 0 | 27.365 |
| [g2-augments-choice.test.ts](../../../tests/g2-augments-choice.test.ts) | 35/35 | 0 | 0 | 6.093 |
| [g2-augments-combat.test.ts](../../../tests/g2-augments-combat.test.ts) | 16/16 | 0 | 0 | 4.732 |
| [g2-augments-identity.test.ts](../../../tests/g2-augments-identity.test.ts) | 1/1 | 0 | 0 | 0.191 |
| [m4-ledger-bound.test.ts](../../../tests/m4-ledger-bound.test.ts) | 2/2 | 0 | 0 | 25.434 |
| [m4-review-regressions.test.ts](../../../tests/m4-review-regressions.test.ts) | 16/16 | 0 | 0 | 0.228 |
| [m5-audit-boundaries.test.ts](../../../tests/m5-audit-boundaries.test.ts) | 38/38 | 18 | 0 | 6.706 |
| [m5-growth.test.ts](../../../tests/m5-growth.test.ts) | 2/2 | 0 | 0 | 2.988 |
| [m5-match-integration.test.ts](../../../tests/m5-match-integration.test.ts) | 3/3 | 0 | 0 | 17.439 |
| [m5-regressions.test.ts](../../../tests/m5-regressions.test.ts) | 9/9 | 0 | 0 | 0.203 |
| [m5-route.test.ts](../../../tests/m5-route.test.ts) | 140/140 | 132 | 0 | 113.076 |
| [m5-runtime-import.test.ts](../../../tests/m5-runtime-import.test.ts) | 15/15 | 0 | 0 | 0.487 |
| [m5-serialization.test.ts](../../../tests/m5-serialization.test.ts) | 33/33 | 0 | 0 | 0.972 |
| [m7-m6-save-compat.test.ts](../../../tests/m7-m6-save-compat.test.ts) | 8/8 | 0 | 0 | 2.201 |
| [m8-b10-encounter-outcomes.test.ts](../../../tests/m8-b10-encounter-outcomes.test.ts) | 46/46 | 0 | 0 | 5.168 |
| [m8-b10-item-save-replay.test.ts](../../../tests/m8-b10-item-save-replay.test.ts) | 45/45 | 0 | 0 | 28.573 |
| [m8-b3-audit.test.ts](../../../tests/m8-b3-audit.test.ts) | 6/6 | 0 | 0 | 2.009 |
| [m8-b3-restore.test.ts](../../../tests/m8-b3-restore.test.ts) | 13/13 | 0 | 0 | 1.000 |
| [m8-b4-audit-regressions.test.ts](../../../tests/m8-b4-audit-regressions.test.ts) | 14/14 | 0 | 0 | 33.666 |
| [m8-b4-catalog.test.ts](../../../tests/m8-b4-catalog.test.ts) | 84/84 | 0 | 0 | 22.518 |
| [m8-b4-integration.test.ts](../../../tests/m8-b4-integration.test.ts) | 16/16 | 0 | 0 | 5.257 |
| [m8-b4-r3b-lifecycle.test.ts](../../../tests/m8-b4-r3b-lifecycle.test.ts) | 3/4 | 0 | 1 | 10.641 |
| [m8-b5-equipment-history.test.ts](../../../tests/m8-b5-equipment-history.test.ts) | 9/9 | 0 | 0 | 12.302 |
| [m8-b5-grant-upgrade.test.ts](../../../tests/m8-b5-grant-upgrade.test.ts) | 43/43 | 29 | 0 | 30.638 |
| [m8-b5-instances.test.ts](../../../tests/m8-b5-instances.test.ts) | 33/33 | 15 | 0 | 16.801 |
| [m8-b5-queries.test.ts](../../../tests/m8-b5-queries.test.ts) | 5/5 | 0 | 0 | 4.191 |
| [m8-b5-temporary.test.ts](../../../tests/m8-b5-temporary.test.ts) | 30/30 | 0 | 0 | 8.221 |
| [m8-b6-match-wiring.test.ts](../../../tests/m8-b6-match-wiring.test.ts) | 15/16 | 0 | 1 | 25.964 |
| [m8-b7-audit-vectors.test.ts](../../../tests/m8-b7-audit-vectors.test.ts) | 61/61 | 47 | 0 | 30.083 |
| [m8-b7-cleanup.test.ts](../../../tests/m8-b7-cleanup.test.ts) | 5/5 | 0 | 0 | 0.131 |
| [m8-b7-match-wiring.test.ts](../../../tests/m8-b7-match-wiring.test.ts) | 127/127 | 97 | 0 | 58.052 |
| [m8-b7-serialization-reuse.test.ts](../../../tests/m8-b7-serialization-reuse.test.ts) | 6/6 | 0 | 0 | 0.749 |
| [m8-b8-combat-input.test.ts](../../../tests/m8-b8-combat-input.test.ts) | 38/38 | 0 | 0 | 0.456 |
| [m8-b8-equipment-fixture.test.ts](../../../tests/m8-b8-equipment-fixture.test.ts) | 6/6 | 2 | 0 | 6.697 |
| [m8-b8-live-capacity.test.ts](../../../tests/m8-b8-live-capacity.test.ts) | 6/6 | 0 | 0 | 5.379 |
| [m8-b8-live-cross-round.test.ts](../../../tests/m8-b8-live-cross-round.test.ts) | 6/6 | 0 | 0 | 1.326 |
| [m8-b8-live-economy.test.ts](../../../tests/m8-b8-live-economy.test.ts) | 11/11 | 8 | 0 | 2.957 |
| [m8-b8-live-growth.test.ts](../../../tests/m8-b8-live-growth.test.ts) | 41/41 | 15 | 0 | 7.160 |
| [m8-b8-live-reveal.test.ts](../../../tests/m8-b8-live-reveal.test.ts) | 3/3 | 0 | 0 | 7.623 |
| [m8-b8-live-transfer.test.ts](../../../tests/m8-b8-live-transfer.test.ts) | 19/19 | 0 | 0 | 3.982 |
| [m8-b8-loot-view.test.ts](../../../tests/m8-b8-loot-view.test.ts) | 7/7 | 0 | 0 | 8.673 |
| [m8-b8-restore-fold-reuse.test.ts](../../../tests/m8-b8-restore-fold-reuse.test.ts) | 5/5 | 0 | 0 | 0.233 |
| [m8-b8-restore.test.ts](../../../tests/m8-b8-restore.test.ts) | 7/7 | 0 | 0 | 2.233 |
| [m8-b9-compatibility.test.ts](../../../tests/m8-b9-compatibility.test.ts) | 11/11 | 0 | 0 | 1.187 |
| [m8-content-equivalence.test.ts](../../../tests/m8-content-equivalence.test.ts) | 70/70 | 66 | 0 | 26.871 |
| [m8-u5-preview.test.ts](../../../tests/m8-u5-preview.test.ts) | 93/93 | 33 | 0 | 5.756 |
| [opening-random-1cost.test.ts](../../../tests/opening-random-1cost.test.ts) | 4/4 | 0 | 0 | 0.140 |
| [opening-random-identity.test.ts](../../../tests/opening-random-identity.test.ts) | 139/139 | 0 | 0 | 41.497 |
| [p7-1-identity.test.ts](../../../tests/p7-1-identity.test.ts) | 2/2 | 0 | 0 | 1.194 |
| [p7-carousel.test.ts](../../../tests/p7-carousel.test.ts) | 16/16 | 0 | 0 | 2.906 |
| [p7-identity.test.ts](../../../tests/p7-identity.test.ts) | 2/2 | 0 | 0 | 1.041 |
| [p7-restore-compilation.test.ts](../../../tests/p7-restore-compilation.test.ts) | 4/4 | 0 | 0 | 0.198 |
| [r3r4-consumables.test.ts](../../../tests/r3r4-consumables.test.ts) | 15/15 | 0 | 0 | 25.967 |
| [r3r4-legacy.test.ts](../../../tests/r3r4-legacy.test.ts) | 2/2 | 0 | 0 | 0.010 |
| [r3r4-loot.test.ts](../../../tests/r3r4-loot.test.ts) | 6/6 | 0 | 0 | 1.619 |
| [restore-audit/bounds-preflight.test.ts](../../../tests/restore-audit/bounds-preflight.test.ts) | 49/49 | 33 | 0 | 19.014 |
| [restore-audit/g23-grant-evidence.test.ts](../../../tests/restore-audit/g23-grant-evidence.test.ts) | 60/60 | 45 | 0 | 6.553 |
| [restore-audit/g23-history-facts.test.ts](../../../tests/restore-audit/g23-history-facts.test.ts) | 13/13 | 0 | 0 | 0.272 |
| [restore-audit/g23-reward-allocation.test.ts](../../../tests/restore-audit/g23-reward-allocation.test.ts) | 11/11 | 0 | 0 | 0.088 |
| [restore-audit/tristana-history-growth.test.ts](../../../tests/restore-audit/tristana-history-growth.test.ts) | 2/2 | 0 | 0 | 2.228 |
| [t10-deferred-upgrades.test.ts](../../../tests/t10-deferred-upgrades.test.ts) | 10/10 | 0 | 0 | 0.280 |
| [t11-golden.test.ts](../../../tests/t11-golden.test.ts) | 2/2 | 0 | 0 | 0.007 |
| [t11-opening-xp.test.ts](../../../tests/t11-opening-xp.test.ts) | 2/2 | 0 | 0 | 7.136 |
| [t12-combat-equip.test.ts](../../../tests/t12-combat-equip.test.ts) | 48/48 | 0 | 0 | 14.806 |
| [t12-golden.test.ts](../../../tests/t12-golden.test.ts) | 6/6 | 0 | 0 | 0.046 |
| [t12-offline-transfer.test.ts](../../../tests/t12-offline-transfer.test.ts) | 1/1 | 0 | 0 | 21.230 |
| [t12-recovery-boundary.test.ts](../../../tests/t12-recovery-boundary.test.ts) | 5/5 | 0 | 0 | 0.101 |
| [t13-a-golden.test.ts](../../../tests/t13-a-golden.test.ts) | 6/6 | 0 | 0 | 0.057 |
| [t13-identity.test.ts](../../../tests/t13-identity.test.ts) | 3/3 | 0 | 0 | 0.462 |
| [t2-two-sided-battle.test.ts](../../../tests/t2-two-sided-battle.test.ts) | 21/21 | 0 | 0 | 1.274 |
| [t3-round-settlement.test.ts](../../../tests/t3-round-settlement.test.ts) | 10/10 | 0 | 0 | 2.221 |
| [unit-swap.test.ts](../../../tests/unit-swap.test.ts) | 15/15 | 0 | 0 | 0.768 |

文件测试秒数取 JSON 开始/结束时间；导入等额外成本计入上方进程总秒数。原始 JSON、日志压缩文件及每次命令、退出码、墙钟时间均在本目录。

## 补充回放入口复验

另检查了回放入口文件（16 文件重点复验），并单独运行最终摘要碰撞回归：

| 文件 | 通过/总数 |
| --- | ---: |
| [tests/g4-replay-snapshot.test.ts](../../../tests/g4-replay-snapshot.test.ts) | 4/4 |
| [tests/m6-replay.test.ts](../../../tests/m6-replay.test.ts) | 9/9 |
| [tests/m8-b10-temporary-replay.test.ts](../../../tests/m8-b10-temporary-replay.test.ts) | 3/3 |
| [tests/m8-b9-activity-log.test.ts](../../../tests/m8-b9-activity-log.test.ts) | 1/1 |
| [tests/recorded-fixture-intern.test.ts](../../../tests/recorded-fixture-intern.test.ts) | 1/1 |

## 自行决定

1. 共用记录器只观察实际命令和事件，不从存档的战果、经济事实或终态反造证明；缓存返回值携带自己的真实历史。
2. 同摘要、不同物品/receipt 的分支按完整内容区分；注册表按文件隔离，并能跨 resetModules 正确清理。
3. 长路线使用预录原始账本和相同完整输入的真实事件复用。生产端新增的仅是已认证深冻结、无访问器纯 JSON 的完整规范文本记忆；不记忆可变外部输入的键、不使用有损指纹、不增加合法标志。首次重演、历史衔接和结算检查均保留。浅冻结外部记录在成功读档后修改内部字段，下一次仍须拒绝的回归已通过。
4. PR161 的 tier4 特殊分支改为真实战斗推进；旧 tier14 手改到 1172 层，按用户决定保留为必须拒绝的覆盖，附真实原始历史。真实 tier4/10 在冷 Node 中仍须接受。B4 手改 HP=0 的终战同样对照真实完整战斗证明拒绝，并保留真实终战正例。
5. 恢复副本的逐 tick 比较直接使用生产命令，保留全字段严格比较；只为需要后续读档的分支记录历史。缓存中真实观察的私有副本不受调用者修改返回值影响。
6. Rumble 军械库采用真实实录夹具，原 20 秒用例仍完整校验历史，不借助文件先后顺序预热。蓝霸符前缀使用实录探测的 3-5/12 战、4-1/15 战，分别作可见计时校验。
7. 夹具去重索引仅保留紧凑摘要桶，命中后仍比较完整规范内容；强制摘要碰撞回归通过。TG 独有 seed 的夹具在原用例全部断言后释放，清理仍在原 5 秒内。全集使用 3 GiB old-space；不改测试时限，GC 与所有导入/验证均计入总墙钟。此前 2 GiB 因内存不足退出，不作为验收。
8. 旧版本 BattleRecord 先走原有版本路由，再读取当前规则的历史字段；旧档继续拒绝，没有删去历史校验。
9. B6 的 33 战前缀及双饮血剑实测 3-5 的 12 战使用共同计时校验；双饮血剑获取本身也在独立默认 5 秒用例中。护腕的两个比较分支后续不再读档，直接使用生产 stepMatch，保留逐 tick 全字段严格比较，避免重复记录不使用的终战历史。

## 未完成

- 最终源码的 87 文件全集验收：用户要求暂停后中断；最近完整轮及三处修复后重点复验分别保存，不拼接成全集通过。
- `tests/m8-b7-match-wiring.test.ts`：40 秒性能目标未达，当前通过，但完整冷重演仍占主要耗时。
- `tests/m8-b5-temporary.test.ts`：默认堆的 5 文件组合复验仍有两条 TG 超时；3 GiB 全集结果另列，默认堆下的耗时波动尚未完全消除。
- `scripts/record-p3p4p5-fixture-migration.cjs`：旧版本比较脚本仍有历史 raw 准备态读档调用，本轮尚未重新构造该旧规则迁移的对应实录；没有以当前规则历史冒充旧证据。
- `tests/chest-bracer-integration-trial.test.ts`：上一完整轮有 1 条超时；随后三文件 77/77 复验已通过，最终 87 文件合跑尚未跑完。
- `tests/m8-b4-r3b-lifecycle.test.ts`：上一完整轮有 1 条超时；随后三文件 77/77 复验已通过，最终 87 文件合跑尚未跑完。
- `tests/m8-b6-match-wiring.test.ts`：上一完整轮有 1 条超时；随后三文件 77/77 复验已通过，最终 87 文件合跑尚未跑完。

自动审批曾拒绝一个新增生产战斗结果复用和内部重演入口的方案，理由是可能削弱重演边界；该命令未执行。本次没有采用该方案，新增的仅是完整不可变规范文本的记忆和版本路由前置，所有首次重演与历史校验保留。
