# T13-B 窗口 1 收口证据

基线 `codex/t13-loot@b198f82`（已含 #82），派单按 `multiplayer@e82afa5:docs/DISPATCH_2026-10-14.md` 第四批窗口 1。实施仅涉及 `src/simulation/`、`tests/`、`docs/`。

## 性能与拒绝语义

布局恢复缓存只接受确定性构造器生成的深冻结对象。掉落比较缓存以账本和布局两者的对象身份为键，仅在完整比较通过且两者已递归冻结后登记；seed/轮次/绑定/席位版本与实际资产守恒仍逐笔校验。可变克隆不登记，替换为浅冻结或深冻结伪造账本都重新比较。使用弱引用，随对局状态回收，不按 seed 建进程永久缓存。

`shared-pool-cache.test.ts` 对一场真实 PvE 的每步结果进行冷热路径比较：冷路径每步 JSON 往返，热路径保留规则对象；全部 state、RNG、池资产、Match/pool 事件及奖励收据逐步相等，并确实发放英雄奖励。另覆盖暖缓存后替换账本、嵌套 payload 篡改、可变账本二次篡改、布局篡改、换 seed；席位篡改仍报 `invalid-seat-state`，命令失败返回原 pool/state。

SR-B8-03 的重复布局/掉落重放与 C18-05 同路径，本次一并消除。每 tick 的资产代数检查保留；无“未终局跳检查”。来源账本 append 复用已递归冻结的历史事实，新增事实与可变输入继续复制冻结，避免反复克隆旧事实；战斗引擎的逐 tick clone 尚未改动。

Blue Buff 是单人公共获取路线，未调用共享池；seed 42 四泪路线模拟到后期导致超时。seed 17 的开局随机掉落提供真实 tear，后续三次补给取得其余 tear；四剑向量用 seed 4 的开局 sword。保留全部命令、来源、两件成装唯一性、失败原子性和恢复断言，无资产注入或预算修改。

## Golden 与临时装备路线

失败定位在脚本哈希，而非 T12/T13 golden 或内容身份：

| 文件 | SHA-256 |
| --- | --- |
| T12 golden（原件） | `9acaea36280a4d7405b59bcfab38e438624ab6667e4771fdd63e3093ba26acf3` |
| T13 golden（原件） | `b45aa9b5a046fffd7a5022a539982ffe4db50c59150e5f6483d07c2a37810e86` |
| 独立 oracle | `0b11a6cc60f3d31e59553d5121acb8a1fdc22ce3c6091ae3065ff0f8c35ad6ca` |
| 录制时 driver（`bbe2258^`） | `1634ff31886d06e4e739c2f9101a1dcc4c39fb0a5db2176cd89037ac051118c2` |
| 当前 driver（`bbe2258` 起） | `0d4ab46fbbf109ee5538764f582e60d395c45f36fc8803ecfe596ea260b7f4f4` |

复核命令：`git show bbe2258 -- scripts/generate-m5-route.cjs` 和 `git show bbe2258^:scripts/generate-m5-route.cjs | sha256sum`。该提交加入可配置供测试使用的购买/装备/选择参数和 TG 配方，改变脚本字节；`7b40846` 未改该脚本、golden 或 digest。录制时脚本按原字节归档为 `golden-driver.cjs`；audit 分别登记录制和当前脚本，测试分别核对，原有 golden/oracle 校验继续执行。本次没有重录 golden，也没有宣称重跑 M5 整局。

临时装备回放改用已有 `transferPreparation()` 的 seed 4 真实公共路线：两张付费 Ezreal `unit-22`/`unit-25`、`item-9` TG、4-7 奖励升级与迁移；保留 live 每 tick 记录、1×/2×/4×、seek、终态等价和伪造临时子装备拒绝断言。

## 验收

环境 Node `v24.21.0`（当前执行环境默认版本）。未运行全套、M5/M6 或 e2e，未改任何时间预算。

`npm run typecheck` 通过。派单目标集加已有 `tests/tp-shared-pool.test.ts`：**9 文件、133 用例通过，0 失败、0 跳过**。派单原有 `tests/shared-pool*.test.ts` 在基线不存在；本次新缓存回归符合此 glob，并同时运行现有 TP 守恒测试。

| 原失败用例 | 本次目标集耗时 | 原预算 |
| --- | ---: | ---: |
| room 选择窗口 | 2.801 s | 5 s |
| room 空闲整局 | 26.907 s | 60 s |
| round-commit 淘汰至唯一排名 | 22.983 s | 30 s |
| bot-driver 八机器人整局 | 57.639 s | 60 s |
| B5 Blue Buff 唯一性 | 3.646 s | 5 s |

逐用例结果见 `window1-target-results.json`。`npx vitest run tests/server`：**25 文件、168 用例通过，0 失败、0 跳过**，逐用例结果见 `window1-server-results.json`。其中 room 选择窗口 2.103 s / 5 s、round-commit 淘汰至唯一排名 20.124 s / 30 s、bot-driver 八机器人整局 50.856 s / 60 s。

最终 `CONTENT_DIGEST=fnv1a32-utf16:bd9c3a8e`、`LOOT_REPLAY_DIGEST=fnv1a32-utf16:5cd0487c`；格式 3，旧档保全导出、新开局，不迁移续玩。
