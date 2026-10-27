# B5-32/33/34 幸存者结算事件接线（h4w）

基线：`codex/v25-h4`，HEAD `db7c3a153dfbb06cf37a63a5e7d5f336c91a5e54`。在上轮未提交改动上续做；本单不提交、不合并。服务器目录修改依据本单事件接线授权。

幸存者在整桌淘汰确定后的 60 金、唯一收据及 `mechanicGranted` 现在随同一次席位发布送出。事件由规则层复用既有单人事件生成与编号函数产生；服务器不计算获奖条件、金币或事件序号。B5-32/33 的既有入轮付款和单人路径不增加分支。

全部生产代码改动调用点如下；除表中四个文件，没有修改其他生产代码。

| 文件 / 调用点 | 变化及调用关系 |
| --- | --- |
| `src/simulation/match.ts`：`recordAugmentSettlementTable(state, seats): MatchStep` | 新增公开适配入口；依次调用既有 `recordAugmentTable(state, 'settlement', seats)`、`mechanicGrantEvents(before, after)`、`stampMatchEvents`。收据差集生成事件，推进 `nextMatchEventSeq`。未到当前轮结算、无历史、已记录该轮结算表均原引用返回、无事件。 |
| `src/server-entry/index.ts`：Match 导出表 | 重新导出上述入口，房间仅从此公共入口导入。 |
| `src/server/room/augment-history.ts`：`recordRoomSettlementTable` | 将原来的直接 `recordAugmentTable` 调用换成上述公共入口；把返回事件追加到同一 `seatRevision` 的原结算事件，不覆盖原事件。 |
| `src/server/net/server.ts`：`createGameServer` | 增加按 `SeatSession` 弱引用保存的 room / receiptId 推送记录；凭证重连复用原 session。 |
| 同文件：`send` | 新增可选 `onSent` 回调；关闭连接、背压拒绝或同步发送异常均不登记成功。其余调用方不需改签名。 |
| 同文件：`pushRoom` | 对 `seatPushEvents` 返回的 `mechanicGranted` 按 receiptId 去重，包括同包重复与跨 revision 重复；`send` 成功接受写入后登记。其余事件保留。 |

既有上游调用点 `Room.commitSettlement` 不改：仍先确定整桌淘汰和名次，再调用 `recordRoomSettlementTable`，最后 `replace` 原子发布。流式 `commitStreamSteps` 与旧式结算均经过此入口。`seatPushEvents` 白名单本已包含 `mechanicGranted`，无需再修改投影文件。

公开签名、输入信任边界、幂等返回和异常边界已写入 `MULTIPLAYER_CONTRACT.md` 的“B5-34 结算事件接线”节；`AUGMENT_HISTORY_DESIGN.md` 更新调用约定，`UI_REQUESTS.md` 将该请求标记完成。没有新增命令、失败 reason 或 wire 字段。

## 验收证据

`tests/server/batch5-survivor-room.test.ts` 覆盖旧式与生产流式调度各两条真实房间路径，只用公开选择、出售、时钟推进和真实战斗。测试子类记录 `commitSettlement` 的参数后原样调用父类方法，不伪造结果、HP、排名或结算状态。

- seed=8，s4 在 2-1 选择幸存者；s0/s1/s2 通过真实出售命令空场作战，到第 24 轮（4-7）同轮淘汰，s4 存活，精确增加 60 金、一张收据、一个带 `domain` / `eventSeq` 的事件；原结算事件顺序保留。旧式路径另验证逆序战斗结果仍得相同结算。
- 另一条路径让 s4 也经真实出售和战斗，在第 25 轮（5-1）与 s0/s1/s2 一起出局，不发幸存者金币、收据或事件。每个前置回合均断言未提前付款。
- 真实房间在目标回合结算前断线，结算后反复重连；Match、共享池、seatRevision、原事件引用不变，不再次发布新增授予。重复提交返回 `duplicate-settlement` 且 RoomState 原引用不变。
- 从真实结算状态取得独立服务器 authority，分别做对象 / JSON 存档恢复；恢复后再次记录整桌结算无事件、无资源变化。额外金币、事件序号和删除结算历史的篡改都拒绝。
- 重复读取回放及推进下一轮均不再次付款或发布授予。旧受控夹具保留其原断言；“同轮淘汰”的主要验收证据已由上述真实路径提供。

