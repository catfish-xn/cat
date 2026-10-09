# CI153 六窗口快照组（独立扰动组）

[run37868435305](https://github.com/catfish-xn/cat/actions/runs/37868435305)，[完整原始artifact11590605451](https://github.com/catfish-xn/cat/actions/runs/37868435305/artifacts/11590605451)。定义2e4e537、生产源码97f38a0、Chromium153.0.8010.12，2预热、6×30周期。7份原始快照包含before、first-after、window2–6；整包88,444,742 B、252成员，SHA256/CRC核验通过。source始末指纹、干净source、实际浏览器、派生代码canonical hash和原30条断言源行均核验。

| 窗口 | before B | after B | delta B |
| --- | ---: | ---: | ---: |
| 1 | 14,711,196 | 15,057,988 | +346,792 |
| 2 | 15,057,988 | 15,236,328 | +178,340 |
| 3 | 15,236,328 | 15,393,148 | +156,820 |
| 4 | 15,393,148 | 15,618,412 | +225,264 |
| 5 | 15,618,412 | 15,814,204 | +195,792 |
| 6 | 15,814,204 | 15,563,944 | −250,260 |

Runtime.usedSize首末净增852,748 B；监听器始终82、pendingRAF始终1。前5窗正增长而第6窗回落，退出0/persistentGrowth=false不等于无泄漏。快照会扰动GC/代码保留等，此组不能混入正常样本超限频率。

## 离线三阶段快照统计

由提交的analyze-h1-snapshot-series.py读取before、after(first)、window6，原始输入SHA和完整文件大小见provenance.json。

| 快照 | 节点 | self-size B | code类型 B | native类型 B |
| --- | ---: | ---: | ---: | ---: |
| before | 340,710 | 28,460,127 | 6,741,496 | 16,484,147 |
| first | 345,682 | 29,538,859 | 7,557,612 | 16,741,047 |
| final | 338,385 | 29,783,165 | 7,745,384 | 16,831,797 |

首末self-size净增1,323,038 B；code净增1,003,888 B（约75.9%的快照净增，不是Runtime.usedSize增长比例），native净增347,650 B，其他类型合计净减少28,500 B。first→final仅再净增244,306 B，其中code187,772 B、native90,750 B，其他类型净减少34,216 B。必须同时保留减少项，不能只相加正增长。

三个阶段scene/session属性结构候选各1个；这还需与实际根链和scene.session核对，不能单凭数量宣称应用无泄漏。具体见证及有限归因见 ../../H1_CI153_RETENTION_ANALYSIS.md；selected-witnesses.json保存重建的根链与scene.session关系。

retention-excerpt.json.gz包含各阶段完整type统计、shape候选、动态Performance路径、选中组代表路径、各区间正前60/负前30组和ID标签变化。为控制体积，完整全部named groups/deltas不重复保存；大于512字符的名称保留256字符前缀、原长度和SHA256。所有ID、边顺序、字节数保留，完整结果可从原artifact和已提交脚本重算。压缩mtime固定，非原始快照。

本目录其余生命周期、趋势、日志、环境、请求、派生代码与derivation均为artifact原字节复制；完整manifest和7份原始快照仍在artifact，保留至2026-11-08。H1未签收，不能把本组通过作为门禁稳定性的结论。
