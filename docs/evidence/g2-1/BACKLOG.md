# G2-1 未解决门禁

未关闭条目：**1**。本文件记录阻塞，不豁免“合并树完整 fast / timing 零失败”。PR 仍应保持 Draft。

## G2-1-VALIDATION-01：完整 fast 的短时限超时尚未清零

**问题：** `792a6ca2cb84bfc02504a301365181acf86354e2` 的完整 fast：221 文件中 220 通过、1 失败；2725 用例中 2724 通过、1 失败；2008.18 s。唯一失败为 `tests/m8-b10-encounter-outcomes.test.ts` 的 `3-7: full 1200-tick timeout draw grants no unearned loot`，5199 ms 超过既有 5000 ms。该文件单独 46/46 通过，36.33 s，但不能拼接成全套通过。更早尝试也出现不同文件的超时；尚无证据证明只由宿主调度、GC 或实现某一项造成，不宣称已经解决。

**复现命令：**

```sh
npm ci
npm test -- --pool=forks --maxWorkers=1 --isolate --reporter=verbose
# 定向诊断，不替代全套
npm test -- tests/m8-b10-encounter-outcomes.test.ts --pool=forks --maxWorkers=1 --isolate --reporter=verbose
```

环境为 4 CPU / 16 GiB 配额、Node 24.19.0、npm 11.9.0。原始日志和摘要见 MERGE_VALIDATION.md / merge-validation-logs.json。此处不是用户允许单独重跑豁免的 B8 startup 噪声。

**建议归属：** G4 测试性能/执行环境负责人排查全套运行下的 worker 状态、冷准备和宿主 CPU 调度，必要时由规则负责人优化确证热点。本轮已修复可定位的公共路线冷准备和回放末帧整场工作；不增加 timeout，不跳过用例，不改比较断言。不要把偶然单跑成功写成零失败。

**关闭条件：** 在最新合并树上从头完整运行 fast 和 timing 并同时零失败，记录准确命令、完整计数、耗时与 head，再转 Ready。验收期间新增的 #105 已合入 `942d7dd`，它只改 timing/helper/config/docs，不改 simulation；此前完整 fast 结果仍按实际测试提交 `792a6ca` 记录，不能冒充最新树完整验收。
