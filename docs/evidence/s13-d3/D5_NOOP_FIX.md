# D5：成功空操作事务 ID 修复与指纹验证

## 起点、修复与范围

- 工作目录 `/workspace/cat`；分支 `codex/s13-mech-ownership`；任务开始 fetch 后本地/远端一致为 `f2aabd64ecfcbef3844aa821f5c9e7365409e453`，保留 Q3 来源补记，没有回退到旧 `2989cc3`。PR 原集成基线仍为 `461c8877254a865a300d60f304bc316c8df8ad11`。
- 复核独立审查指出的漏洞：无可合星的 merge-live 等成功空操作原先在追加 transactions 前提前返回；同 ID 换 acquire 可执行，独立可信日志保留空操作时恢复也会因序列不等拒绝。
- 修复：先比较资源投影是否变化，再无条件追加首次成功事务的 ID/原操作并校验；仅资源投影变化才发 ownershipCommitted。成功空操作只改变去重日志、无事件；同 ID 同操作重试返回原 state，换操作 receipt-conflict；失败路径不变。
- 新增4个回归用例：merge-live/重复 settle/满席 claim 三种成功空操作的持久化、无事件、变更重试拒绝、object/JSON 恢复；含多个空操作的独立可信混合命令日志保存恢复及后续结果一致。原有测试断言与时限未改。
- Q3 继续使用已提交的 [来源核对](Q3_SOURCE_REVIEW.md)，此次没有重复查来源。措辞明确为“用户10-19批准的项目约定（Q3）”，不冒充原版证实；Q6 不扩目录，Q7/Q8 不做。

## 代码检查与单文件测试

- `npm run typecheck`：通过，15.774s。
- 逐文件单独启动 Vitest：13 文件、239 条全部通过，累计进程墙钟 33.844s；专项23条（新增4条）。没有跑全套、删除/跳过测试或放宽校验。

|文件|通过/总数|进程墙钟 s|
|---|---:|---:|
|`tests/s13-mech-ownership.test.ts`|23/23|3.967|
|`tests/tp-shared-pool.test.ts`|14/14|2.978|
|`tests/shared-pool-cache.test.ts`|4/4|2.665|
|`tests/shop.test.ts`|22/22|0.970|
|`tests/upgrades.test.ts`|16/16|1.213|
|`tests/t10-deferred-upgrades.test.ts`|10/10|4.427|
|`tests/inventory.test.ts`|45/45|1.171|
|`tests/m8-b8-resource-provenance.test.ts`|64/64|1.638|
|`tests/g2-3-traits.test.ts`|19/19|2.126|
|`tests/g2-4a-conqueror-items.test.ts`|6/6|2.264|
|`tests/g2-4b-gold-settlement.test.ts`|2/2|2.199|
|`tests/s13-anomalies-settlement.test.ts`|4/4|3.456|
|`tests/t3-round-settlement.test.ts`|10/10|4.770|

## 本轮明确授权的 G2-4b 指纹例外

`core.autocrlf=false`、LF。参数 baseline 从 `docs/evidence/g2-4b/release-audit.json.baseCommit` 读取并核实为完整 SHA **`a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53`**，不是 PR 集成基线；release-audit 本身未改。严格依次执行：

|顺序|命令|结果|墙钟 s|
|---|---|---|---:|
|1|`node tests/fixtures/record-g2-4b-herald.cjs --write`|exit 0|59.180|
|2|`node scripts/record-g2-4b-inputs.cjs --baseline-commit=a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53`|exit 0|4.234|
|3|`node scripts/record-g2-4b-inputs.cjs --baseline-commit=a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53 --check`|exit 0|3.801|
|4|`node tests/fixtures/record-g2-4b-herald.cjs`|exit 0|51.666|

- 四步累计 118.881s。Herald write 与默认 verify 各验证5例完整原始状态、start及15 tick 保存恢复；raw 均在导入生产 restore 前导出。inputs write/check 各验证9个输出案例，contentDigest 保持 `fnv1a32-utf16:5a4c6937`。
- 最终 Herald manifest sourceSha256：`8df76f30e07ae6dfed1f2dd8f3681dbcad15161d5a65cca8d73738ad05553d59`。
- 实际生成文件差异只有 `tests/fixtures/g2-4b-herald-raw/manifest.json` 和 `docs/evidence/g2-4b/input-fixture-audit.json`：新增 owned-resources/index.ts、types.ts 源码指纹，及 manifest 对应字节数/哈希审计元数据。
- 五个 G2-4b raw 状态及 trajectory 与修复前字节完全相同；G2-3/G2-augments 两个历史 Herald 目录逐文件与起点比较不变。没有使用 verify-m8-herald --write，也没有重录其他种子路线。

## 交付与证据版本

- 本次改动文件/行：`src/simulation/owned-resources/index.ts` transactOwnership（原271附近）、`tests/s13-mech-ownership.test.ts` 新增空操作专项（50起）、接口文档42/43/64/90附近、上述两份指纹元数据、本报告与 VALIDATION 的 D5 补记。
- `git diff --check`、修改范围、历史 raw 字节核对通过；不修改规则数值、版本、digest、server/rendering/presentation。
- PR #198 原地追加提交并保留正文前两行归属，目标 integration/s13-augments，不合并、不强推。最终 SHA/远端确认及新 CI 链接于推送后写入 PR 正文和任务回报，避免文件自引用。
- [旧 CI #627](https://github.com/catfish-xn/cat/actions/runs/39198450528) success 只对应 `2989cc38353232d2f169ece6ee939b7839254c0c`，不能证明本次修复；原 Q3 文档提交为 `f2aabd64ecfcbef3844aa821f5c9e7365409e453`。本次独立评审由调度方另行安排。
