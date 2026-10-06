# M6 本地 heap 独立诊断

本文件记录 B/D 对 E 本地 preview 两份 heap snapshot 的独立解析。仅新增诊断证据，未修改生产源码、冻结 Goal 或预算，未另起浏览器。

## 身份和原始证据

- 运行 SHA：`b84b18bd77e2ff7c66e7663279ff6b5f68184581`；启动 dirty 为空。
- 前后 source fingerprint：`5ee323030b52dcdc717782dc9e271325e8a6b5436dee64a2edbbe7ea0c31a7d7`（一致）。
- 模式：preview/cannon；Node `v24.21.0`；Chromium `153.0.8010.12`；平台 `linux`。
- 硬件：Intel Xeon Processor (Skylake, IBRS)，4 逻辑 CPU，内存 8322404352 B。
- 运行耗时：331 s；`m6Lifecycle.heapDiagnostics=true`，整体 `passed=false`（随后公开随机种子显示断言失败）。
- 原始目录：`artifacts/m6-heap-preview/`，属诊断 artifact，不是最终验收证据。

| 文件 | 字节数 | SHA256 |
|---|---:|---|
| `before.heapsnapshot` | 24767636 | `3fb232766b9374d64de0f93011cbb356dc3d18db65baba200c3d8535ed444997` |
| `after.heapsnapshot` | 24366723 | `be6f934f6d76c73de7a1e2ff8d489abe87ab519464862493ed51c1f147c27f22` |
| `manifest.json` | 159087 | `f046f4b069422eec8bf052acca218736b1d93fca5bd5c87717d8aa78e08b604c` |

## 方法和实际数量

以属性集合识别压缩构建中的对象，不依赖构造函数名：MatchSession 使用 matchState/combatLedger/pauseReasons/listeners，BattleHistory 使用 runId/completed/current，PlaybackSession 使用 record/state/checkpoints/accumulator/playing。沿快照非 weak 边寻找代表性最短强根路径；这不是 dominator 或完整 retained-size 计算。Python 解析器保存于 `work/m6-heap-readonly-analysis.py`，机器结果为原始目录的 `before-analysis.json`、`after-analysis.json`。

| 对象 | before | after |
|---|---:|---:|
| MatchSession | 1 | 1 |
| BattleHistory | 1 | 1 |
| PlaybackSession | 0 | 0 |
| MatchApplication | 1 | 1 |
| BoardScene | 1 | 1 |
| PhaserText | 64 | 64 |
| PhaserContainer | 7 | 7 |
| PhaserTexture | 68 | 68 |
| BattleRecord | 4 | 4 |
| CapturedSave | 1 | 1 |
| SaveCoordinator | 1 | 1 |
| detached native canvas | 70 | 70 |
| detached native img | 3 | 3 |

baseline 的 MatchSession、BattleHistory、SaveCoordinator 对象 ID 在 after 全图均已不存在；BoardScene 同一实例仍存。after 唯一会话的强路径为 Window.__CAT_DEBUG__.read → 闭包 this → BoardScene.session；History 和 Coordinator 分别从 BoardScene.application.history/coordinator 可达。Coordinator.pending/running 均为 null，History.current 为 null，未识别到存活的 PlaybackSession。

抽样 detached canvas 路径为 Window.Phaser.Display.Canvas.CanvasPool.pool[index].canvas。这些是离屏绘制对象，detached 标签本身不意味着泄漏。本地样本中数量未增加。

## 数值口径和边界

正式口径 Runtime.getHeapUsage.usedSize 在本次诊断中由 11,148,232 增至 11,324,076 B，差值 +175,844 B；监听器 78→78，RAF 1→1；保持原先两次预热与 30 次实际新局／导入／回放周期。

快照所有节点 self_size 求和为 22,591,248→22,920,165 B（+328,917 B），包括 native 节点，**不是** usedSize，不能替代 Goal 的 1 MiB 判据。节点数 276,713→272,105。分类变化包括 code +145,552 B、native +213,077 B、object +1,012 B、string −38,228 B。native 命名增长包括 WeakArrayList +48,288 B、PerformanceLongAnimationFrameTiming +27,280 B、DOMRectReadOnly +23,296 B、ScriptTimingInfo／LargestContentfulPaint 各 +17,544 B；没有据此将 CI 失败解释为机器噪声。

结论仅限：此本地诊断样本未见已识别旧会话／History／Playback 或 Phaser 对象积累，旧会话的强对象已释放。它不证明不存在所有泄漏，不解释 CI41 的具体超标原因，也不证明旧失败已修复。

**保留 CI41 clean 2dc5c44 preview 的真实 1 MiB 超标失败。** 当时断言先于诊断落盘，未保留准确超标值，不能补造。后续 runner 仅调整为先写诊断再做同一断言，未放宽阈值、预热次数或周期。最后同一干净 SHA、正常 runner、默认冻结预算的完整 CI 才负责最终验收；本次 heapDiagnostics 样本不得替代。
