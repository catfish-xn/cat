# H1 CI153 同运行保留链分析（诊断中）

固定源码97f38a0；[快照运行37868435305](https://github.com/catfish-xn/cat/actions/runs/37868435305)，实际Chromium153.0.8010.12。输入、完整artifact与三阶段统计见[evidence README](evidence/h1-ci153-snapshots/README.md)及provenance.json。原始7份快照同一浏览器/CDP会话；下面比较before、第1窗后、第6窗后，不能混入正常组超限统计。

## 核心观察

- 六窗Runtime.usedSize净增852,748 B，最后一窗回落250,260 B；不是零增长，也不能把persistentGrowth=false当无泄漏证明。
- 快照self-size净增1,323,038 B，其中code类型+1,003,888 B、native类型+347,650 B，其他类型合计−28,500 B。code占快照净增75.9%，不是Runtime堆增量归因比例。
- first→final快照再净增244,306 B，存在代码保留、浏览器性能记录及DevTools网络记录路径，同时字节码、常量池、字符串等下降。确实有保留对象增长，不能把一切都叫随机噪声；但尚未证明持续的应用状态泄漏。

## 可重建的具体见证

机器证据[selected-witnesses.json](evidence/h1-ci153-snapshots/selected-witnesses.json)从固定final快照重新解析，不是仅复制文字路径；保留实际边类型、ID及根路径。ID只适用于这个输入。BFS排除weak和两种条件边；路径不是dominator或独占retained-size。

| 观察对象 | before→first→final数量/字节 | final见证路径与含义 |
| --- | --- | --- |
| blink::NetworkResourcesData::ResourceData | 61→79→196；后5窗+117/+33,696 B | C++ Persistent roots→DevToolsSession#62→InspectorNetworkAgent#37028→NetworkResourcesData#24108→HashTable#95102→ResourceData#72354（288 B）。明确有工具网络记录保留路径，不是业务战斗对象 |
| PerformanceResourceTiming | 36→54→171 | Performance#433051→entry vector#124360→#72406（136 B）；后5窗仍增长 |
| PerformanceLongTaskTiming / TaskAttributionTiming | 各11→94→200 | Performance→vector#86016→LongTask#67146（104 B）→attribution vector#67148→Attribution#67150（120 B） |
| PerformanceLongAnimationFrameTiming | 40→200→200 | Performance→vector#58562→#58394（176 B）；first与final相同，不等于每个中间窗恒定 |
| LayoutShift / DOMRectReadOnly | 101→150→150 / 326→672→672 | 浏览器性能/布局相关类型，后5窗首末数量相同；不能用首次增长外推无限累计 |
| native:system / WeakArrayList | 本类型首末+133,464 B | #993953经Strong root list→PropertyCell(no_undetectable_objects_protector)→dependent_code；#667175经NativeContext.retained_maps。名称虽归native，不能全部算性能条目或应用数组 |
| InstructionStream及编译辅助结构 | code首末净+1,003,888 B（含减少项） | Window.__CAT_DEBUG__.read→context.this→scene#84981→strategyPanel.__proto__.updateCombat→Code#1018331→InstructionStream#1172803（29,696 B）。代码增量包含应用界面函数，不能全算工具；编译后代码保留也不等于业务对象泄漏 |
| 打包模块编译结构 | 代表节点，不代表该组全部增量 | debug.read context→previous context→minified closure oh→Code#996805→InstructionStream#1172751（43,264 B）及deoptimization_data→ProtectedFixedArray#1173171→TrustedByteArray#1173161。未把oh猜测成某源函数 |

Performance共同根的一条路径经过Global handles→DevTools console→UtilityScript.builtins.performance；另有独立Window→GlobalPerformanceImpl#3006→Performance#433051路径。因此不能声称UtilityScript独占性能缓冲或移除Playwright就会消失。ResourceData及ResourceTiming样本的原图出边没有给出资源URL，不能猜成字体、图片或某个请求。

## 应用会话样本

scene结构候选每阶段仅一个，均#84981。其session属性依次指向#163589、#712341、#2018417，且全图session结构候选各仅一个；final不含旧两个session ID。final session.combatLedger→Array#2018423→backing#2019677（2,376 B）。支持“当前会话被替换，未发现这一结构多份累积”这一有限结论，不等于其他闭包、监听器、撤销记录都无泄漏；同ID/同标签及ID缺失也不作普遍对象生存证明。

## 下一步与不能下的结论

现有证据把部分增长定位到编译结构、工具网络记录、浏览器性能记录及其实际引用链，尚无反事实对照证明哪个因素造成正常组单次超限。快照本身扰动运行，不能拿这一组替正常失败样本归因。

按H1_CI153_SAMPLE_PLAN.md继续固定预算的无快照重复/连续窗口及dev初步覆盖。候选改进可同时看晚段趋势、对象保留、独立进程复现，并用匹配对照验证工具缓冲/JIT影响；这里只提出方案，不改测量方法、门禁、运行代码或测试预期。没有独立无泄漏真值，仍不能报告“误报率”。H1最终报告及签收待新Pro审计对话。

## 七个边界的补充核对

可复现计数见evidence/h1-ci153-snapshots/boundary-counts.json，运行脚本summarize-h1-snapshot-boundaries.py。ResourceTiming依次36/54/78/99/122/148/171，ResourceData依次61/79/103/124/147/173/196；本次六窗中网络/工具记录确有累计，但两序列恒差25不证明逐条对应或相同资源URL。LongTask/TaskAttribution依次11/94/158/200/200/200/200；LongAnimationFrame自first后均200，LayoutShift均150、DOMRect均672。这些只是本次计数稳定，不推断全局容量上限。

实际条件边仅检测到已支持的编号WeakMap及ephemeron-table两种格式，未知条件模式校验未触发。最后一窗快照self-size仍增加38,260 B，而该窗Runtime.usedSize减少250,260 B，再次说明两口径及采集时点不能逐字节互相分解。
