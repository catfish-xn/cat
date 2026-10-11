# 固定运行代码 d901b3f 的证据

所有本地正式运行开始时工作区干净。`formal-run.json` 记录串行命令、Node、cgroup和M7/M8构建哈希；`m7-budget.json` 是M7配对；`desktop.json`、`u3-static.json`、`u4-status.json` 是功能检查；`pressure*.json` 保留全部压力结果和诊断。`SHA256.json` 仅列JSON报告哈希。

压力报告 **allBudgetsPass=false**：9v9 CPU超预算，软件图形帧率不能签收硬件桌面。`pressure-profile.cjs` 是当时使用的有界诊断原脚本（本机root路径，非运行产品），CPU profile原始文件位于完整证据包。

`ci231-*.json` 是同代码SHA的GitHub CI结果/原始比较artifact；可选诊断job未启用的skipped不等于测试skip。BR4后补脚本的干净验证在相邻 `results-b4ca11c/`，其binding证明生产src和tests树相同；没有把本目录重贴为新SHA。

完整截图、日志、存档与CPU profile位于本地 `artifacts/m8-b10-evidence-d901b3f.zip`；可试玩包为 `artifacts/m8-preview-d901b3f.zip`，包含运行包和两份公开操作存档。所有首失败说明及合并限制见 `docs/M8_VALIDATION.md`。
