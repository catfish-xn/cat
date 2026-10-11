# H1 原2次预热的连续窗口诊断副本

## 用途与隔离

H1要求观察同页面连续等长post-GC走势；原门禁只有一个30周期窗口，已有实验将预热改成12。新增 `scripts/diagnostics/h1-extended-window.cjs` 因此创建**独立诊断副本**，保留原2次预热，在同页面连续观察6个各30周期窗口。

不编辑目标源码、原门禁脚本、阈值、运行代码、合同或测试预期。诊断副本不是新的验收入口；其通过/失败不能替代原脚本正常组。原正常3样本CI运行固定在c136ab3定义，不受后续提交影响。

## 可核验的派生

- 原脚本canonical字符串SHA256必须精确为6b7f06e2a963ced3b601fd19074aa07a9fa1a670f6aa4467a2445bc3af8d7f25，否则停止，要求重新检查目标版本。
- 源码文件只读。副本写在source工作树之外，并连同derivation.json作为原始artifact保存。
- 每个替换锚点必须恰好出现一次：加入诊断身份；开启原follow-up块；窗口上限3改为请求值；快照标志改为实际值；后续窗口边界可选快照。
- 所有原有30条含断言的源行逐字、顺序保留；原预热表达式保留，通过清除M6_WARMUP_EXPERIMENT维持2次。GC、cycle和原堆上限不改。
- 额外窗口断言也保留，所以可能因任一窗口超限或全部窗口正增长失败。失败只证明相应诊断断言触发，不自动等于应用泄漏。

## 模块与身份

在源脚本模块上下文编译，require、动态import('vite')与__dirname均解析目标工作树的锁定依赖；__filename显式指向真实归档副本，确保原manifest.runnerHash计算的是实际执行代码，而非未执行的原文件。

derivation.json包含source SHA、原probe hash、派生probe hash、wrapper SHA256、窗口和快照参数。派生文本含归档绝对路径，故不同输出目录的派生hash不同，应核对每份artifact内的派生文件/derivation/manifest，而不是强求跨目录hash一致。源原probe hash不变。

`extended`组不采快照；`extended-snapshot`是独立扰动组，before/after对应第一窗口，window-2…window-6为后续边界快照。快照组不会标成heapDiagnostics:false，不与正常组或无快照扩窗组混算。

## 复现与验证状态

```bash
# 仅准备/语法验证，不启动浏览器。
node scripts/diagnostics/h1-extended-window.cjs --source /absolute/clean-source --output /tmp/h1-extended --mode preview --windows 6 --prepare-only
# 真正执行，目标source须干净并已安装依赖和build。
node scripts/diagnostics/h1-extended-window.cjs --source /absolute/clean-source --output /tmp/h1-extended-run --mode preview --windows 6
```

本机只完成Node语法、两种快照标志的prepare-only、原hash/30条断言保持，以及source-context动态import的离线验证。没有本机浏览器执行。实际配置为下一批extended、preview、1样本、6窗口；要等当前原正常批次结束并检查结果后，再移除/添加PR专用标签触发，不自动抢跑。

临时workflow分别固定source为97f38a0、harness为触发时PR head SHA，二者身份分别记录。workflow最终不合入任何目标分支，现有CI和必过检查不改。
