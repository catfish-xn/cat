# CI153原2预热六窗口（独立派生诊断组）

[运行37863254735](https://github.com/catfish-xn/cat/actions/runs/37863254735)，[原始artifact11588635788](https://github.com/catfish-xn/cat/actions/runs/37863254735/artifacts/11588635788)。定义8becae8，生产源码97f38a0，实际Chromium153.0.8010.12，干净source，2次预热、同页面6×30周期、无快照。

| 窗口 | before B | after B | delta B |
| --- | ---: | ---: | ---: |
| 1 | 14,615,792 | 14,886,936 | +271,144 |
| 2 | 14,886,936 | 14,517,344 | −369,592 |
| 3 | 14,517,344 | 15,084,720 | +567,376 |
| 4 | 15,084,720 | 15,411,212 | +326,492 |
| 5 | 15,411,212 | 15,727,756 | +316,544 |
| 6 | 15,727,756 | 15,522,972 | −204,784 |

4正2负，净增907,180 B；窗口3–5连续增长1,210,412 B后窗口6回落。不能将脚本persistentGrowth=false或退出0解释成已证明平台期/无泄漏。当前数据说明有波动且仍有净增长，需要结合CI153快照和B4负载判断。

下载全包SHA256与GitHub记录一致、245成员CRC全过。原始生命周期/趋势、派生代码/derivation、请求环境与日志以原字节保存；完整manifest等其余原始数据保留在artifact（到2026-11-08）。provenance.json记录manifest原hash、身份摘要和核验结果。

实际manifest.runnerHash与归档派生代码canonical字符串hash及derivation一致，wrapper hash与8becae8一致；原源probe hash匹配，30条断言源行逐字顺序不变。stack路径为source编译上下文，错误定位应参照归档派生代码，不把行号直接当原文件行号。此组不替代原正常3样本的门禁结果。