`tests/server/net/batch5-survivor-push.test.ts` 的三个用例使用内存 socket，只替换传输，不监听端口；解析、认证、session 恢复和推送使用真实服务器代码。已覆盖同包重复、跨 revision 重发、已发送后重连、断线期间未发送的事件首次恢复发送、发送异常后重连补发，且不吞掉非授予事件。该文件的事件封套是传输夹具；金币和真实战斗证据来自前述房间用例，不把传输夹具称为真实战斗。

测试结果与命令见下方最终记录。

## 身份、范围与限制

`content-identity-constants` 测试实际重算内容与掉落摘要，production-size 测试比较原 bundle / 压缩 bundle 的状态、事件、RNG 和恢复结果。摘要保持 `content=fnv1a32-utf16:73dd7813`、`loot=fnv1a32-utf16:77867d63`；无需改身份常量或 production-size 预期。未重录 epoch/golden，未改玩法或数值。

本次修改的两个 `src/server` 文件及新增行没有 `setTimeout`、`Date.now`、`performance.now` 或独立单词 `window`。对整个 `src/server` 扫描仍发现 HEAD 已有例外：`room/real-clock.ts` 的计时适配与 `net/test-client.ts` 的测试客户端超时，共 8 行；仓库原有 `tests/server/purity.test.ts` 明确豁免它们。本单仅授权事件接线，未改动这两个旧适配器，也不宣称整个目录已清零。

推送成功指 socket 接受写入，当前协议没有客户端事件 ACK。去重记录保留在同进程 session 中；系统没有跨进程完整 Room/session 存档入口。本单验证的是权威 Match 对象 / JSON 往返且不重新生成事件，不新增持久消息队列，也不承诺断线期间已被后续 revision 替换的瞬时事件补发；已结算金币和收据仍在权威状态中。

## 最终验证记录

只运行相关测试；最终覆盖 12 个文件、173 个不重复用例，全部通过。其中新房间用例 114 项、传输用例 3 项，其余相关回归 56 项（含 production-size 6 项和服务器纯度 4 项）。执行分批进行：先前 11 文件 112 项通过；扩展流式路径后，房间文件独立重跑 114 项全部通过，纯度文件 4 项通过。未运行全套、构建或浏览器验收，未删断言、未增加或放宽测试超时。

普通 `npm test` 初次因共享只读 `node_modules/.vite-temp` 无法写入而在加载配置时退出。后续使用 `--configLoader runner` 和仅在 gitignore `artifacts/` 内的临时配置，继承原项目配置及超时，去掉与本次测试无关的浏览器全局启动，将缓存放入 `/tmp`。新流式用例初跑时结算观察器未保留跨测试调用记录；改为上述透传子类后，保留全部精确比对断言并重跑通过。

完整定向文件清单及可复现命令：

```bash
npm test -- --configLoader runner --config artifacts/vitest-h4w.config.ts --maxWorkers 2 \
  tests/server/batch5-survivor-room.test.ts \
  tests/server/net/batch5-survivor-push.test.ts \
  tests/augment-pool-batch5-h4.test.ts \
  tests/augment-pool-batch5-h4-income.test.ts \
  tests/augment-pool-batch5-h4-seed.test.ts \
  tests/augment-pool-batch5-h4-survivor.test.ts \
  tests/server/net/dedupe-session.test.ts \
  tests/server/mechanic-failed-push.test.ts \
  tests/server/mel-save-push.test.ts \
  tests/content-identity-constants.test.ts \
  scripts/tests/production-size.test.ts \
  tests/server/purity.test.ts
npm run typecheck
git diff --check
```

最终 `npm run typecheck`（`tsc --noEmit`）通过，`git diff --check` 通过。工作区共 10 个改动/新增文件（4 个生产代码、2 个测试、4 个文档），无素材或生成物纳入改动；HEAD 未变化，未提交。
