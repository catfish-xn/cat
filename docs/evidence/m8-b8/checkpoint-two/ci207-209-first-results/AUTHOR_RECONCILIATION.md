# 作者只读核对：关闭发生在DevTools输入管道，而非已测性能门限

监控原始材料保持不变，manifest不包含Chrome stderr，必须与完整input-dev job log一起读取。

CI209/e77dd38da5c525b1915698a0663472724ff1fdcb：08:16:47.793 Chrome PID3813先报 `Too large read data is pending: capacity=104857600, max_buffer_size=104857600, read=104857600`，紧随 `devtools_pipe_handler.cc:324 Connection closed, not enough capacity`。08:16:47.797才出现page-close，cleanupStarted=false/browserConnected=true；随后catch、cleanup、context-close、browser-disconnected及close-return。因此已获本轮DevTools100MiB输入容量关闭的直接原因，不能继续笼统称偶发/OOM。没有measurement返回或第一个callback marker，不将它写成性能阈值失败；异步console也不能独自证明callback绝未执行。

此前CI207最终passed:false摘要在await browser.close与await server.close之后已打印；因此十余分钟不退出不能归为这两个await一直挂住。锁定Playwright客户端Browser.close捕获TargetClosedError可返回，不保证底层Chrome进程已exit；209新日志仍无Chrome exitCode/signal，runner最终列出孤儿进程。进程残留是另一个尚未完整定位的清理现象，不替代已获管道错误原因，也不以强制process.exit掩盖。

下一步只读精确复现相同五公开路线fixture、plain JSON和Playwright实际CDP编码大小及内容哈希；如改等价传输，须保持完整负载/别名/undefined等内容语义、原测量起止和样本，先提交最小方案与验证计划。未削减payload、未改门禁或skip。

CI207/209 TG首次失败与CI208同源码测试通过同时保留；最终没有一轮完整CI全绿，compare未执行，②未签收。
