# 节点三 CPU 性能证据

这些报告保留真实失败；预算仍为 p95≤5 ms、p99≤10 ms，原 `pressure-9v9.cjs` 不变，18 个三星单位、54 件成装、两种 variant 各 seed0 预热与 seed1..30 全战斗。

- `isolated-baseline.json`：固定 f58c9fe 的专项基线。
- `isolated-projection.json`：2274651，仅一次触发投影。
- `isolated-retained.json`：4aedd3b，再复用原生克隆；生产源码与 cf76af0 完全相同。
- `isolated-withdrawn.json`：307a448 的无原型临时输入试验，distinct 回退、mirror 改善，未保留实现。
- `profile-baseline.json`、`profile-retained.json`：60 场 CPU profile 汇总；含 Profiler 开销，不是预算签收样本。原始 V8 profile 在 artifacts，脚本 `m8-node3-pressure.cjs` 可复现。
- `equivalence.json`：干净 cf76af0 与固定 f58 的60战7399 tick、201246条事件完整逐步对照；冻结历史输入，无丢事件；另验 JSON 运输续算。这里不是合成 Match 的 restoreMatch 合法性声明。
- `copy-inventory.json`：seed1/tick0与40的克隆数据 JSON 字节代理，只用于定位字段，不能当 native clone 字节或耗时。
- `first-start-failure.txt`：首个 Git 子进程 EPERM，发生于采样前；该残留进程已关闭。不掩盖原性能失败。
- `copy-boundary-tests.txt`：11 项专项，保留 native clone 的函数拒绝/Date/稀疏数组行为及新增别名/键边界。

专项工具保留与原脚本相同的 stepCombat 计时边界、负载和分位方法，但未先跑30条公开路线且计时外诊断工作不同。因此专项前后互比，原完整领域脚本结果另外归档，不将旧40–46ms与专项数字直接相除。

固定功能候选包仍为 d901 运行代码、b4 BR4补验、f58最终文档/CI绑定；本轮优化不包含在旧预览包中。规则、版本、内容digest和全部门槛不变；阶段三尚未通过，PR30/31保持Draft。

`formal-before-*` / `formal-after-*` 为未修改原脚本的全部领域采样；formal=false仅因不含browser，不冒充GPU验收。两侧原始身份字段（包括基线依赖符号链接未跟踪项）保留。`formal-environment.json`补充cgroup与依赖解释，`ci233-summary.json`固定同代码SHA完整CI。
