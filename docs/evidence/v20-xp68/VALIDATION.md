# v20-xp68 验证（2026-10-22）

基线 `2de5e26d088e4e86032bf571d51941c9b0ecd12f`，父 epoch `v20-chem-baron`，Node 22.17.0。离线运行，无 Git 写操作，无界面或素材修改。

- `npm.cmd run typecheck`：退出码 0。录制中间曾因尚未生成的新 JSON 导入而失败，全部夹具生成后重新执行通过。
- 相关专项：7 文件、228 项通过，0 失败。包括 progression、match-economy、m5-economy、t3-round-settlement、t7-bot-policy、t11-opening-xp、m8-b6-opening-economy。
- `node scripts/verify-v20-xp68-epoch.cjs`：11 步均退出码 0，[完整步骤](epoch-verification.json)。四路完整 33 战胜利 golden、134 个 text/object 恢复检查点、B8/C19、五组 Herald、transfer 与 live reveal 均真实重录并核验。
- 历史检查：253 文件与基线原始 LF 字节一致，受保护 `tests/fixtures/g2-4b-herald-raw/manifest.json` 的 SHA-256 仍为 `b39c443bedb12f205230ce0ffbf6a93c2184d73d73cb92ee46eaadf08e086a22`。
- [独立 digest 比较](digest-comparison.json)：CONTENT `2d1eafb8 → 3512a559`，LOOT_REPLAY `7fd08770 → d18f985e`，两版均从完整根重算并与生成常量相等。
- [最终源码检查](final-source-check.json)：release、输入与 live reveal 审计各 363 项源码哈希、Herald manifest 的 355 项源码哈希均与当前字节一致。
- cannon/sniper/mage 的命令及战斗事件轨迹均与父版相同；sniper-caitlyn 首个命令差异为索引 221（较早从 buyXp 转为 reroll），首个战斗事件差异在 round 32。实际差异保存在 [release-audit](release-audit.json)，未归一化身份或改历史录制。

Windows PowerShell 阻止执行 `npm.ps1`，因此使用同一安装的 `npm.cmd`。默认 Vitest 配置打包受共享依赖路径的 esbuild 访问权限阻断，采用原配置的 `--configLoader runner`；未改测试断言、超时或项目配置。

fast 四分片均已完整执行一次。每片一个 worker、顺序运行；未过滤用例、未新增跳过、未修改超时。原始完整结果保留，不用修复后的单跑覆盖：

```powershell
node node_modules/vitest/vitest.mjs run --project fast --configLoader runner --maxWorkers=1 --shard=i/4 --reporter=json --outputFile=artifacts/v20-xp68-validation/fast-i.json
```

`i=1..4`。原始日志与 JSON 位于忽略目录 `artifacts/v20-xp68-validation/`，分类如下。


| 分片 | 文件 | 通过 | 失败 | 跳过 | 秒 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 122 | 1428 | 9 | 0 | 538.88 |
| 2 | 122 | 1615 | 12 | 1 | 737.64 |
| 3 | 121 | 1842 | 2 | 0 | 1398.78 |
| 4 | 121 | 1545 | 4 | 0 | 530.78 |

完整四片合计 **486 文件、6430 通过、27 失败、1 跳过**；原始机器清单和逐项分类见 [fast-results.json](fast-results.json)。四片文件集合互不重复。

真实规则相关失败为生命周期测试仍使用旧边界 `[9,83,1]`；已改为 `[9,67,1]`，原 requested/applied、满级与结果断言不变，整文件 12/12 单跑通过。另将经济输入校验的非法 XP 改为新的精确阈值 68，相关文件单跑通过。最终源码再次 typecheck，退出码 0。

剩余 **26 项环境失败、0 项计时失败、0 项未解决规则断言失败**。3D 路径类环境错误明确为 `realpath <home>`（含短名 `ADMINI~1`）的 EPERM；相关工具/测试源码未修改。1 项跳过来自原有 Windows 文件符号链接 EPERM 分支（tests/assets3d-paths.test.ts:129-130），不计为通过。环境受限项需在有目录访问及符号链接权限的环境复跑；完整 fast 不能计为全绿。

环境失败文件：

| 文件 | 失败项 |
| --- | ---: |
| `tests/assets3d-compress.test.ts` | 7 |
| `tests/assets3d-fx-pilot.test.ts` | 1 |
| `tests/assets3d-build-root.test.ts` | 12 |
| `tests/explorer-bracer-restore-pressure.test.ts` | 2 |
| `tests/assets3d-pack-root.test.ts` | 4 |

`explorer-bracer-restore-pressure` 的两个用例在 esbuild 编译阶段即被 `Cannot read directory ../../..: Access is denied` 阻断，尚未执行压力数值、耗时或 RSS 门槛；不能记作这些门槛已通过。没有为绕过限制更改压力测试。

并行 PR #382 的同步要求见 [XP68](../../XP68.md)：后合的一方需保留双方规则，重定当前 epoch/父链后完整重录，不能拼接两套摘要或改历史字节。
