# M7 防连点与 B3 R5 preview 同机复测（2026-10-07）

## M7 故障归属与一次性授权

用户明确授权 AGENTS.md 一次性例外，仅应用已提出的一行补丁：`src/rendering/strategy-panel.ts:284` 将阶段保护时间从命令执行前的 `now` 改为命令执行完成后的 `performance.now()`。原400ms窗口和其余处理分支保持原样；没有修改视觉、布局或 AGENTS.md。

main@15313a7 的原完整 M7 脚本本地7项通过，正常负载下这个样本未复现；同一公开触摸路径在4×和8×CPU延迟诊断下均复现第2回合误入combat。4×中“继续”同步处理168.1ms，第二事件在结束275ms后到达，距原起点443.1ms；8×中同步处理502.9ms，已超过原保护窗口。三个对照版本的原strategy-panel.ts逐字相同，SHA256 `15b4129b5f305c881886e7d2a285903b1c44e3472527e8b11383c6c1f62260b3`。这是M7已有的耗时敏感缺陷，B3负载可能增加触发概率，不能表述为main标准门禁每次都失败。

授权补丁的原完整M7脚本7项通过，相关输入/M7模型18项通过，TypeScript/Vite构建通过。当前补丁4×诊断拦住第二事件、停在准备阶段；它与main使用不同规则引擎，仅为各自功能观察，不冒充严格配对性能因果实验。8×下补丁也仍误触：第二事件在命令结束419.9ms后实际处理，超过保留的400ms窗口。保留这项边界失败，没有扩大补丁或窗口。CPU延迟仅用于额外诊断，不进入正式CI参数，原M7验收脚本未修改。

## 九次原 preview 生命周期比较

同一台4核Intel Xeon Skylake（IBRS）、8,322,404,352B内存、Node24.21.0、Chromium153.0.8010.12。依赖/锁文件一致，三个干净固定提交各构建一次。每轮按main→第一批→当前交错串行，每次新浏览器会话；测量期间没有并行构建或其他浏览器验收。这里的main是用户指定的历史M7提交15313a7，不是测量期间变化的远端main分支头。

命令均为原 `node scripts/verify-m5-browser.cjs --preview --build=cannon --m6-f2`；脚本SHA256 `b5b95eb2cc80fc9936588879ab77601600619033d4996f18df782996da6f9a8b` 在三个版本相同。均2次预热/30循环、无heap snapshot/额外预热，原1,048,576B断言不改。正式CI的`--m6-journey`使用相同前缀完成生命周期测量后继续整局；这九次F2脚本不是完整CI。所有运行源码指纹前后一致，监听82→82、RAF1→1。

| 版本 | 第1次B | 第2次B | 第3次B | 中位数B | 超1MiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| main（指定M7提交15313a7） | 1320820 | 1003828 | 365480 | 1003828 | 1/3 |
| 第一批877c59b | 180136 | 396972 | 221328 | 221328 | 0/3 |
| 请求时当前提交967f6fe | -1070772 | 749392 | 289336 | 289336 | 0/3 |

main第1次CLI退出1，失败为原`verify-m5-browser.cjs:52`堆增长断言；其他8次CLI退出0。失败样本照实保留，没有重复到通过后替换。

## 1.16MB 与 M6-MEM-01 的判断

