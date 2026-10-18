# PR150：v10 缺失录制夹具与能力显示收尾

## 版本与范围

- PR https://github.com/catfish-xn/cat/pull/150，分支 `codex/g2-4b-new-mechanism-items`。
- 起点/核实远端：`0ad9ed77ea7ed5f5728c2c7ae31bf36cfa10f019`。
- 本轮受测代码：`e6ce0b5acb808f1c571ef9a103a9170a89f9a7ad`；后续仅追加本报告。
- 未合入额外基线。multiplayer 仍为 `1fb55af1a89f8fc7f5e7a68b44480e84da9b8ddd`。
- 规则/内容/policy 维持 v10；内容摘要维持本轮起点的 `fnv1a32-utf16:67cd0953`，不升 v11。
- Node 24.19.0 / npm 11.9.0，逐文件串行执行，没有全套命令，没有改变任何测试时限或跳过项。

## 原 CI 根因与对应修法

原 CI 是起点 0ad9ed77 的 [run 39100912944](https://github.com/catfish-xn/cat/actions/runs/39100912944)，不是本轮新代码的结果。

- 8 个 browser/touch 作业：加载 `full-match-golden.g2-4b.json` 失败。
- fast-tests：7 个 suite 因缺 golden/recorded-states 无法加载，另有 3 条断言失败（Voidspawn 显示缺定义、两个硬编码66）；3815 条通过。没有将旧 CI 红说成当前已绿。

### 1. 原始存档与 golden

执行仓库现有生成器：

`node scripts/record-g2-4b-release.cjs --baseline-commit=0ad9ed77ea7ed5f5728c2c7ae31bf36cfa10f019`

exit 0，生成：

- `tests/fixtures/g2-4b-recorded-states/cannon.json.gz`，67 个完整公开命令路线检查点。
- `tests/fixtures/g2-4b-recorded-states/sniper.json.gz`，67 个检查点。
- `tests/fixtures/m5/full-match-golden.g2-4b.json`，cannon/sniper/mage/sniper-caitlyn 四路线，均33场且胜利。
- `tests/g2-4b-content-baseline.json`。
- `docs/evidence/g2-4b/release-audit.json`，完整源文件摘要、旧/新字节摘要、首差异和独立经济账本结果。

生成器对两份原始存档的全部检查点执行生产序列化、对象恢复、文本恢复及再序列化字节相等检查。没有手写运行状态或替换黄金结果。四路线的命令首次差异、事件首次差异均为 null。

当前 golden SHA256：`f815c9ea0d5617b1033979cca1203f97f6d1930d7667559bd0617ae5a5626017`；cannon gzip：`8252249a0cfd0374bfd0b7c71cb3644e1b783410a021b2600884832163eec472`；sniper gzip：`fb9e86d22c29f3977336532a2e6c3e5b968432fbe90a5bac2e1ad9dc7447622f`。

`tests/m8-content-equivalence.test.ts:3` 恢复引用本次真正生成的 g2-4b baseline。

### 2. v10 集成候选身份的精确约束

用户明确本轮不升版本。原生成器及 opening-random 测试要求 rules/content 版本均区别于旧 v10，这在当前批准范围内无法成立，因此做下列显式适配：

| 原条件 | 本轮条件 | 保留的安全边界 |
|---|---|---|
| 新 rules/content 必须不等于旧版本 | 精确等于 `s13-g2-3-v10` / `s13-14.24b-g2-3-v10`，并等于旧 v10 | 不任意接受其他版本；最终 v11 迁移仍待后续 |
| 新 contentDigest 必须不同 | 保持严格不同，并等于真实 createMatch 及当前 CONTENT_DIGEST | 不抹除或伪装新内容身份 |
| 只替换旧 rules/content 字符串也必须拒绝 | 更早 opening 旧版本仍逐字段拒绝；旧 G2-3 的不同 digest 拒绝；相同 v10 字符串赋回当前状态须恢复全等 | 相同值不是篡改，不把它伪称旧档；完整旧原始存档在对象/文本入口仍拒绝 |

改动位于 `scripts/record-g2-4b-release.cjs:19`、`tests/opening-random-identity.test.ts`。未改任何生产恢复校验。

### 3. Voidspawn 能力显示

`src/simulation/ability-display.ts:1,16`：像既有召唤物一样，从已经存在的 `G24_VOIDSPAWN_ABILITIES` 精确查找显示来源。显示名称“虚空生物普攻”和空变量表都来自该内容定义，没有猜数值或新增玩法。非法ID仍拒绝。没有改 rendering/server/presentation 文件。

### 4. M5 数量断言

`tests/m5-combat.test.ts`、`tests/m5-content.test.ts`：不再硬编码66或67，改用正式英雄、形态、召唤物和虚空生物定义表的 abilityId 并集，与最终能力表做精确集合相等；逐单位核对 ability.championId。所有星级、变量整数性、序列化及原有来源断言保留。这比只改一个数字更能发现遗漏或多注册条目。

### 5. opening 身份链的录制依赖

原有 `record-g2-4b-inputs.cjs` 要求独立的 g2-4b Herald 目录，本轮最初运行因此报缺 manifest。依赖补齐后重新执行，不掩盖首次日志：

- `node tests/fixtures/record-g2-4b-herald.cjs --write`：生成新的 g2-4b 目录，不覆写旧目录，5 条真实路线生产恢复及续战通过。
- `node scripts/record-g2-4b-inputs.cjs --baseline-commit=0ad9ed77ea7ed5f5728c2c7ae31bf36cfa10f019`：exit 0。
- 同命令加 `--check`：exit 0，9 cases。

这补齐 `docs/evidence/g2-4b/input-fixture-audit.json`、当前 C19 输入和 B8 指纹；历史字节证据由脚本核对。

## 指定 g2-3 指纹命令：真实结果与未完成项

按要求原顺序、不带 Herald --write：

1. `node tests/fixtures/record-g2-3-herald.cjs`：**exit 1**。5份原始输入都通过生产恢复与15tick续战，但随后 manifest 源码摘要比较失败，原文：

   `AssertionError [ERR_ASSERTION]: Regenerated manifest.json differs; review the cause before explicitly regenerating with --write`

   逐项对比记录的 sources 与当前文件，唯一不同的是 `src/simulation/ability-display.ts`：
   - 原 SHA256 `846e5218fcaa57fd0d6132923c3c3f872de90b88613700bd0d953a19a7311204`
   - 当前 SHA256 `c903ed0f463a1cf5d3fc382c069e42da19f27e71ed969e4bb5f813b7d8b0c77d`

   没有手改 manifest hash，没有调用 g2-3 Herald --write；整个旧 g2-3 Herald 目录相对起点未变。不能把这一验证说成通过。若需要关闭此项，需要后续明确允许按生成器更新当前 g2-3 manifest。
2. `node scripts/record-g2-3-inputs.cjs`：exit 0。
3. `node scripts/record-g2-3-inputs.cjs --check`：exit 0，9 cases。此成功不替代前一条 manifest 的失败。

`tests/fixtures/g2-augments-herald-raw/` 与 origin/multiplayer 逐字节一致。未使用 verify-m8-herald-fixtures.cjs --write。

## 自行决定

- 用现有录制器在明确的 v10 集成候选身份下生成真实结果，不提前升 v11。
- 补齐 opening-random 实际依赖的新 g2-4b Herald 与 input-audit，保留原 g2-3 及受保护历史目录。
- 数量检查换成精确的单位/能力集合关系，非简单更改67。
- 对无写入权限关闭的 g2-3 manifest 验证保留失败，不伪造新摘要。

## 发布状态

平台 GitHub 写入限制尚未解除，未绕过，也未重复试推；交付增量 bundle。远端是否更新以交接时 ls-remote 为准。
新代码尚无 GitHub CI，浏览器 CI 必须由收到本包后的真实运行确认；不把本机相关测试当作9个 CI作业全绿。PR保持未合并。

## 固定代码相关测试结果

共 10 个文件，422 条通过 / 0 条失败 / 0 条跳过，逐文件用时总计 297.160 秒。

| 文件 | 通过 | 失败 | exit | 总耗时（秒） |
|---|---:|---:|---:|---:|
| tests/g2-2-ability-display.test.ts | 70 | 0 | 0 | 0.814 |
| tests/m5-combat.test.ts | 48 | 0 | 0 | 1.91 |
| tests/m5-content.test.ts | 9 | 0 | 0 | 1.125 |
| tests/m8-content-equivalence.test.ts | 138 | 0 | 0 | 16.773 |
| tests/opening-random-identity.test.ts | 140 | 0 | 0 | 19.628 |
| tests/m5-route.test.ts | 8 | 0 | 0 | 38.079 |
| tests/m6-integration.test.ts | 3 | 0 | 0 | 45.128 |
| tests/m6-integration-mage.test.ts | 2 | 0 | 0 | 54.489 |
| tests/m6-integration-sniper.test.ts | 2 | 0 | 0 | 59.652 |
| tests/m6-integration-sniper-caitlyn.test.ts | 2 | 0 | 0 | 59.562 |

每条命令为 `npm test -- <文件> --maxWorkers=1 --reporter=json --outputFile=<日志JSON>`，没有改文件内时限。`npm run typecheck` exit 0。

这些测试通过不等于上述 Herald manifest 校验通过；该命令失败单列保留。原始 stdout/JSON、所有生成命令日志在交接 ZIP 的 logs/。
