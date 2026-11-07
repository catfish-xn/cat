# cursor/anomaly-rules

基于 `claude/v26-anomaly-r1r3r4` 的 `d07724e6`。不开 PR。修选秀快照恢复接受伪造异变资格/绑定。

## 改动

| 位置 | 内容 |
| --- | --- |
| `src/simulation/carousel.ts:10` | `restoreCarouselSeat` 改用已导出的 `validateAugmentAuthority`。 |
| `src/simulation/carousel.ts:583-589` | 历史装备折叠从候选收据重建 `definitionId`，不能单独认证异变。从目录 4-6 起（含删掉报价历史）要求独立服务器 authority；无强化历史的多人席只要还有资格、绑定、选择收据、`anomaly-selected` 或报价历史，同样要求该句柄，把 `round` 改到 4-6 之前也不能跳过。缺句柄：`Invalid augment history: missing independent server authority`。句柄与候选不一致：`server facts/state mismatch`。对象与 JSON 同一条路径。 |
| `tests/server/v26-anomaly-carousel-tamper.test.ts:1-101` | 真实复现：seed=24、与 `carousel-room` 相同的 s0 脚本和 s1–s3 接管，停在 5-4 选秀。s2/s3/s7 无 `augmentHistory`。原快照带 `room.augmentHistoryAuthority` 时，选秀入口和共享池入口的对象/JSON 都逐字恢复；不带 authority 拒绝。同步改写 selection、binding、选择收据定义，以及再改最后一条报价，对象/JSON 都不带 authority 时拒绝，带原 authority 时因状态不一致拒绝。 |
| `docs/V26_ANOMALY_R1_R3_R4A.md:40` | 两个联机恢复入口从 4-6 起都要独立 authority；写明选秀入口的额外条件和错误文本。 |
| `docs/V26_ANOMALY_R1_R3_R4A.md:62` | 返修表增加本条，标明不是身份漂移。 |
| `docs/V26_ANOMALY_R1_R3_R4A.md:91` | `augment-history` 两项目前哈希，仍标纯身份/纪元漂移，未改期望。 |
| `docs/V26_ANOMALY_R1_R3_R4A.md:116-120` | 本轮相关测试与体积结果。 |
| `docs/MATCH_CONTRACT.md:1771` | 同一认证边界写入 Match 合同。 |
| `docs/V26_ANOMALY_R5.md:35` | 联机/轮盘快照行补上 authority 与自洽伪造拒绝。 |

没有新增懒加载 chunk，没有改 `vite.config.ts`、`src/server/`、界面或素材。2D 顶层 `dist/assets/*.js` gzip-9 仍为 632,031 字节（上限 637,144）。

## 测试

命令均带 `--maxWorkers=4 --project fast`。未提高超时，未关闭校验，未 `--write`。

- `tests/server/v26-anomaly-carousel-tamper.test.ts`：4 项通过。修复前同一伪造的对象/JSON 能恢复成功。
- 相关 26 文件一起跑：25 个文件通过，504 项通过，2 项跳过。唯一失败是 `tests/augment-history.test.ts` 的 2 项，见下。
- `npx tsc --noEmit` 通过。
- `tests/rendering3d-isolation.test.ts` 通过；2D gzip-9=632,031，solo gzip-9=90,299。
- `git diff --check` 通过。

`tests/augment-history.test.ts` 的 2 项失败是**纯身份/纪元漂移**，不是本轮规则失败，断言未改、未重录：

- 四份无持有者存档归一化后不是 `ee2b019c` 基线。当前 SHA-256：`8a8c5f2364d6416b534c6bb8c8366395949b1ac5303ff71f423f495a97f93458`、`93f40351ea61d52ba09af52d4c863b364b93347c0793398ebb3ab317414b7887`、`085db6059af75e002a88cbb7e84a9f2547a70d416745e612716f3b813f6813e2`、`e7bab395e56d5c65d9cf5f2d5bcee245f9006102586fb9ba48b2d1bacdad9a97`。
- 战斗账本与终局存档归一化 SHA 为 `ab08e5d65988da8e59e9cfe73e25d5192441b5a01985950fbdb8cf0167b39657`，基线仍为 `99174cbf08013d1ee651990be6036b6ab0ddba8a6a4f1cd5660acd35decee431`。

## 未完成

- 漂移清单里除 `augment-history` 外的文件本轮没有重跑，不能把它们写成已通过。
- 没有做浏览器/GPU 实机，也没有部署测试服。
- 没有重录纪元、内容摘要、recorded fixtures 或 opening-random-identity。

## 执行端待办

- 纪元统一重录（含上表其余纯身份/纪元漂移；不要用 `--write` 覆盖已发布 v25 证据）。
- 素材下载、提取、上传测试服（ssh tencent）。
- 测试服部署。
- 浏览器/GPU 实机验收（codex-browser）。前端锁盘与隐藏调阵不在本轮。