原[CI #80](https://github.com/catfish-xn/cat/actions/runs/37611384083)在967f6fe全部结束：8通过、preview炮手与M7两项失败、3跳过。preview增长1,158,072B（13,685,008→14,843,080），超1MiB109,496B；dev炮手增长−369,036B已通过，dev输入capture P95为30.1ms，其余7项时间预算通过。保留原失败，不用本地通过替代。

1,158,072B落在main三样本区间365,480–1,320,820B内，超过第一批三样本上界396,972B和当前三样本上界749,392B。应称为“落在本次main基线实测波动区间”，不能把不同版本合并成统一分布。每版本仅3次，且本地Node24/Skylake与CI Node22/AMD环境不同，不足以证明统计意义上的正常范围或排除本批增加有界编译/执行成本。当前中位数比第一批多68,008B，三个样本不能证明其因果。main没有B3也可超原门禁，因此单凭1.16MB不能认定B3新增运行状态泄漏。

当前967f6fe另一次preview快照诊断中，UndoStep2→32（每循环+1），MediaQueryFeatureExpNode32→182（每循环+5），与[已登记M6-MEM-01](M6_LIFECYCLE_KNOWN_ISSUE.md)速率一致。旧M6的独立输入对照已证明反复fill同一seed足以累积UndoStep；媒体查询缓存另有导入/回放保留链。相同已知保留现象出现在本路径；没有清空撤销历史或在M8夹带独立M6内存修复。

该诊断中机制状态24→24、任务/余数/状态贡献0→0、盾分账/盾层660→660、治疗结果2→2、活动29→29、Session/History/Coordinator各1→1；旧所有者及旧盾/治疗/活动对象ID消失。未观察到G04–G07运行状态持续累积。InstructionStream节点self-size净增540,416B、TrustedByteArray149,020B、ProtectedFixedArray70,708B；Object904B、Array192B。较大编译块关联renderItems、render、updateText、innerSerialize及Phaser初始化等。原生节点self-size与JS Runtime.usedSize不同，快照会扰动时序，不能抵扣门禁，也不能将整个1.16MB归给撤销记录。精确主因与长期收敛仍未证明。

原CI #75的dev增长1,763,096B另行保留；本次preview重复数据不能直接解释那份dev样本。R3/R6修复合同生命周期，通用哈希修复短期字符数组分配，不能假称它们已解释全部历史堆差值。前序证据见[M8_B3_AUDIT_REPAIR.md](M8_B3_AUDIT_REPAIR.md)。

## 最终提交验收

本次提交仅包括获准的一行UI补丁与验证记录。冻结B2 contracts/ui-contracts、规则算术修订、内容digest84c32d26、golden、CI脚本/路径/门禁均不改。推送后在本次最终SHA手动触发标准完整CI（profile/warmup_experiment/heap_diagnostics均false），等待全部作业终态；最终SHA、运行链接及逐作业结果在任务汇报绑定，不把旧绿色替代新提交验收，不合并。

## 原始堆边界与产物校验

| 样本 | before usedSize | after usedSize | m6-lifecycle.json SHA256 |
| --- | ---: | ---: | --- |
| main-1 | 12083212 | 13404032 | 3c67a0b63deeb01aefe3e5aca8c76316b2f51fdd53423c0d5f3206a9ace9c599 |
| first-1 | 12762628 | 12942764 | 138b0f050c99abecbaad63724dced680d2bb6ad4312c32686a957f55110b0584 |
| current-1 | 14972324 | 13901552 | 72d25a0426a8c1a8bb103183f5541f4664c908cd8211912ad4ff9fa3ec5e7372 |
| main-2 | 12425252 | 13429080 | d91d0db475454b33354020ea8b67008aaf059169fb2be1b1d52e6cf4fa29adea |
| first-2 | 12418916 | 12815888 | 0711528e957026c918c492aeb4655b971ba4fdc4a6ed2870ff88a5ea99e650ce |
| current-2 | 13840132 | 14589524 | 461aa9aaec61b1be4568fd317d6c3a921b56ec2d6ff19070b4638440aed90706 |
| main-3 | 12602648 | 12968128 | 8f70e5bd384f4428ea9f1ed5e432c6229930dcb775d243ad6f011a1b3ed92b0b |
| first-3 | 12844432 | 13065760 | 5e55ba782fb11f22e42500f3ea73056d821666316f6d8090b146b6495ae1b8f4 |
| current-3 | 14514876 | 14804212 | c754a96bef662e6d0c4a580b508137eec70183a8f981d3bfd3b6d40159c8c0c0 |
