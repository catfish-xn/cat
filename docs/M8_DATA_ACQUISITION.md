# M8 原始档案获取（专用分支）

仅获取原始文件，不执行 B1 数据冻结、不导入运行目录、不修改游戏规则。按用户 2026-10-07 的后续指令，使用专用 push 分支，替代最初的 workflow_dispatch 方案。

## 分支与触发

- `feat/m8-b0-baseline`：从 main `5aff440c702e7c8c665f05f0b419a9edbf9ea00f` 创建，仅保存 B0 基线文档（含未测限制）。
- `data/cdragon-14.24`：从该 B0 文档提交创建，只在此分支 push 且本工作流、获取脚本、其离线测试或本文档有变化时运行。
- 工作流 `.github/workflows/cdragon-14.24.yml`，名称 **Archive CommunityDragon 14.24**。首次推送自动运行，无需先合并到 main 注册 dispatch。
- 不设置 workflow_dispatch、pull_request、schedule；不修改现有 CI 或 Pages。当前普通 CI push 仅匹配 main，Pages 也仅在 main 工作；本任务不建立 PR，因此不会诱发普通 PR CI。
- 下载成功后的提交仅包含两份 gzip 与获取 manifest；这些路径不在触发 paths 内。另外 GITHUB_TOKEN 产生的 push 不会递归触发普通 push workflow。作业还拒绝 github-actions[bot]。
- 后续有意重新获取可修改本分支此文档（记录原因）后 push；或在 Actions 对原运行选择 Re-run jobs。若数据分支 HEAD 已变化，旧运行会因并发保护拒绝，需新 push，而非强推覆盖。

## 原始来源与输出

固定两个源，绝不回退到镜像、其他补丁或其他语言：

- https://raw.communitydragon.org/14.24/cdragon/tft/en_us.json
- https://raw.communitydragon.org/14.24/cdragon/tft/zh_cn.json

按计划 §2.3：

- `src/simulation/content/source/s13-14.24b/raw/en_us.json.gz`
- `src/simulation/content/source/s13-14.24b/raw/zh_cn.json.gz`
- `src/simulation/content/source/s13-14.24b/provenance/download-manifest.json`

每项记固定 URL、语言、下载完成 UTC 时间、原始字节数及 SHA-256、压缩后的字节数及 SHA-256。gzip level9、mtime0、无原文件名，解压结果是取得的完整上游字节，不重新序列化 JSON。压缩为了不把重复且较大的多语言文本裸放入 Git；这些 raw 文件不被游戏入口引用。

两份都收到 HTTP200、UTF-8 JSON object 校验通过后才写输出；网络请求每份总期限120秒、上限256MiB，不跟随重定向。失败不生成部分提交，不换源、不从记忆补值。这里只证明获取，不能证明全部历史数值、14.24b热修覆盖、标准模式选择器、44装备或掉率已经核实。

## 体积上限与 artifact

若任一 gzip 超过20MiB，或两份合计超过40MiB，两份都改为 artifact-only，以避免大文件进入Git历史。artifact 中保留上述完整相对目录及同份manifest；repo只提交 manifest（移除该工具之前留下的两个 gzip，旧提交仍保留）。

artifact 名称 `cdragon-14.24-<run_id>-<attempt>`，保留30天。manifest记录名称、run URL、原始/压缩hash、原因阈值；这是有时效的传输产物，B1前需下载并形成持久可离线核验的选取记录，不能当永久归档。上传成功后才允许提交manifest；上传失败则作业失败且不提交。Actions运行详情底部Artifacts下载，解压后按manifest核对原始字节与hash。

## 提交安全与权限

作业仅在 `catfish-xn/cat` 的 `refs/heads/data/cdragon-14.24`运行；显式拒绝 main 和默认分支。仅作业有 `contents: write`，使用GitHub临时GITHUB_TOKEN，不配置PAT/新持久凭证。

checkout固定触发SHA；下载前和提交前两次核对远端数据分支仍等于触发SHA。只暂存允许的3条输出路径。普通fast-forward push，拒绝并发改写，不force、不merge、不创建PR或部署。仓库策略若拒绝bot push会明确失败，保留日志，不能擅自改权限。

## 本地验证与范围

`python3 -m unittest discover -s tests -p test_fetch_cdragon.py -v` 为纯离线fixture测试，不访问网络，不拿fixture当真实历史档案。

覆盖两文件完整性、失败不部分写入、哈希/压缩往返、HTTP错误/重定向/超时/大小上限、artifact阈值和工作流输出。普通 npm test 不会自动收集 Python 测试；只有独立下载工作流运行它。

成功判据是 Actions 结论 success、远端数据分支确有 bot 数据提交及manifest匹配两份文件。推送工作流本身不等于数据已取得。失败须区分网络、JSON、上传、并发或推送权限，并给实际运行链接。
