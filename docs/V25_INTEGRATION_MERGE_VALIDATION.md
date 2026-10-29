# V25 联机集成冲突与验证记录

冲突文件来自各合并提交消息；处理方式依据合并提交和两个父提交的文件对象比较。相同表示结果字节与该父版本相同，不代表能够还原当时的操作步骤；“综合修改”仅表示结果不同于两个父版本，不能推断每处意图。无记录不等于证明无冲突。

## 各次合并的冲突文件和结果

### 'origin/codex/v25-augment-history' → claude/v25-int-a（71ff1b8a）

提交信息未记录冲突。

### 'origin/codex/v25-b5a' → claude/v25-int-b（d03835b5）

- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`

### 'origin/codex/v25-h1' → claude/v25-int-a（f2d896e4）

- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`

### 'origin/codex/v25-s6c' → claude/v25-int-c（ffa0c7a6）

- 综合修改或删除：`docs/S13_RULES_GAP.md`、`tests/m5-content.test.ts`
- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`

### 'origin/codex/v25-s1a' → claude/v25-int-b（95797827）

- 综合修改或删除：`docs/S13_RULES_GAP.md`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augment-stage-bans.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/validate-content.ts`、`tests/fixtures/m5/oracle.g2.cjs`
- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`

### 'origin/codex/v25-h3' → claude/v25-int-a（4147faf1）

- 综合修改或删除：`docs/S13_RULES_GAP.md`、`src/simulation/augment-pool-grants.ts`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/shared-pool.ts`、`src/simulation/validate-content.ts`、`tests/augment-history.test.ts`、`tests/fixtures/m5/augment-rewards-oracle.cjs`、`tests/fixtures/m5/oracle.g2.cjs`
- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`

### 'origin/codex/v25-s8a' → claude/v25-int-c（fc9ff1a6）

- 综合修改或删除：`docs/S13_RULES_GAP.md`、`src/simulation/augment-pool-grants.ts`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/shared-pool.ts`、`src/simulation/validate-content.ts`、`tests/fixtures/m5/oracle.g2.cjs`、`tests/m5-oracle-augment-ledger.test.ts`
- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`

### 'origin/codex/v25-s1b' → claude/v25-int-b（79b0fa89）

- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`
- 综合修改或删除：`src/simulation/augment-offers.ts`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/match.ts`、`src/simulation/validate-content.ts`、`tests/augment-stage-bans-audit.test.ts`、`tests/fixtures/m5/oracle.g2.cjs`、`tests/m5-oracle-augment-ledger.test.ts`

### 'origin/codex/v25-s8b' → claude/v25-int-c（e9ac9ded）

- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`
- 综合修改或删除：`src/simulation/augment-pool-grants.ts`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augment-stage-bans.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/match.ts`、`src/simulation/shared-pool.ts`、`src/simulation/validate-content.ts`、`tests/augment-stage-helpers.ts`、`tests/fixtures/m5/oracle.g2.cjs`、`tests/g2-augments-choice.test.ts`、`tests/m5-oracle-augment-ledger.test.ts`

### 'origin/codex/v25-h4' → claude/v25-int-a（b9b83d05）

- 综合修改或删除：`docs/S13_RULES_GAP.md`、`src/simulation/augment-history.ts`、`src/simulation/augment-pool-grants.ts`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augment-stage-bans.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/match.ts`、`src/simulation/shared-pool.ts`、`src/simulation/validate-content.ts`、`tests/fixtures/m5/oracle.g2.cjs`、`tests/m5-content.test.ts`
- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`

### 'origin/codex/v25-s3a' → claude/v25-int-b（cbdbc568）

- 综合修改或删除：`docs/S13_RULES_GAP.md`、`src/simulation/augment-pool-grants.ts`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augment-stage-bans.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/match.ts`、`src/simulation/shop-history.ts`、`src/simulation/validate-content.ts`、`tests/augment-stage-bans-audit.test.ts`、`tests/fixtures/m5/oracle.g2.cjs`、`tests/m5-oracle-augment-ledger.test.ts`
- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`

### 'origin/codex/v25-s8c' → claude/v25-int-c（3c7468af）

- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`
- 综合修改或删除：`src/simulation/augment-pool-grants.ts`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augment-stage-bans.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/match.ts`、`src/simulation/shared-pool.ts`、`src/simulation/validate-content.ts`、`tests/augment-stage-bans-audit.test.ts`、`tests/fixtures/m5/augment-rewards-oracle.cjs`、`tests/fixtures/m5/oracle.g2.cjs`、`tests/m5-oracle-augment-ledger.test.ts`

### 'origin/codex/v25-h5' → claude/v25-int-a（bc58763e）

- 综合修改或删除：`docs/MATCH_CONTRACT.md`、`docs/S13_RULES_GAP.md`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augment-stage-bans.ts`、`src/simulation/content/augments.ts`、`src/simulation/validate-content.ts`、`tests/fixtures/m5/oracle.g2.cjs`
- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`

### 'origin/codex/v25-s11a' → claude/v25-int-c（baa5784c）

- 综合修改或删除：`docs/S13_RULES_GAP.md`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augment-stage-bans.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/validate-content.ts`、`tests/augment-stage-helpers.ts`、`tests/fixtures/m5/oracle.g2.cjs`
- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`

### 'origin/codex/v25-s3b' → claude/v25-int-b（8c5d8cd4）

- 综合修改或删除：`docs/S13_RULES_GAP.md`、`src/simulation/anvils.ts`、`src/simulation/augment-pool-grants.ts`、`src/simulation/b8-restore.ts`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augment-stage-bans.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/resource-provenance.ts`、`src/simulation/shared-pool.ts`、`src/simulation/shop-history.ts`、`src/simulation/validate-content.ts`、`tests/augment-stage-helpers.ts`、`tests/fixtures/m5/augment-rewards-oracle.cjs`、`tests/fixtures/m5/oracle.g2.cjs`
- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`

### 'origin/codex/v25-s3c' → claude/v25-int-b（1858a629）

提交信息未记录冲突。

### 'origin/codex/v25-dynamic-values' → claude/v25-int-c（53c69f3d）

- 综合修改或删除：`docs/S13_RULES_GAP.md`

### 'origin/codex/v25-h6' → claude/v25-int-a（b40ce329）

- 综合修改或删除：`docs/S13_RULES_GAP.md`、`src/simulation/augment-history.ts`、`src/simulation/augment-pool-grants.ts`、`src/simulation/b8-restore.ts`、`src/simulation/combat-input.ts`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augment-stage-bans.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/match.ts`、`src/simulation/round-settlement.ts`、`src/simulation/shared-pool.ts`、`src/simulation/strategy-snapshot.ts`、`src/simulation/two-sided-snapshot.ts`、`src/simulation/validate-content.ts`、`tests/augment-stage-bans-audit.test.ts`、`tests/augment-stage-helpers.ts`、`tests/fixtures/m5/oracle.g2.cjs`、`tests/m5-oracle-augment-ledger.test.ts`
- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`

### 'origin/codex/v25-s3d' → claude/v25-int-b（e559f7c1）

- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`
- 综合修改或删除：`src/simulation/augment-acquisition.ts`、`src/simulation/augment-pool-grants.ts`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augment-stage-bans.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/shared-pool.ts`、`src/simulation/validate-content.ts`、`tests/augment-stage-bans-audit.test.ts`、`tests/fixtures/m5/augment-rewards-oracle.cjs`、`tests/fixtures/m5/oracle.g2.cjs`、`tests/m5-content.test.ts`

### 'origin/claude/v25-int-b' → claude/v25-integration（e624b80f）

- 综合修改或删除：`docs/MATCH_CONTRACT.md`、`docs/S13_RULES_GAP.md`、`src/simulation/augment-offers.ts`、`src/simulation/augment-pool-grants.ts`、`src/simulation/b8-restore.ts`、`src/simulation/carousel.ts`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augment-stage-bans.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/free-rerolls.ts`、`src/simulation/match.ts`、`src/simulation/round-settlement.ts`、`src/simulation/serialization-structure.ts`、`src/simulation/shared-pool.ts`、`src/simulation/shop-history.ts`、`src/simulation/validate-content.ts`、`tests/augment-stage-bans-audit.test.ts`、`tests/augment-stage-helpers.ts`、`tests/fixtures/m5/augment-rewards-oracle.cjs`、`tests/fixtures/m5/oracle.g2.cjs`、`tests/m5-content.test.ts`、`tests/m5-oracle-augment-ledger.test.ts`
- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`

### 'origin/claude/v25-int-c' → claude/v25-integration（9c3d6d06）

- 综合修改或删除：`docs/S13_RULES_GAP.md`、`src/simulation/augment-pool-grants.ts`、`src/simulation/carousel.ts`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augment-stage-bans.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/match.ts`、`src/simulation/round-settlement.ts`、`src/simulation/shared-pool.ts`、`src/simulation/strategy-snapshot.ts`、`src/simulation/validate-content.ts`、`tests/augment-stage-bans-audit.test.ts`、`tests/augment-stage-helpers.ts`、`tests/fixtures/m5/augment-rewards-oracle.cjs`、`tests/fixtures/m5/oracle.g2.cjs`、`tests/g2-augments-choice.test.ts`、`tests/m5-content.test.ts`、`tests/m5-oracle-augment-ledger.test.ts`
- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`

### 'origin/codex/v25-h3' → claude/v25-integration（46790cac）

提交信息未记录冲突。

### 'origin/codex/v25-h4' → claude/v25-integration（07cbc7c3）

- 综合修改或删除：`docs/MULTIPLAYER_CONTRACT.md`、`src/simulation/match.ts`、`tests/fixtures/m5/augment-rewards-oracle.cjs`、`tests/m5-oracle-augment-ledger.test.ts`

### 'origin/codex/v25-h6' → claude/v25-integration（f440a9fb）

- 综合修改或删除：`docs/MATCH_CONTRACT.md`、`tests/fixtures/m5/augment-rewards-oracle.cjs`

### 'origin/codex/v25-h7' → claude/v25-integration（507dd94c）

- 综合修改或删除：`docs/MATCH_CONTRACT.md`、`src/server/room/augment-history.ts`、`src/simulation/augment-acquisition.ts`、`src/simulation/augment-history.ts`、`src/simulation/augment-pool-grants.ts`、`src/simulation/augment-xp.ts`、`src/simulation/carousel-types.ts`、`src/simulation/carousel.ts`、`src/simulation/combat-input.ts`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augment-stage-bans.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/m8/version.ts`、`src/simulation/round-settlement.ts`、`src/simulation/shared-pool.ts`、`src/simulation/strategy-snapshot.ts`、`src/simulation/two-sided-snapshot.ts`、`src/simulation/validate-content.ts`、`tests/fixtures/m5/augment-rewards-oracle.cjs`、`tests/fixtures/m5/oracle.g2.cjs`、`tests/g2-augments-choice.test.ts`、`tests/m5-oracle-augment-ledger.test.ts`、`tests/server/carousel-room.test.ts`
- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`、`tests/augment-history.test.ts`

### 'origin/codex/v25-h8' → claude/v25-integration（bd71a9b8）

- 综合修改或删除：`docs/AUGMENT_HISTORY_DESIGN.md`、`docs/COMBAT_CONTRACT.md`、`docs/MATCH_CONTRACT.md`、`docs/S13_RULES_GAP.md`、`src/server/room/augment-history.ts`、`src/simulation/augment-history.ts`、`src/simulation/augment-pool-batch2-health.ts`、`src/simulation/augment-pool-grants.ts`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augment-stage-bans.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/match.ts`、`src/simulation/round-settlement.ts`、`src/simulation/shared-pool.ts`、`src/simulation/validate-content.ts`、`tests/augment-history.test.ts`、`tests/augment-stage-helpers.ts`、`tests/fixtures/m5/augment-rewards-oracle.cjs`、`tests/fixtures/m5/oracle.g2.cjs`、`tests/m5-oracle-augment-ledger.test.ts`
- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`、`src/simulation/m8/contracts.ts`、`src/simulation/m8/version.ts`

### 'origin/codex/v25-h10' → claude/v25-integration（0ea79f71）

- 综合修改或删除：`docs/COMBAT_CONTRACT.md`、`docs/MATCH_CONTRACT.md`、`docs/S13_RULES_GAP.md`、`src/simulation/augment-history.ts`、`src/simulation/augment-pool-grants.ts`、`src/simulation/b8-restore.ts`、`src/simulation/combat-input.ts`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augment-stage-bans.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/shared-pool.ts`、`src/simulation/strategy-snapshot.ts`、`src/simulation/two-sided-snapshot.ts`、`src/simulation/two-sided-types.ts`、`src/simulation/validate-content.ts`、`tests/augment-stage-helpers.ts`、`tests/fixtures/m5/augment-rewards-oracle.cjs`、`tests/fixtures/m5/oracle.g2.cjs`
- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`

### 'origin/codex/v25-h11' → claude/v25-integration（da59096d）

- 综合修改或删除：`docs/COMBAT_CONTRACT.md`、`docs/MATCH_CONTRACT.md`、`docs/S13_RULES_GAP.md`、`src/simulation/augment-history-owners.ts`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augment-stage-bans.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/strategy-snapshot.ts`、`src/simulation/validate-content.ts`、`tests/augment-history.test.ts`、`tests/augment-stage-bans-audit.test.ts`、`tests/augment-stage-helpers.ts`、`tests/fixtures/m5/oracle.g2.cjs`
- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`

### 'origin/codex/v25-h12' → claude/v25-integration（8fe66c2e）

- 综合修改或删除：`docs/AUGMENT_HISTORY_DESIGN.md`、`docs/MATCH_CONTRACT.md`、`docs/S13_RULES_GAP.md`、`src/simulation/augment-history-owners.ts`、`src/simulation/augment-history.ts`、`src/simulation/augment-offers.ts`、`src/simulation/augment-pool-batch5-progress.ts`、`src/simulation/augment-pool-grants.ts`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augment-stage-bans.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/economy.ts`、`src/simulation/match.ts`、`src/simulation/serialization-structure.ts`、`src/simulation/shared-pool.ts`、`src/simulation/shop-history.ts`、`src/simulation/validate-content.ts`、`tests/augment-history.test.ts`、`tests/fixtures/m5/augment-rewards-oracle.cjs`、`tests/fixtures/m5/oracle.g2.cjs`、`tests/shop-history.test.ts`
- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`

### 'origin/codex/v25-h13' → claude/v25-integration（e829a62b）

- 综合修改或删除：`docs/AUGMENT_HISTORY_DESIGN.md`、`docs/MATCH_CONTRACT.md`、`docs/S13_RULES_GAP.md`、`src/simulation/augment-history-owners.ts`、`src/simulation/augment-history-types.ts`、`src/simulation/augment-pool-grants.ts`、`src/simulation/b8-restore.ts`、`src/simulation/content/augment-offer-rules.ts`、`src/simulation/content/augment-policy.ts`、`src/simulation/content/augment-stage-bans.ts`、`src/simulation/content/augments.ts`、`src/simulation/content/rules-manifest.ts`、`src/simulation/m8/version.ts`、`src/simulation/match.ts`、`src/simulation/resource-provenance.ts`、`src/simulation/shop-history.ts`、`src/simulation/temporary-equipment.ts`、`src/simulation/validate-content.ts`、`tests/augment-stage-helpers.ts`、`tests/fixtures/m5/augment-rewards-oracle.cjs`、`tests/fixtures/m5/oracle.g2.cjs`
- 采用第一父版本：`scripts/tests/production-size.test.ts`、`src/simulation/content/identity-constants.ts`


## 验证结果

- `npx tsc --noEmit -p .`：最终修改后复测通过。
- 生产体积与 `tests/augment-history*.test.ts`：3 文件、87 项通过（修复后复测）。
- 合并分支测试首轮：108 文件，38 通过、70 失败；1455 通过、221 失败、322 跳过。跳过项包含前置钩子失败导致未运行，不能视为通过。
- 修复后独立复测：内容目录与静态参数、商店、私有视图、S3B 功能共 5 文件、162 项通过；S3B 房间 15 项通过。H13 Pandora 与目录不变量通过；H12、S6C 和 P1 集中复测仍有 6 项失败；H12 单独复测 3 项失败。
- 独立 oracle 单独复测：H4、H8 通过；H3 修正真实房间报价搜索与被篡改的实际座位后，46 项通过。
- 阶段禁选审计的既有差异按用户要求未改。
- 当前失败阻碍联机验收：H8 吸血房间没有选到 Dhampyr，后续健康验证无法执行；Survivor 房间未选到 Survivor 且淘汰场景与原断言不符；H12 Head Start 房间选择失败；独立账本测试的池数量和种子 25 物品数量断言不匹配；H7 的 PvE 新种子下棋子未阵亡，无法验证死亡奖励；多项 3-2/4-2 固定报价已漂移。上述问题尚未排除真实规则缺陷。

### 各分支测试覆盖（按 origin/multiplayer 三点差异）

- `origin/claude/v25-int-a`：23 个测试文件；首轮失败 15 个。
- `origin/claude/v25-int-b`：34 个测试文件；首轮失败 21 个。
- `origin/claude/v25-int-c`：17 个测试文件；首轮失败 13 个。
- `origin/codex/v25-augment-history`：1 个测试文件；首轮失败 0 个。
- `origin/codex/v25-b5a`：9 个测试文件；首轮失败 8 个。
- `origin/codex/v25-dynamic-values`：2 个测试文件；首轮失败 0 个。
- `origin/codex/v25-h10`：7 个测试文件；首轮失败 5 个。
- `origin/codex/v25-h11`：8 个测试文件；首轮失败 5 个。
- `origin/codex/v25-h12`：8 个测试文件；首轮失败 5 个。
- `origin/codex/v25-h13`：9 个测试文件；首轮失败 7 个。
- `origin/codex/v25-h3`：9 个测试文件；首轮失败 6 个。
- `origin/codex/v25-h4`：11 个测试文件；首轮失败 8 个。
- `origin/codex/v25-h5`：4 个测试文件；首轮失败 2 个。
- `origin/codex/v25-h6`：8 个测试文件；首轮失败 4 个。
- `origin/codex/v25-h7`：6 个测试文件；首轮失败 5 个。
- `origin/codex/v25-h8`：9 个测试文件；首轮失败 5 个。
- `origin/codex/v25-s11a`：2 个测试文件；首轮失败 2 个。
- `origin/codex/v25-s1a`：4 个测试文件；首轮失败 2 个。
- `origin/codex/v25-s1b`：4 个测试文件；首轮失败 3 个。
- `origin/codex/v25-s3a`：9 个测试文件；首轮失败 3 个。
- `origin/codex/v25-s3b`：3 个测试文件；首轮失败 2 个。
- `origin/codex/v25-s3c`：0 个测试文件；首轮失败 0 个。
- `origin/codex/v25-s3d`：5 个测试文件；首轮失败 3 个。
- `origin/codex/v25-s6c`：5 个测试文件；首轮失败 5 个。
- `origin/codex/v25-s8a`：4 个测试文件；首轮失败 3 个。
- `origin/codex/v25-s8b`：4 个测试文件；首轮失败 4 个。
- `origin/codex/v25-s8c`：4 个测试文件；首轮失败 3 个。

### 首轮各文件结果

以下为修复前首轮结果，独立复测以本节上方为准。每个文件的失败细节可用其文件名单独重跑；此表不将跳过视为通过。

- 通过：`tests/augment-dynamic-round-boundary.test.ts`
- 通过：`tests/augment-dynamic-values.test.ts`
- 通过：`tests/augment-history-carousel-growth.test.ts`
- 通过：`tests/augment-history.test.ts`
- 失败：`tests/augment-pool-batch1.test.ts`
- 失败：`tests/augment-pool-batch2.test.ts`
- 失败：`tests/augment-pool-batch4-b4combat.test.ts`
- 失败：`tests/augment-pool-batch4-b4reroll.test.ts`
- 失败：`tests/augment-pool-batch4-b4xp.test.ts`
- 通过：`tests/augment-pool-batch5-b5a-room.test.ts`
- 失败：`tests/augment-pool-batch5-b5a.test.ts`
- 失败：`tests/augment-pool-batch5-fate.test.ts`
- 通过：`tests/augment-pool-batch5-h1-clock.test.ts`
- 通过：`tests/augment-pool-batch5-h1-room.test.ts`
- 通过：`tests/augment-pool-batch5-h1-shared.test.ts`
- 失败：`tests/augment-pool-batch5-h1-value.test.ts`
- 失败：`tests/augment-pool-batch5-h10-sniper-integration.test.ts`
- 失败：`tests/augment-pool-batch5-h10-sniper-room.test.ts`
- 通过：`tests/augment-pool-batch5-h10-sniper.test.ts`
- 失败：`tests/augment-pool-batch5-h10-tracker-room.test.ts`
- 失败：`tests/augment-pool-batch5-h10-tracker.test.ts`
- 失败：`tests/augment-pool-batch5-h11-offers.test.ts`
- 失败：`tests/augment-pool-batch5-h11-room.test.ts`
- 失败：`tests/augment-pool-batch5-h11-sponging-public.test.ts`
- 失败：`tests/augment-pool-batch5-h11-sponging-room.test.ts`
- 通过：`tests/augment-pool-batch5-h11-sponging.test.ts`
- 通过：`tests/augment-pool-batch5-h11.test.ts`
- 失败：`tests/augment-pool-batch5-h12-head-start.test.ts`
- 通过：`tests/augment-pool-batch5-h12-max-cap-online.test.ts`
- 失败：`tests/augment-pool-batch5-h12-max-cap.test.ts`
- 失败：`tests/augment-pool-batch5-h12-subscription.test.ts`
- 失败：`tests/augment-pool-batch5-h13-artifactory-room.test.ts`
- 失败：`tests/augment-pool-batch5-h13-artifactory.test.ts`
- 失败：`tests/augment-pool-batch5-h13-carousel-room.test.ts`
- 失败：`tests/augment-pool-batch5-h13-invariants.test.ts`
- 通过：`tests/augment-pool-batch5-h13-pandora-room.test.ts`
- 失败：`tests/augment-pool-batch5-h13-pandora.test.ts`
- 失败：`tests/augment-pool-batch5-h13-room.test.ts`
- 失败：`tests/augment-pool-batch5-h13-salvage.test.ts`
- 失败：`tests/augment-pool-batch5-h3-cooking.test.ts`
- 失败：`tests/augment-pool-batch5-h3-oracle.test.ts`
- 通过：`tests/augment-pool-batch5-h3.test.ts`
- 失败：`tests/augment-pool-batch5-h4-income.test.ts`
- 通过：`tests/augment-pool-batch5-h4-oracle.test.ts`
- 失败：`tests/augment-pool-batch5-h4-seed.test.ts`
- 失败：`tests/augment-pool-batch5-h4-survivor.test.ts`
- 失败：`tests/augment-pool-batch5-h4.test.ts`
- 失败：`tests/augment-pool-batch5-h5-priority.test.ts`
- 通过：`tests/augment-pool-batch5-h5.test.ts`
- 失败：`tests/augment-pool-batch5-h6.test.ts`
- 失败：`tests/augment-pool-batch5-h7-health.test.ts`
- 失败：`tests/augment-pool-batch5-h7.test.ts`
- 通过：`tests/augment-pool-batch5-h8-deaths-room.test.ts`
- 失败：`tests/augment-pool-batch5-h8-deaths.test.ts`
- 失败：`tests/augment-pool-batch5-h8-health-room.test.ts`
- 失败：`tests/augment-pool-batch5-h8-health.test.ts`
- 通过：`tests/augment-pool-batch5-h8-oracle.test.ts`
- 通过：`tests/augment-pool-batch5-h8-room.test.ts`
- 失败：`tests/augment-pool-batch5-h8.test.ts`
- 失败：`tests/augment-pool-batch5-s11a-greater-moonlight.test.ts`
- 失败：`tests/augment-pool-batch5-s11a-moonlight.test.ts`
- 通过：`tests/augment-pool-batch5-s1a-beggars.test.ts`
- 通过：`tests/augment-pool-batch5-s1a-power.test.ts`
- 失败：`tests/augment-pool-batch5-s1b-at-what-cost.test.ts`
- 通过：`tests/augment-pool-batch5-s1b.test.ts`
- 通过：`tests/augment-pool-batch5-s3a-pandora.test.ts`
- 通过：`tests/augment-pool-batch5-s3a-source.test.ts`
- 失败：`tests/augment-pool-batch5-s3a-vintage.test.ts`
- 通过：`tests/augment-pool-batch5-s3a.test.ts`
- 通过：`tests/augment-pool-batch5-s3b-history.test.ts`
- 失败：`tests/augment-pool-batch5-s3b.test.ts`
- 通过：`tests/augment-pool-batch5-s3d-replication.test.ts`
- 通过：`tests/augment-pool-batch5-s3d.test.ts`
- 失败：`tests/augment-pool-batch5-s6c-room.test.ts`
- 失败：`tests/augment-pool-batch5-s6c.test.ts`
- 失败：`tests/augment-pool-batch5-s8a-room.test.ts`
- 通过：`tests/augment-pool-batch5-s8a.test.ts`
- 失败：`tests/augment-pool-batch5-s8b.test.ts`
- 失败：`tests/augment-pool-batch5-s8c-room.test.ts`
- 通过：`tests/augment-pool-batch5-s8c.test.ts`
- 失败：`tests/augment-pool-batch5.test.ts`
- 失败：`tests/augment-pool-shop.test.ts`
- 失败：`tests/augment-pool-source.test.ts`
- 失败：`tests/augment-stage-bans-audit.test.ts`
- 失败：`tests/g2-augments-choice.test.ts`
- 失败：`tests/g2-augments-static.test.ts`
- 通过：`tests/h3-find-seed.test.ts`
- 失败：`tests/m5-content.test.ts`
- 失败：`tests/m5-oracle-augment-ledger.test.ts`
- 通过：`tests/m5-oracle-h6.test.ts`
- 失败：`tests/s13-p1-acquisition.test.ts`
- 通过：`tests/server/augment-pool-batch5-h6-room.test.ts`
- 通过：`tests/server/augment-pool-batch5-s3a-pandora.test.ts`
- 通过：`tests/server/augment-pool-batch5-s3a-vintage.test.ts`
- 通过：`tests/server/augment-pool-batch5-s3a.test.ts`
- 失败：`tests/server/batch5-h3-cooking-room.test.ts`
- 失败：`tests/server/batch5-h3-room.test.ts`
- 失败：`tests/server/batch5-portfolio-room.test.ts`
- 失败：`tests/server/batch5-s1a-room.test.ts`
- 失败：`tests/server/batch5-s3b-room.test.ts`
- 失败：`tests/server/batch5-s3d-room.test.ts`
- 失败：`tests/server/batch5-survivor-room.test.ts`
- 失败：`tests/server/carousel-room.test.ts`
- 通过：`tests/server/h12-subscription.test.ts`
- 通过：`tests/server/net/batch5-survivor-push.test.ts`
- 失败：`tests/server/scoreboard-h6-room.test.ts`
- 失败：`tests/shop-history.test.ts`
- 失败：`tests/t5r-private-seat-view.test.ts`
