# H1 本机诊断前置检查：受阻记录

2026-10-08，源基线 `97f38a0e787a4edcb35df4a59823bb1d106def67`（三次批准合并已完成）。用户要求先确认本地桌面 Chromium 和既有堆测量脚本能跑通，再开始诊断。当前该前置条件未满足。

## 实际结果

- `/usr/bin/chromium --version`：Chromium 154.0.8037.57，Debian 13。
- 使用项目已安装 Playwright 启动系统 Chromium，headless true，桌面 viewport 1440×1000，沿用既有脚本 `--no-sandbox --enable-unsafe-swiftshader` 参数。
- 第一次启动失败：crashpad目录错误，并在 `chrome/browser/process_singleton_posix.cc:297` 报 `socket() failed: Operation not permitted (1)`，进程 SIGABRT。
- 通过工具的权限审查重试，HOME/XDG_CONFIG_HOME/XDG_CACHE_HOME 指向可写临时目录；crashpad目录问题消失，但相同 socket 错误仍在，进程 SIGABRT。没有修改系统设置、浏览器二进制或代码来绕过权限。
- 未打开测试页面，未运行既有堆测量路线；没有重复测量、趋势/误报率/B4负载/保留链数据。不能凭此判断应用存在或不存在泄漏。

## CI 入口限制

现有 `.github/workflows/ci.yml` 的 `heap_diagnostics` 调用 `.github/workflows/m7-heap-diagnostic.yml`。后者的矩阵固定为：

- M6：`631c131f1f2fd387c873f0fd8b5a238bca79dbe0`
- M7：`111e9f8305ab4a7da8e67bd7f96a2318cabe5df0`

它运行历史 `verify-m5-browser.cjs --build=cannon --m6-f2` 并开启快照。因此直接触发不等于对当前合并基线/B4装备负载诊断；不能用旧结果冒充当前SHA，也不能偷偷改检出引用或CI配置。

## 下一步待用户决定

已报告建议：允许将本地前置改为 GitHub CI 前置验证，并新增独立诊断工作流（现有门禁/阈值/测量配置不改）。这超出当前“不改CI配置”的范围，尚未批准，尚未创建或触发。

另一个可选路径是用户指定可正常启动桌面 Chromium 的执行环境，再按原先前置要求执行。不得未经批准换环境。

此文件是失败检查点，不是诊断结论，不送审宣称H1签收。分支保留恢复断点，等待用户新指令。源码、门禁、测试预期和CI配置均未修改。

## 2026-10-08 12:57 UTC 用户明确批准后重试

用户批准同一命令在沙箱外执行后，以 `require_escalated` 再次请求运行，仍在相同位置报 socket EPERM 并 SIGABRT，未打开页面或运行堆脚本。申请模式不等于实际已解除运行限制，不宣称获得了成功的沙箱外浏览器能力。该授权不等于批准新增 CI 工作流，继续等待用户对替代诊断路线的决定。

## 2026-10-08 13:03 UTC socket/网络明确授权后的重试

用户明确授权本地socket和网络权限后，再次通过require_escalated请求运行相同检查，仍为socket EPERM/SIGABRT，未运行堆脚本。授权已明确，实际限制未解除；停止重复尝试，等待用户选择替代执行路线。没有修改安全设置、现有门禁或CI配置，也没有诊断数据。

## 2026-10-08 14:44 UTC：用户提供代跑数据，恢复离线分析

用户提供独立分支 `diag/h1-claude-runs` 的两次正常运行和一次快照运行，并明确授权基于快照继续保留链分析；因此上文等待替代路线的状态已结束。本机 Chromium 启动问题仍未解除，不再重复尝试。固定证据提交为 `e0bcc67a36b0bc3d4e5c7eff47ee07d338da4cce`，被测代码为 `97f38a0e787a4edcb35df4a59823bb1d106def67`，Chromium 141（CI 为153）。

数据只作诊断参考，不能当作CI验收结果。身份核验见 `docs/evidence/h1-retention/manifest-checks.json`；补测命令见 `docs/H1_FOLLOWUP_RUNS.md`。没有新增或修改CI工作流，没有修改现有门禁。
