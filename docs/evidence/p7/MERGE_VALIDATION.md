# PR #100 合并验收

基线：`multiplayer@cf75fbc2cb0330044e4382c862684973385461f3`，包含 #94 G2-1 与 #98/#105 G4。原 PR head `7efc367f426f80f7fc06d619c238d03a47e420aa`；正式验收源码提交 `2ec04b3c01cd6c48f3a7e96c84bd4ada1bbee821`。后续验收记录仅改文档。

## 冲突与缓存

十处冲突已解决：保留 P7 选秀状态、排队单位、资源收据和离线拒绝选秀恢复校验；保留 #98 的 parsed JSON admission、equalValidatedContent、纯阵容编译缓存、不可变数据共享。P7 重复的 equalParsedData 与缓存补丁已去除；serialization.ts 相对集成分支仅新增 carousel 离线恢复拒绝条件。fast/timing 的上游结构与预算保持不变。

公共路线消费者使用新的 P7 夹具；G2/P3/T13 原件仍为历史证据，身份测试按 G2→P7 链校验。没有替换或弱化完整状态、命令、事件、RNG 比较。

## 身份与字节证据

合并树 CONTENT_DIGEST 重算为 `fnv1a32-utf16:1ce135cf`，前一正式身份为 G2 的 `fnv1a32-utf16:70a355f3`（P7 草稿 `f95bdcf8` 已被合并树计算值替代）。LOOT_REPLAY_DIGEST 维持 G2 已发布的 `fnv1a32-utf16:65a85ecd`，未修改 loot 内容或其身份。rules/content version 仍为 `s13-g2-1-v1` / `s13-14.24b-g2-1-v1`，schema/save/replay/protocol 仍为 7/3/3/3。

`node scripts/record-p7-release.cjs` 从真实公开命令重跑四条路线；全部胜利，四条命令轨迹与各轮事件 hash 和 G2 原档完全相同。cannon/sniper 共 134 状态逐字段只差显式 contentDigest，文本和对象 restore 全等，serialize→restore→serialize 字节相等。

- cannon 原始/新 JSON 都为 7,476,249 字节，首差异偏移 5446。
- sniper 原始/新 JSON 都为 7,660,760 字节，首差异偏移 5446。
- 两份录制仅做显式身份替换后，JSON 字节全等；完整旧新 SHA256 见 [release-audit.json](release-audit.json)。golden 97,179→97,238 字节，记录了新身份、各轮状态 hash 与说明文字变化。
- `node scripts/verify-m8-herald-fixtures.cjs --write` 从公开命令重生成五份 Herald raw，在导入生产 restore 前先导出原始字节；全部恢复全等，开战及 15 tick 往返通过。
- C19 重新 compileBattle，五份 Herald 与 C19 相对 G2 原档逐字段仅身份变化；6 份旧新字节数、SHA256 和首差异偏移见 [fixture-byte-evidence.json](fixture-byte-evidence.json)，由 `node scripts/record-p7-fixture-evidence.cjs` 验证生成。
- 未执行旧树或单 worker 对照轮。所有历史 G2 字节证据保留。

## 正式验收

环境：Node 24.19.0、npm 11.9.0，4 CPU / 16 GiB 配额。按顺序各执行一次原命令；fast 使用默认 threads 多 worker，timing 使用上游串行隔离配置；允许测试所需本地监听。没有 name filter、skip、预算放宽或单 worker fast。

| 命令（各一次） | 结果 | 耗时 |
| --- | --- | --- |
| `npm run typecheck` | 通过 | 15.62 s wall |
| `npm run test:server-entry` | 通过，136 输入 | 2.71 s wall |
| `npm test` | 218/224 文件、2740/2747 用例通过；7 超时失败 | 839.94 s Vitest / 840.82 s wall |
| `npm run test:timing` | 6/6 文件、32/32 用例全部通过 | 224.97 s Vitest / 225.82 s wall |

### fast 未清零

本轮完整 fast 的七条错误均为 Test timed out，未增加预算、未过滤、未补跑或做对照轮：

| 文件 / 用例 | 本次实际耗时 | 原预算 |
| --- | --- | --- |
| m6-integration-sniper-caitlyn / completed battle playback | 218009 ms | 180000 ms |
| m8-b7-audit-vectors / 5-7 restore | 22617 ms | 20000 ms |
| server/room / choice window | 5370 ms | 5000 ms |
| m8-b5-equipment-history / forged historical level | 5433 ms | 5000 ms |
| m8-content-equivalence / cannon | 6954 ms | 5000 ms |
| m8-content-equivalence / sniper | 7392 ms | 5000 ms |
| server/g5-battle-ranking / one row per unit | 6158 ms | 5000 ms |

P7 新增用例没有报告失败；但这不替代完整 fast 零失败门禁。按本轮“各一次、不做对照轮”限制保留完整失败结果，尚不能转 Ready。后续应由测试性能负责人定位默认多 worker 下的超时，不能仅凭当前记录断言宿主、GC 或某个缓存就是原因。


完整运行日志摘要及 SHA256 见 validation-results.json。
