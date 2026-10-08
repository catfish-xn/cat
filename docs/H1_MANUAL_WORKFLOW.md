# H1 独立手动诊断工作流

2026-10-08 22:48 UTC用户批准：仅 `workflow_dispatch` 手动触发，指定提交默认 `97f38a0e787a4edcb35df4a59823bb1d106def67`，CI Chromium153，原始结果作为artifact，不改现有CI、必过检查、门禁或阈值。

## 文件与参数

唯一工作流文件：`.github/workflows/h1-manual-diagnostic.yml`。无push、pull_request、schedule或workflow_call入口；权限仅contents:read；checkout不保留凭据；输入SHA限完整40位小写十六进制并再次核对实际HEAD。

- `source_sha`：被测源码提交，默认97f38a0。工作流本身版本由GITHUB_SHA另记，不与被测SHA混淆。
- `mode`：preview或dev，分组，不混算。
- `probe`：normal（原2次预热、30周期、无快照）、snapshot（原参数带快照，扰动组）、warmup-trend（原脚本已有12次预热、3×30周期实验，对照组）。
- `samples`：1–5次顺序运行，默认3；无自动重跑替换失败样本。

本版先提供原脚本测量和已有诊断开关，**尚不包含原2次预热连续多窗及B4重触发专项负载**，不冒充完整H1诊断。

## 浏览器与源码一致性

使用目标提交lockfile的npm ci及项目Playwright安装命令；校验其Chromium和chromium-headless-shell注册版本均为153.0.8010.12，其他版本直接失败，不升级目标依赖。

预检查与探针均使用Playwright默认headless Chromium，清除CHROMIUM_PATH，与现有ci.yml一致。预检查通过实际启动核对browser.version；仅预检查开启DEBUG=pw:browser日志保存实际可执行路径，不向测量组增加此调试变量。正常探针参数、GC、预热、阈值不变。对不满足浏览器版本约束的其他目标SHA明确失败，不偷换浏览器。

源码检出在source/；原始输出在其外h1-evidence/，不污染manifest工作树。原脚本自行记录sourceFingerprint、runnerHash、版本、资源、堆量及错误；外层补充请求/环境/起止时间/退出码。

## 失败与证据

每样本stdout/stderr、开始标记、runs.tsv均保留；失败不转绿，也不取通过结果替换。每样本40分钟、TERM后10秒KILL；124/137停止后续样本。任何样本非零最终job非零；失败后的upload-artifact仍执行，上传全量原始h1-evidence目录，保存30天。安装、build、预检查失败亦保留已有日志。

整个job最多300分钟，步骤分别设短超时，为采样和上传留余量。runner故障或被平台强制终止仍可能中断artifact上传，不能保证在硬故障时已传出全部字节；需以实际artifact状态验证。

## 验证状态与默认分支注册

本地完成YAML解析、仅手动触发/权限/默认SHA检查、全部bash -n、Node注册版本检查；原始trace/log离线核验另有报告。未在本机启动浏览器，未宣称诊断已跑通。GitHub普通CI和该新诊断workflow的实跑分别报告，前者通过不代表后者已执行。

[GitHub官方说明](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)要求首次手动工作流存在于默认分支。当前默认分支为main。因此从main另建仅包含此新增文件的小分支准备PR；不把M8代码、诊断报告或其他脚本合入main。合并仍须用户单独批准，新工作流只因手动dispatch运行；main自身既有push CI仍按原配置触发，不改它来规避检查。

独立ChatGPT Pro审计将核对固定差异和最终SHA完整CI后给出判断；此文档及开发静态检查不构成签收。
