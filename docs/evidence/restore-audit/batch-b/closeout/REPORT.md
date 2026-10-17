# 批 B 收尾：两项显式时限授权与相关回归

## 固定版本和边界

- 起点：8827a5ece97cfd9e20f4d88975890c1116a3e82d。
- 本轮受测代码：bbf27ba0b07010a254a7c2ff20af1a0d4c810b79。
- 仅将 B5 历史保存恢复两个指定用例的 timeout 显式设为 20,000ms。这是用户本轮明确授权，不代表原 5,000ms 已通过；其余 timeout、hook、断言、规模及生产代码不变。
- 原先 6,516ms / 5,735ms 超时记录在 ../exact-cache/，保留原记录。
- 没跑全套或远端 CI，不将相关绿当成全部仓库签收。

## 本轮结果

- B5 全文件：9/9，26.90s。两个获批用例分别 6,953ms、5,541ms，均在 20,000ms 内；其余原时限照常通过。
- 其余 B 批相关：11 文件 / 187/187，7.09s。包含序列化、持久化、经济、命令阶段、B8 恢复、原审计负例、账本、同调用 scope、精确缓存、动态 getter、战斗回放。
- 合计 12 文件 / 196 通过 / 0 失败 / 0 跳过。typecheck 通过。
- 原始 Vitest JSON 和逐条耗时见 b5.json、related.json、per-case-times.json；完整命令及输出见同名 log。B5 尾部与下一组启动有约 3 秒重叠，未据此作独立性能比较；本轮均原命令公开测试通过。

## 缓存和旧测量绑定

生产 src 树为 07ee38596f4df3dee42f4ab507186af1a3c5b408，与 4dd73d4c9f20fef7fcbd8ee48189acb84d1ff29f 完全相同。此前 33 场 64MiB 成功测量和本轮代码均绑定此生产树；测量当时发生在代码提交前的工作树，不伪称当时运行的是已经存在的提交。证据录入于 8827a5e，完整原始值/源码见 ../exact-cache/。

- 33 场单恢复 cold/warm 5460.475 / 33.467ms；collection 8804.626 / 454.612ms，各一次。额外 warm 精确计数 stepMatchImpl=0。
- 4-5 standalone 2549.723 / 17.044ms；此项发生在 collection 容量调整前，standalone 路径相同，不把它表述为最后工作树全路径重测。
- 独立缓存最多 8 条 / 8MiB，collection 最多 2 条 / 64MiB，双限制 LRU 淘汰；超大条目不缓存。按 canonical UTF-16 key+value 核算，不是实际 heap 上限；两类合计最多 72MiB 计账值。
- 33 场实际条目约 60,593,488B，所以原 8MiB 不命中记录保留。RSS 独立观察 1,235,092KiB 包含生成和全部冷/热验证，不能归因全为缓存。
- 跨调用只允许完整输入精确命中，完整 battles 任一变化也失效；无跨调用前缀缓存。入出 clone，真实版本键，全字串防哈希碰撞，每次仍比较当前经济/事件/RNG。

## 合并版本要求

本轮仍未升版本。合并时统一升级 Match schema（当前 7）、save format（当前 3）；replay context 内嵌 Match，replay format（当前 3）必须同步评估/升级并绑定恢复规则身份。缺账本旧档拒绝，无兼容补账。内容数值、规则、digest 与 command 参数不变，具体集成版本由合并顺序决定。

## 夹具脚本与阻塞（不可签收为全部通过）

- record-g2-3-inputs.cjs 先 --check、再默认写、再 --check：均退出 0，9 cases，digest fnv1a32-utf16:b58e35ae，生成文件没有变化。日志保留。
- verify-m8-herald-fixtures.cjs 实际不接受 --check，默认即 verify；--write 不仅改来源指纹，而是重新生成 5 份完整 raw、trajectory 与 manifest。
- 本轮先执行默认 verify：5 份真实原始导出各 14 场 / 4485tick，全部生产恢复、开战与 15tick 逐次序列化恢复一致性断言通过；最后逐字节对比旧 ionic-spark.json 失败，退出 1。原日志完整保留，整个脚本约 10分49秒。
- 磁盘旧 raw 明确没有 preparationLedger，新真实轨迹导出包含账本；必须迁移完整 raw，不能只改 source hash，不能补造账本或去掉字段来使比较通过。
- 用户本轮授权被限定为源指纹，因此尚未执行覆写 raw 的 --write，已单独报告范围并等待批准。没改脚本或降低验证要求。这里是有证据的迁移阻塞，不能将 196 项绿与该脚本退出 1 混作全绿。
- 未尝试受限推送；只读 ls-remote 当前远端为 8827a5ece97cfd9e20f4d88975890c1116a3e82d。交接增量以此提交为前置。
