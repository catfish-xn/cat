# PR #94 合并树验证（2026-10-15）

内容起点 `d804ea24be28acacf973da60d574f9c06c2b007d`；合入 `multiplayer@9a9adb2985713d09f0ef13434863f8b429521524` 后的规则与测试提交为 `792a6ca2cb84bfc02504a301365181acf86354e2`。验证期间集成分支又合入 #105；随后合入 `multiplayer@4d4cc73c63c1e9b99c3b52f29fc9902f37fc6a64`，得到 `942d7ddce10b84edbf7dd8ec47a537f66849cf52`。后续证据提交仅改文档。

运行环境：Linux，cgroup 配额 4 CPU / 16 GiB，Node 24.19.0、npm 11.9.0、Vitest 5.0.3；已执行 npm ci。测试进程按批次串行启动，不把定向重跑拼成全套成功结果。

**结论：未达到可合入门禁，保留 Draft；BACKLOG 1 条。** 最新原生 timing 32/32 通过，完整 fast 尚未零失败，942d7dd 没有新的完整 fast 成绩。

## 合并与修复

- 四处初始冲突取语义并集：combat-s13 同时保留 combat-static / combat-g2；B8 fast/timing 保持 registerB8 壳，G2 指纹迁入 helper/fixtures；M6 保持上游拆分，G2 的既有 envelope 比较迁入 helper；t12 保留两边场景与真实单位选择。没有恢复旧 B8 整文件。
- 修正自动合并后留在 beforeAll 的旧商店种子/单位编号：B5 instances、B8 capacity / loot-view；已有公共准备路线在 B4 catalog、B5 grant-upgrade、B10 item-save-replay 的 beforeAll 预热，断言与超时预算不变。
- 回放最终 slice 原来重复序列化整场动画事件并冻结整场帧树，独立复核也超过 50 ms。改为逐 tick 比较同一有序动画白名单、逐帧冻结，仍在终帧报告 divergence。新增“早期差异与尾部多余事件均延迟到终帧拒绝”测试；指纹、终态、事件、RNG 和录制字节保持不变。
- #105 的 B8 中位数测量、suite sequencing、timing isolation 均来自已合入的上游提交，未在本 PR 自行降低阈值或改变该测量方法。保留本 PR 的新增 fast 反例测试。没有增预算、skip 或删用例。
- 本轮手工修改限定在 simulation/tests/docs。其他目录差异来自合入集成分支；d804ea2 已有的 hero-identity / 图标索引授权见 VALIDATION.md，不能宣称整个 PR 从未包含 presentation 文件。

## 验证记录

| 提交 | 命令 | 结果 |
| --- | --- | --- |
| 792a6ca | `npm test -- --pool=forks --maxWorkers=1 --isolate --reporter=verbose` | 221 文件：220 通过 / 1 失败；2725 用例：2724 通过 / 1 失败；2008.18 s |
| 792a6ca | `npm run test:timing -- --isolate --reporter=verbose` | 6 文件 / 21 用例全部通过；205.99 s |
| 792a6ca | `npm test -- tests/m8-b10-encounter-outcomes.test.ts --pool=forks --maxWorkers=1 --isolate --reporter=verbose` | 1 文件 / 46 用例通过；36.33 s；不替代全套门禁 |
| 942d7dd | `npm run test:timing`（允许本地监听） | 6 文件 / 32 用例全部通过；264.04 s |
| 942d7dd | `npm run typecheck` | 通过 |
| 942d7dd | `npm test -- tests/b8-resumable-battle.test.ts --maxWorkers=1 --reporter=verbose` | 1 文件 / 15 用例通过；25.45 s |

942d7dd 首次原生 timing 在默认沙箱中 21/32 通过、11 条网络用例因 `listen EPERM: operation not permitted 127.0.0.1` 失败（247.47 s）；允许本地监听后完整重跑得到表中的 32/32。#105 将 B8 的 1 条计时用例拆成 12 条，因此 timing 总数从 21 变成 32。

792a6ca 全套唯一失败是 B10 `3-7: full 1200-tick timeout draw grants no unearned loot`，执行 5199 ms 超过原有 5000 ms；同一用例先前完整运行为 575 ms、另一次运行为 765 ms。不能用已知 B8 startup 噪声豁免它。

此前完整 fast（修复公共路线冷准备前）为 219/221 文件、2722/2724 用例通过，1153.19 s，失败为 B4 bloodthirster / B10 ionic 冷准备超时；修复后这两例已在后续完整运行通过。另有两个长时间 fast 尝试在出现超时后中止，未记作全套结果。原非隔离 timing 曾 20/21 通过（216.97 s），B8 replay longest 293.90 ms，startup 8.31 ms；这是 longest 失败，不冒充已知 startup 单次噪声。

## 身份与字节证据

本轮没有重录夹具；保留 release-audit、reconciliation、route-prefix / public-fixture-migration 的既有字节证据。`node scripts/record-g2-1-release.cjs --check` 在最终 simulation 源码上通过：cannon / sniper 各 67 状态，四路线命令数 197 / 191 / 196 / 197，均 33 轮。相对 d804ea2：

- rulesVersion：`s13-g2-1-v1`，未改。
- content digest：`fnv1a32-utf16:70a355f3`，未改。
- loot replay digest：`fnv1a32-utf16:65a85ecd`，未改。

`npm run test:server-entry` 通过：134 输入；所有 start/tick 状态、事件批、RNG 使用 UTF-8 Buffer.equals；恢复续跑 deepStrictEqual；CLI 与浏览器目标 bundle 一致。#105 没有改变 simulation/server 源码。

`python3 scripts/import-m8-source.py --g2-1 --check`、`python3 scripts/generate-g2-content.py --check`、`node scripts/generate-g2-audit.cjs --check` 全通过。81 张新增资产字节数/SHA256 与清单一致。

`npm run build:game` 与 `CHROMIUM=/usr/bin/chromium node tests/server/e2e/c7-playtest.mjs` 通过：errors 为空，Nocturne / Zeri 已购买并上场，换位和组件合成通过。斯维因按 dispatch 留 G2-2；金铲铲/转职仍不在本次范围。

日志摘要和 SHA256 见 merge-validation-logs.json；完整本机日志位于 `/tmp/g2-validation/`。剩余门禁见 [BACKLOG.md](BACKLOG.md)。
