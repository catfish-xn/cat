# 节点三性能收尾

基线固定为 `f58c9fe1e55de9ca6b5c8be618d49aa02d789f45`，独立分支 `perf/m8-node3-tick`。冻结 p95 ≤ 5 ms、p99 ≤ 10 ms，原 9v9 负载不减。PR #30 Draft，main 不合并、不部署。独立功能审查已先行完成，见 [独立结论](M8_NODE3_FUNCTIONAL_REVIEW.md)；性能变更需另审。

## 口径

原 `d901b3f33a9e210e69281ce141bcbbfdd4cdbb5f` 测量的 distinct / mirror p95 分别 40.772341 / 46.131405 ms，p99 分别 111.610722 / 135.5672 ms。这是 `scripts/verify-m8-performance.cjs` 的独立 Node 子进程纯领域 `stepCombat(state)`，通过 Vite SSR 加载 TypeScript 源码。`--target=preview` 只指定另一浏览器部分的 dist，**领域数字不是生产浏览器包耗时，也不含渲染**。

环境：Node 22.23.3，Vite 7.3.6，Linux 容器 CPU 配额 4 核、内存上限 16 GiB。`hrtime.bigint()` 紧贴 stepCombat 前后，转为毫秒；包括计算、内部复制、验证、事件生成和期间 GC，不含夹具编译、导入、磁盘、历史捕获、哈希或渲染。原循环在计时外统计事件与活跃条目。两种 fixture 均 18 个三星单位、每人 3 件成装（54 件），每侧 9 个不同英雄；distinct 两侧共 18 种，mirror 为 A 阵容镜像。装备合法性由生产策略校验，SPEC 不变。

每种 variant 单独 seed 0 完整战斗预热，然后 GC；seed 1..30 完整战斗连续采样，战斗之间不强制 GC，结束 tick 也计入。所有 tick 合并取 nearest-rank p95/p99，不截尾、不剔除最坏值。硬件 GPU 复测是独立的浏览器帧间隔验收，不能替代或解释这里的 CPU 失败。

新增 `scripts/m8-node3-pressure.cjs` 只用于固定 9v9 诊断及配对比较，保持上述负载、计时边界与分位方法；不冒充包含 30 公开路线的原完整报告。剖析器开销单列，剖析结果不用于预算签收。原完整脚本与预算不改。

## 既有恢复优化

`2837b87ec6068258396db9b28bd405c28a950592` 已作为 `510dc93b7714c7e5af722bb14fb6eb93ea26920f` 纳入基线。它优化 restoreMatch 的 JSON 文本可表示性检查，而 9v9 计时区不调用 restoreMatch/canonicalContent；本轮不重复并入，也不把它视为 9v9 修复。

## 交付包提交对应

| 对象 | 对应 SHA / 覆盖 |
| --- | --- |
| `m8-preview-d901b3f.zip` 的 site | d901b3f 生产构建；运行源码与最终 f58c9fe 完全一致 |
| `m8-b10-evidence-d901b3f.zip` 的正式性能、桌面、U3/U4 | d901b3f 原始运行报告，保持原标签 |
| 两包中的 BR4 样本/证据 | b4ca11c7bac9f63c82416ded5bde0e013b11263f 公开路径补验 |
| 两包中的 delivery.json、最终审查文档和 CI #232 | f58c9fe 最终文档提交与同 SHA CI，不能反称旧测量在 f58 重跑 |

三者 src tree 均 `49fb300c5ca6f014201f289a87f8d5a54649c551`，tests tree 均 `3509408ef4fee47d6ca76deaeb9cc146fe8ab7fa`。已重新校验 ZIP CRC 及 SHA256：预览 `041c5422a34949f13961038428b589a66ec47c604bd070f882b3dff0fc419727`；证据 `05fbf846bedd870146b900dd2cd25efd1aeccad0562dceab3cef82571c4df93e`。本轮性能分支不在旧包覆盖内，不覆盖旧包。

## 首失败保留

剖析脚本首次启动在读取 Git SHA 时被沙箱子进程限制拒绝（spawnSync git EPERM），尚未进入预热或采样。日志保留，关闭该进程后在允许本地 Vite/子进程的同一环境重启；不算性能失败样本，不隐藏原 9v9 预算失败。
