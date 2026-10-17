# B7三条冷恢复用例：用户批准20秒后的三轮验证

## 授权与固定代码

- 用户2026-10-17 15:12明确批准：仅4-7/5-7/6-7的“freezes, starts, runs to settlement and resumes canonical saves”冷恢复用例设显式20000ms。理由是首次冷恢复必须真实计算战斗。
- 起点83f565542c2636adaa9ff4db7e5593d6bca01977；fetch/ls-remote确认远端同SHA。未合入新multiplayer。
- 受测测试提交833ba349671323f364f95051005154a88165ffe6。生产代码完全不变。
- tests/m8-b7-match-wiring.test.ts:31–55：it.each改为同序for注册同名用例，:33只对上述3个roundId传20000，其余传undefined沿用原默认；全部断言与输入路线保持。旁注记载用户批准。
- 没有修改任何其他测试时限，没有运行typecheck、其他测试或全套，也没有重算指纹。

## 执行

同一机器、Node24.19.0/npm11.9.0，串行启动3次独立npm进程：

`npm test -- tests/m8-b7-match-wiring.test.ts --reporter=default --reporter=json --outputFile=/tmp/b7-approved20-roundN.json`

没有筛选或skip；每次整文件30用例完整执行；三个进程均退出1，原因详见下面。raw Herald不迁移、不重录。逐例毫秒与完整失败堆栈见round-N.json/log和per-case-times.json。

| 轮次 | 4-7 ms | 5-7 ms | 6-7 ms | 整文件通过/失败 | 非旧档失败 |
|---|---:|---:|---:|---|---|
| 1 | 5453 | 7424 | 9389 | 25/5 | 无 |
| 2 | 5566 | 7725 | 10122 | 24/6 | bird next-tick 5171ms，原5000ms超时 |
| 3 | 7592 | 8327 | 11151 | 25/5 | 无 |

三条获批用例每轮均通过20秒阈值，不能称性能已回到原5秒。每轮5项旧Herald失败都是`Invalid Match save: preparation-ledger-missing`，按已批准旧档政策保留，未skip。

第2轮额外失败：`restores real bird next-tick reactions and rejects changed effects, death identity and missing consumption`，原5000ms上限，实测5171ms。该用例不在本次20秒授权中，未修改、不追加重试；不能以第1/3轮通过覆盖这次失败。当前仅证实墙钟超时，不归因为偶发/OOM/环境，也不宣称整文件全绿。

| bird next-tick轮次 | 耗时ms | 状态 |
|---|---:|---|
| 1 | 4334 | passed |
| 2 | 5171 | failed |
| 3 | 4702 | passed |

## 未完成边界

- 本次目标3条20秒三轮验证已执行；文件整体仍有上述旧档失败与第2轮新增记录的bird超时，未签收、不合PR。
- 护盾5正控继续等待PR161真实锻造器路线；本轮未重跑，不变更断言。
- 原5秒失败日志、历史缓存性能报告与未采用clone证据仍保留在../history-cache/。
- 本轮只测试与文档改动，没有规则、源码、版本、digest、原始夹具或CI改动。
