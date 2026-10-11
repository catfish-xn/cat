# 普通 Node 引擎可移植性证据

2026-10-11，对固定 `c000cacae12b55f7e2fb2c2e8ee57e105314858a` 的生产源码执行一次有界探针。原始身份保留：只有新增探针脚本尚未提交，`trackedSourceDiff`为空；未使用暂停的共享实验源码。

Node22.23.3运行 `node scripts/verify-server-engine-portability.cjs`。脚本以项目锁定依赖中的esbuild打包Node ESM，然后启动普通Node子进程；没有Vite/浏览器/DOM/IndexedDB、监听端口或对局服务。108项构建输入完整列在report中。临时bundle与esbuild元数据保留在 `artifacts/server-authority-audit/`。

- `report.json`：原始结果/源码身份/构建闭包。
- `first-run.txt`：首次执行完整输出，通过；无重试或失败被覆盖。
- `SHA256.json`：探针源码及上述原始记录的SHA256。

仅验证一场公开战斗与保存/回放可在普通Node执行，不代表多人规则、服务器发布包、容量、5/10ms预算或浏览器体验已通过。
