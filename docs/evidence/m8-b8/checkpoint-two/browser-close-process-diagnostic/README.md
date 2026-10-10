# 独立诊断 P2：补足关闭与进程事件（尚未关闭）

响应独立评论 [6095230143](https://github.com/catfish-xn/cat/pull/28#issuecomment-6095230143) 和用户明确许可。基于3dc3dd/本地5e8ea0e，只改 `scripts/verify-m6-performance.cjs` 诊断：

- 在任何脚本依赖及Playwright导入之前，将 `pw:browser` 追加到原DEBUG，不覆盖原选择器。锁定Playwright将PID及真正Chrome `process did exit: exitCode=…, signal=…`写stderr。已有负选择器也保留并记录；如`-pw:*`抑制该频道，不能声称已采集退出记录，需先报告运行配置冲突，不能默默移除用户设置。
- 补page close/context close，catch记录page.isClosed/browser.isConnected；finally唯一browser.close前后记录调用位置及cleanupStarted。Node exit仍明确是Node，不冒充Chrome退出。
- manifest在browser.close前写出，之后事件在diagnostics.jsonl和stdout追加；分析必须同时看三者与stderr/wrapper。Node序号只表示接收顺序，异步浏览器console不提供跨进程精确全序。

Node22静态语法、AST和事件模拟通过：三个page.evaluate正文逐字相等；launch/goto、完整route/payload、gate/skip/clock/close调用不变。没有改CI配置、负载、样本、时限、worker或生产。仅诊断日志不等于性能改进，若观察影响计时，应标诊断运行而不是替代原验收。

尝试了一次低成本真实本机主动page.close/browser.close/cleanup对照，原脚本同launch API/参数、指定已安装 `/usr/bin/chromium`，没有安装或替换浏览器。**启动即因本机socket权限失败，Chrome SIGABRT；page/context对照均未执行。** stderr实际验证pw:browser输出PID28、exitCode=null、signal=SIGABRT；不能类推CI200的原因。原失败与完整脚本保留，未修改参数/权限绕过，亦未冒充Chromium或M6性能通过。事件模拟仅验证接线，真实关闭分类及原负载仍等下一正常CI。

复现正式路径仍为 `node scripts/ci-m5-step.cjs m6-performance node scripts/verify-m6-performance.cjs`，按既有input-dev顺序准备；没有为了诊断单独重跑无变化的全CI。新增脚本SHA和gzip9/raw SHA256见manifest。
