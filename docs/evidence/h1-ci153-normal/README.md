# 第一批CI153原参数诊断

- workflow定义：c136ab3b65670cb95e2ccabb30e52683da847aec；源码97f38a0e787a4edcb35df4a59823bb1d106def67。
- [独立诊断run1](https://github.com/catfish-xn/cat/actions/runs/37859458842)，[完整原始artifact](https://github.com/catfish-xn/cat/actions/runs/37859458842/artifacts/11587156031)。
- archive63MB、510成员，下载后整包SHA256与GitHub记录一致，全部ZIP成员CRC通过；身份、各manifest摘要/原文件SHA和统计见provenance.json。
- preview/cannon、2预热、30周期、无快照、Chromium153.0.8010.12、干净source；原runnerHash及source指纹均匹配，三个独立子进程顺序执行。

| 样本 | before B | after B | delta B | 退出码 |
| --- | ---: | ---: | ---: | ---: |
| 01 | 14,828,636 | 14,634,800 | −193,836 | 0 |
| 02 | 14,132,204 | 15,946,812 | +1,814,608 | 1 |
| 03 | 14,639,716 | 14,642,004 | +2,288 | 0 |

第二样本在原1,048,576 B断言超限766,032 B；不将失败替换或重跑取通过。样本01/03终点相差7,204 B，样本02终点明显更高，当前仍不能把超限直接归因起点或证明应用泄漏。

此目录m6-lifecycle.json、日志、request/env/runs等为artifact原字节复制；完整manifest（含大量其他路线数据）、trace、截图等仍在原始artifact。artifact保留至2026-11-08，关键数值与来源已随本目录长期保存。没有把141代跑组混入本组统计。

旧完整CI #101、#102的成功与本诊断失败分别记录；本次run是调查而非新的必过检查。后续原2预热六窗口组用于识别持续走势，尚未据此签收H1。
