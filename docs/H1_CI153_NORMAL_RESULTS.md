# H1 CI153 原参数12次结果（正常组）

固定源码97f38a0、Chromium153.0.8010.12、Node22.23.3、preview/cannon，原2预热/30周期、不带快照。按预登记预算完成12个独立进程，全部首次结果保留；不再追加正常样本直到通过。4个job，job内共享宿主；CPU型号分层如下。

## 主要结果

- 原1MiB堆增量门禁超限3/12（25%）；这是观测超限频率，不是已验证的误报率。
- 均值539,065 B，中位数268,214 B，样本标准差808,320.85 B，中位绝对偏差333,076 B。
- 最小−601,396 B，最大+2,015,536 B，极差2,616,932 B；10次正增、2次负增。
- 描述分箱：负值2；0至0.5MiB为6；大于0.5至1MiB为1；大于1MiB为3。没有假定高斯分布。
- 起点范围13,950,140–15,658,700 B；终点范围14,375,840–16,154,504 B。起点和终点都变化，不能只按起点或只按终点解释全部失败。
- 若假定独立同分布，超限比例Wilson95%名义区间8.89%–53.23%；共享job及CPU混合限制该假设，不把它当未来CI概率或误报率区间。

## 全部样本

| run | 样本 | before B | after B | delta B | 超限 |
| --- | --- | ---: | ---: | ---: | --- |
| [37859458842](https://github.com/catfish-xn/cat/actions/runs/37859458842) | preview-normal-01 | 14,828,636 | 14,634,800 | -193,836 | 否 |
| [37859458842](https://github.com/catfish-xn/cat/actions/runs/37859458842) | preview-normal-02 | 14,132,204 | 15,946,812 | +1,814,608 | 是 |
| [37859458842](https://github.com/catfish-xn/cat/actions/runs/37859458842) | preview-normal-03 | 14,639,716 | 14,642,004 | +2,288 | 否 |
| [37870725740](https://github.com/catfish-xn/cat/actions/runs/37870725740) | preview-normal-01 | 14,100,716 | 14,601,292 | +500,576 | 否 |
| [37870725740](https://github.com/catfish-xn/cat/actions/runs/37870725740) | preview-normal-02 | 14,437,200 | 14,627,672 | +190,472 | 否 |
| [37870725740](https://github.com/catfish-xn/cat/actions/runs/37870725740) | preview-normal-03 | 14,120,912 | 15,544,824 | +1,423,912 | 是 |
| [37874122823](https://github.com/catfish-xn/cat/actions/runs/37874122823) | preview-normal-01 | 13,950,140 | 14,618,580 | +668,440 | 否 |
| [37874122823](https://github.com/catfish-xn/cat/actions/runs/37874122823) | preview-normal-02 | 14,073,716 | 14,375,840 | +302,124 | 否 |
| [37874122823](https://github.com/catfish-xn/cat/actions/runs/37874122823) | preview-normal-03 | 14,371,792 | 14,606,096 | +234,304 | 否 |
| [37878055798](https://github.com/catfish-xn/cat/actions/runs/37878055798) | preview-normal-01 | 14,138,968 | 16,154,504 | +2,015,536 | 是 |
| [37878055798](https://github.com/catfish-xn/cat/actions/runs/37878055798) | preview-normal-02 | 15,524,796 | 14,923,400 | -601,396 | 否 |
| [37878055798](https://github.com/catfish-xn/cat/actions/runs/37878055798) | preview-normal-03 | 15,658,700 | 15,770,452 | +111,752 | 否 |

## 分层与限制

- 前3个job均AMD EPYC7763：9次中2次超限；第四job为AMD EPYC9V74：3次中1次超限。不能据此判定CPU型号造成差异，硬件/启动状态没有随机交叉对照。
- 每job超限依次1/3、1/3、0/3、1/3；不足以稳定估计尾部或跨宿主方差。
- 最新job中有高起点15,658,700 B、终点15,770,452 B而增量仅111,752 B的通过样本；其他job也有更低终点15,544,824 B但因增量1,423,912 B失败的样本。这说明门禁比较端点之差，不是绝对终点内存上限；跨job比较仍有CPU混杂，不作因果推断。
- 无快照正常组只能观察增量分布；不能把该分布直接命名为“纯测量噪声”。CI153快照已找到代码/工具/浏览器保留位置，但快照扰动组不是正常失败样本的反事实真值。
- 只有明确独立无泄漏真值才能估计“把正常判成应用泄漏”的误报率；目前误报/漏报均未识别。结果既不能证明应用持续泄漏，也不能证明所有超限无害。

## 复现与后续

运行 `python scripts/diagnostics/summarize-h1-normal.py --output /tmp/h1-normal-summary.json`；输出应与 `docs/evidence/h1-ci153-normal-summary/summary.json` 逐字节一致。JSON保留各输入SHA256、CPU/job分层、排序样本及统计定义。各批原始生命周期/日志/环境和artifact链接分别在h1-ci153-normal及-batch2/3/4目录。

下一步仅按已定预算补原2预热连续窗口及dev初步覆盖，结合保留链提出改进选项。Chromium141、快照、B4模块、dev及普通CI重跑不混入上述12次统计。没有修改现有门禁或给出H1签收。

## 候选方法的离线影子结果（不采用）

若把每个job的3次样本改成中位数/多数判定，四个job都会通过，中位数依次2,288/500,576/302,124/111,752 B，会忽略本次3个单次超限。这仅展示敏感度降低，不能声称消除了3次误报；若异常是间歇性真实保留，反而可能增加漏报。现有门禁未作此变更。
