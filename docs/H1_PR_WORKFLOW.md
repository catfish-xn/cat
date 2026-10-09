# H1 临时PR标签诊断工作流（永不合入）

2026-10-08 23:18 UTC用户改选临时PR方案，取代此前workflow_dispatch/default-main注册方案。PR #14已关闭、未合并，main没有变化。

## 触发范围

新增文件 `.github/workflows/h1-pr-diagnostic.yml` 仅监听 `pull_request: labeled`，base仅 `feat/m8-b0-baseline`。job再同时要求：

1. 仓库为 `catfish-xn/cat`。
2. PR头分支为 `diag/h1-heap-gate`。
3. PR头仓库等于当前仓库，排除fork。
4. 本次新加标签恰为 `h1-run-diagnostics`。

没有push、opened、synchronize、workflow_dispatch或pull_request_target入口。普通PR、普通push、新增其他标签均不会执行诊断job。向指定PR添加专用标签才启动一批；标签一直存在时追加提交不会自动重跑。下一批先确认上一批结束，移除再添加同一标签。失败保留，不用换标签重跑去覆盖失败记录。

[GitHub的pull_request事件文档](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)说明其工作流在PR合并引用上下文运行，并可用github.head_ref限制头分支；该方式无需把文件注册到默认分支。branches过滤的是目标分支，不能误用为head过滤。

## 固定采样配置

首批c136ab3固定为source97f38a0e787a4edcb35df4a59823bb1d106def67、preview、normal、3次；第二批extended1（定义8becae8）已完成；第三批B4模块组（定义0399167）已完成720战；第四批定义2e4e537为preview/extended-snapshot/1次/6窗口，独立扰动快照组。后续配置改回同source、preview、normal、3次；须等前批结束再贴标签，连续三批各3次，正常样本总数计划12。完整有界预算见H1_CI153_SAMPLE_PLAN.md。变更目标或组别时只在此临时YAML中追加提交，接受review后再贴标签；每批请求、workflow merge SHA、PR head定义SHA与实际source SHA分别入artifact。

可用组别与原脚本一致：normal=2次预热/30周期无快照；snapshot=同参数带快照扰动组；warmup-trend=已有12预热/3×30周期对照组。mode支持preview/dev，样本数1–5。组别不能混算。新增extended/extended-snapshot组提供原2预热连续多窗独立副本，详见H1_EXTENDED_WINDOWS.md；B4模块负载已实现并做Node校准，见H1_B4_MODULE_LOAD.md，已在CI153完成720战，原数据见docs/evidence/h1-ci153-b4/；不替代完整应用负载。

## 保持不变的边界

- permissions仅contents:read，checkout不保留凭据，不读取secrets、不改分支保护/必过检查。
- 现有ci.yml及其他已存在工作流、原始测量脚本、GC、门禁阈值、合同、运行代码和测试预期均不改。
- 源码检出在source/，输出在外部h1-evidence/，不污染被测manifest。
- npm ci使用目标lockfile；检查Chromium及headless-shell注册版本均153.0.8010.12，实际启动再验证版本。不兼容目标直接失败，不升级依赖。
- preflight/probe均清除CHROMIUM_PATH，使用与现有CI一致的默认headless选择；DEBUG仅在preflight记录实际启动路径，不加入测量。
- 原始日志、退出码、manifest、trace和快照全量作为artifact；失败保持非零。每样本40分钟超时，124/137后停止本批；不自动替换失败样本。
- 安装、build、preflight也有超时；artifact上传if:always()，30天保留。runner硬故障仍需检查实际上传状态，不能保证崩溃时已保存所有字节。

## CI与审计状态

该临时PR创建时，仓库原有普通CI仍会依原配置运行；这不等于诊断job已运行。标签触发后另有独立诊断运行ID。普通CI按最终PR头SHA核对；实验失败与验收失败分开记录，不靠改门禁变绿。

本地已完成YAML/触发/只读权限/输入校验/Bash语法检查；真实CI153启动必须以诊断job记录为准。独立Pro对话最终审查完整H1报告，不由开发者自签。

## 收尾约定

诊断工作流**不合入main、基线或任何其他目标分支**；临时PR最终关闭而非合并。脚本和报告如以后需要合入，另走不含该YAML的独立提交/PR并单独请用户批准。保留诊断分支、固定证据及GitHub运行链接作为调查记录；关闭PR不删除失败证据。
