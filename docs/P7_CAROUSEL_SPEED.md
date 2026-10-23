# P7 carousel 用例性能修复

对比提交 `83fd7fa5` 与当前分支起点 `f7cc25dc`，全程离线。

| 测量 | 旧提交 | 修复前 | 仅生产缓存 | 最终修复 |
| --- | ---: | ---: | ---: | ---: |
| 目标用例（完整文件，verbose） | 2310 ms | 3241 ms | 2816 ms | 51–52 ms |

最终数值来自相关测试同时运行时的测量；目标小于 2500 ms。相对原有 5000 ms 超时，52 ms 留出约 4948 ms（约 96 倍耗时）的本机余量；CI 的实际争用仍需由 CI 复跑确认。

原因和修复：

- `opening(5)` 的冷 fixture 会让五个席位从开局真实推进到 2-4，但用例随后逐个用新初始化的状态覆盖它们，只保留手写 HP 数字。删除这段无效模拟，直接用相同 HP 初始化相同五席；原断言全部保留。
- PR9 新增的奇遇认证在共享池守恒校验路径每次重新创建上下文，并递归冻结、规范化。独立 Node CPU profile 的五席 fixture 阶段为旧版 1971 ms、新版 2993 ms；末尾五次初始化仅 46/49 ms。新版 profile 中 `freezeContent`、`canonicalContent`、`rememberFrozen` 自耗时合计约 1958 ms（含八席预热），调用链指向 `validateOpeningEncounterContext`。
- 为认证成功且经 `freezeContent` 递归冻结的对象增加 WeakMap 缓存，并绑定认证种子；不持有对象生命周期，不缓存可变或仅浅冻结的输入，不跳过席位绑定、奇遇收据或其他规则检查。补测错误/非法种子、可变对象和浅冻结对象在预热后篡改仍被拒绝。

复现测量：`npm test -- tests/p7-carousel.test.ts --reporter=verbose --configLoader=runner`。这里 `node_modules` 指向只读共享依赖，使用 runner 避免 Vite 写入 `.vite-temp`；项目配置未改。CPU profile 与构建入口保留于忽略目录 `artifacts/p7-carousel-speed/`，以 `node --cpu-prof` 运行独立打包的 helper 分段测量，不依赖 Vitest 子线程退出时导出 profile。

未改超时、断言、CI、规则数值或内容身份；未提交 Git。

验证：P7 全文件 16/16；相关奇遇与共享池 7 文件 175/175；最终 P7 与奇遇核心复测 23/23；`npm run typecheck` 通过；测试适配字节审计生成及 `--check` 通过。历史审计确认 393 个历史文件和 `tests/fixtures/g2-4b-herald-raw/manifest.json` 字节不变；内容身份仍为 `fnv1a32-utf16:35273c97`，loot/replay 为 `fnv1a32-utf16:ef359464`。

`node scripts/verify-v21-opening-encounters-epoch.cjs --write` 与随后不带 `--write` 的完整验证均为 15/15。战斗状态、事件、RNG 轨迹及 golden 未变；v21 证据只更新源码/测试指纹和执行记录。

最终 `git diff --stat`（另有本报告新文件未暂存）：

```text
 .../v21-opening-encounters/battle-start-audit.json |  2 +-
 .../consumer-byte-audit.json                       | 16 +++++++++++-
 .../v21-opening-encounters/epoch-verification.json | 30 +++++++++++-----------
 .../input-fixture-audit.json                       |  4 +--
 .../v21-opening-encounters/live-reveal-audit.json  |  2 +-
 .../v21-opening-encounters/release-audit.json      |  2 +-
 src/simulation/opening-encounter.ts                | 15 ++++++++---
 .../manifest.json                                  |  2 +-
 tests/opening-encounters.test.ts                   | 14 ++++++++++
 tests/p7-carousel.test.ts                          |  7 ++---
 10 files changed, 65 insertions(+), 29 deletions(-)
```
