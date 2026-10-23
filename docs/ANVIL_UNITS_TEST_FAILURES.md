# 锻造器候选：旧测试失败对照

基线为未修改的 `c2179b9e`（在 `/tmp/anvil-baseline` 用 git archive 导出），相同 Node/依赖、相同测试文件与 `--configLoader runner --maxWorkers=4`。没有改任何旧断言、epoch、digest 固定快照或 golden。

旧测试 22 文件共 615 项：基线 572 通过 / 43 失败；候选 550 通过 / 65 失败。新增失败 22，基线失败保留 43，没有新增的未分类规则失败。新增锻造器测试另列交付报告，不混入基线比较。

本清单只覆盖本次运行的相关回归集；不表示全仓库历史 epoch/golden 已通过。候选身份与 manifest 已变，**待 v22 统一录制**。

## 本次机制变更触发的旧预期（22 项）


### `tests/epic-loot-reforger.test.ts`

- `v17 epic rewards and unified consumables uses exact approved zh_cn names and rejects prior-epoch state identities without migration` — AssertionError: expected 's13-g2-3-v22-anvil-units-candidate' to be 's13-g2-3-v21-opening-encounters-battl…' // Object.is equality

### `tests/g2-4a-conqueror-items.test.ts`

- `one settlement crossing tier 9 grants the duplicate, Thief's Gloves and a four-way anvil popup exactly once` — TypeError: Cannot read properties of null (reading 'offers')
- `the completed-item anvil offers four distinct ordinary completed items, stable per seed and atom` — AssertionError: expected { id: 'g23:conqueror:9:atom:0', …(5) } to match object { kind: 'item', quantity: 1, gold: +0 }

### `tests/g2-4b-artifact-forge.test.ts`

- `preserves source tiers 10/14 alongside newly admitted support tiers 11/13` — AssertionError: expected [ [ 'item', 1 ], [ 'anvil', 4 ], …(1) ] to deeply equal [ [ 'item', 1 ], [ 'item', 4 ], …(1) ]
- `tier 10 survives pending/manual/timeout restore and rejects duplicate grants and edited authority` — Error: {"ok":false,"state":{"schemaVersion":12,"rulesVersion":"s13-g2-3-v22-anvil-units-candidate","contentVersion":"s13-14.24b-g2-3-v22-anvil-units-candidate","commandProtocolVersion":7,"rngAlgorithm":"lcg32-v1","tickMs":50,"openingEncount
- `tier 14 survives pending/manual/timeout restore and rejects duplicate grants and edited authority` — Error: {"ok":false,"state":{"schemaVersion":12,"rulesVersion":"s13-g2-3-v22-anvil-units-candidate","contentVersion":"s13-14.24b-g2-3-v22-anvil-units-candidate","commandProtocolVersion":7,"rngAlgorithm":"lcg32-v1","tickMs":50,"openingEncount

### `tests/g2-4b-reward-order.test.ts`

- `source descriptor order survives canonical/reversed keys on cache misses and hits across every reward` — AssertionError: expected [ [ 'item', 1 ], [ 'anvil', 4 ], …(1) ] to deeply equal [ [ 'item', 1 ], [ 'item', 4 ], …(1) ]

### `tests/g2-4b-support-forge.test.ts`

- `offers four distinct uniformly sampled supports; previous offers and owned items are not exclusions` — Error: {"ok":false,"state":{"schemaVersion":12,"rulesVersion":"s13-g2-3-v22-anvil-units-candidate","contentVersion":"s13-14.24b-g2-3-v22-anvil-units-candidate","commandProtocolVersion":7,"rngAlgorithm":"lcg32-v1","tickMs":50,"openingEncount
- `tier 11 selection/timeout survives domain restore, issues one item and rejects replay or forged receipts` — Error: {"ok":false,"state":{"schemaVersion":12,"rulesVersion":"s13-g2-3-v22-anvil-units-candidate","contentVersion":"s13-14.24b-g2-3-v22-anvil-units-candidate","commandProtocolVersion":7,"rngAlgorithm":"lcg32-v1","tickMs":50,"openingEncount
- `tier 13 automatically grants the three fixed supports, remover and 20 gold exactly once across restore` — Error: {"ok":false,"state":{"schemaVersion":12,"rulesVersion":"s13-g2-3-v22-anvil-units-candidate","contentVersion":"s13-14.24b-g2-3-v22-anvil-units-candidate","commandProtocolVersion":7,"rngAlgorithm":"lcg32-v1","tickMs":50,"openingEncount

### `tests/opening-encounters-batch-a.test.ts`

- `forge rewards resolve through the existing choice command and authenticate offers and provenance` — AssertionError: expected [] to match object [ { kind: 'choice', …(3) } ]

### `tests/opening-encounters-batch-b.test.ts`

- `batch B combat and reward vectors reward grants and forge resolution are idempotent; tampered gold rejected` — AssertionError: expected undefined to be 'opening-batch-b' // Object.is equality
- `forge restore rejects changed source, forged offers and skipping the first pending anvil` — AssertionError: expected [Function] to throw an error
- `terminal 6-7 grants both completed forges, keeps terminal phase and cannot repeat` — AssertionError: expected [] to have a length of 2 but got +0

### `tests/opening-encounters-pr2.test.ts`

- `PR2 opening anvils artifact-anvil: independent four-option oracle, sequential grants and exact restore after every choice` — AssertionError: expected null to match object { kind: 'forge', …(1) }
- `PR2 opening anvils artifact-anvil: tampered queue/offers/source/grant is rejected on restore` — TypeError: Cannot read properties of null (reading 'offers')
- `PR2 opening anvils component-anvils: independent four-option oracle, sequential grants and exact restore after every choice` — AssertionError: expected null to match object { kind: 'forge', …(1) }
- `PR2 opening anvils component-anvils: tampered queue/offers/source/grant is rejected on restore` — TypeError: Cannot read properties of null (reading 'offers')
- `artifact-anvil: eight seats share policy, use private candidates and restore against the root` — TypeError: Cannot read properties of null (reading 'offers')
- `component-anvils: eight seats share policy, use private candidates and restore against the root` — TypeError: Cannot read properties of null (reading 'offers')
- `two anvils: shared timeout drains one choice at a time, restores and rejects stale retries (carousel=false)` — TypeError: Cannot read properties of null (reading 'choiceId')
- `two anvils: shared timeout drains one choice at a time, restores and rejects stale retries (carousel=true)` — TypeError: Cannot read properties of null (reading 'choiceId')

## 原候选已有失败（43 项）


### `tests/epic-loot-reforger.test.ts`

- `v17 epic rewards and unified consumables a real 5-7 command path restores new forge receipts and never repeats the rewards` — Error: Invalid Match save: unsupported-version
- `v17 epic rewards and unified consumables authenticates neutral opening HP after earned radiant health auras and rejects altered frozen HP` — Error: Invalid Match save: unsupported-version
- `v17 epic rewards and unified consumables does not reveal or award an un-killed carrier, and each killed reward group has one colored orb` — AssertionError: expected +0 to be 6 // Object.is equality
- `v17 epic rewards and unified consumables online epic heroes stay in their box until explicit shared-pool claim; shortages pay cost and capacity pays sell price` — AssertionError: expected undefined to be defined
- `v17 epic rewards and unified consumables the real 6-7 terminal keeps full-bench heroes retained-terminal while completing forge fallback once` — Error: Invalid Match save: unsupported-version
- `v17 epic rewards and unified consumables uses existing four-choice forge pools with unique choice receipts, deterministic timeout and terminal fallback` — AssertionError: expected [] to have a length of 2 but got +0

### `tests/g2-3-netcode-hooks.test.ts`

- `G2-3 mechanic choices an offline save with a pending mechanic choice restores` — AssertionError [ERR_ASSERTION]: earned source must be dead
- `G2-3 seat mechanic container reaches the private view and the display state verbatim; hidden state never does` — TypeError: Cannot read properties of undefined (reading 'map')

### `tests/loot-orb-claim.test.ts`

- `multiplayer explicit orb claims combat accepts FIFO intent, then settles using actual capacity (sell during combat: false)` — AssertionError: expected 985 to be 983 // Object.is equality
- `multiplayer explicit orb claims combat accepts FIFO intent, then settles using actual capacity (sell during combat: true)` — AssertionError: expected 983 to be 981 // Object.is equality
- `multiplayer explicit orb claims retains a revealed 2-7 orb into 3-1 and pays its entries once in entryOrdinal order` — TypeError: Cannot read properties of undefined (reading 'roundId')

### `tests/opening-encounters-integration.test.ts`

- `opening encounter PR1 lifecycle, privacy and no-effect contract uses an explicit public whitelist even when secrets are injected` — AssertionError: expected true to be false // Object.is equality

### `tests/opening-encounters-pr2.test.ts`

- `exactly six PR2 effects become enabled; unimplemented effects retain original weights and null evidence` — AssertionError: expected [ 'none', 'scuttle-puddle', …(14) ] to deeply equal [ 'none', 'golden-gala', …(6) ]

### `tests/opening-encounters-pr6.test.ts`

- `PR6 Mel threshold observation with reward gate closed 100 → 40 crosses after save: true` — AssertionError: expected { schemaVersion: 12, …(47) } to deeply equal { schemaVersion: 12, …(47) }
- `PR6 Mel threshold observation with reward gate closed 41 → 1 crosses after save: true` — AssertionError: expected { schemaVersion: 12, …(47) } to deeply equal { schemaVersion: 12, …(47) }
- `PR6 Mel threshold observation with reward gate closed 41 → 39 crosses after save: true` — AssertionError: expected { schemaVersion: 12, …(47) } to deeply equal { schemaVersion: 12, …(47) }
- `PR6 Mel threshold observation with reward gate closed 41 → 40 crosses after save: true` — AssertionError: expected { schemaVersion: 12, …(47) } to deeply equal { schemaVersion: 12, …(47) }
- `PR6 Mel threshold observation with reward gate closed authenticates every receipt field and rejects duplicates, missing records, and foreign encounters` — AssertionError: expected { ok: false, state: { …(48) }, …(1) } to deeply equal { ok: false, state: { …(48) }, …(1) }
- `PR6 Mel threshold observation with reward gate closed keeps all rewards closed and preserves only the evidenced B-patch branch override` — AssertionError: expected [ true, true ] to deeply equal [ false, false ]
- `PR6 Mel threshold observation with reward gate closed multiplayer settlement records 41 → 39 atomically, rejects retries and mirrors without RNG or grants` — AssertionError: expected [ 'roundSettled', …(3) ] to deeply equal [ 'roundSettled' ]
- `PR6 Mel threshold observation with reward gate closed owner-only progress is detached and explicitly blocked; public view contains no personal receipt` — AssertionError: expected { encounterId: 'mels-blessing', …(6) } to deeply equal { encounterId: 'mels-blessing', …(6) }
- `PR6 Warwick reserved interface fails closed never rolls or grants for reserved facts 0` — AssertionError: expected { ok: true, state: { …(48) }, …(1) } to deeply equal { ok: false, state: { …(48) }, …(1) }
- `PR6 Warwick reserved interface fails closed never rolls or grants for reserved facts 1` — AssertionError: expected { ok: false, state: { …(48) }, …(1) } to deeply equal { ok: false, state: { …(48) }, …(1) }
- `PR6 Warwick reserved interface fails closed never rolls or grants for reserved facts 2` — AssertionError: expected { ok: false, state: { …(48) }, …(1) } to deeply equal { ok: false, state: { …(48) }, …(1) }
- `PR6 Warwick reserved interface fails closed never rolls or grants for reserved facts 3` — AssertionError: expected { ok: false, state: { …(48) }, …(1) } to deeply equal { ok: false, state: { …(48) }, …(1) }
- `PR6 Warwick reserved interface fails closed never rolls or grants for reserved facts 4` — AssertionError: expected { ok: false, state: { …(48) }, …(1) } to deeply equal { ok: false, state: { …(48) }, …(1) }
- `PR6 Warwick reserved interface fails closed never rolls or grants for reserved facts 5` — AssertionError: expected { ok: false, state: { …(48) }, …(1) } to deeply equal { ok: false, state: { …(48) }, …(1) }

### `tests/restore-audit/g23-reward-allocation.test.ts`

- `rejects a forged FiveCostUnit count before invoking any atom expansion` — AssertionError: expected [Function] to throw error including 'G23 reward authority' but got 'Invalid Match save: opening-context-m…'
- `rejects a forged FourCostUnit count before invoking any atom expansion` — AssertionError: expected [Function] to throw error including 'G23 reward authority' but got 'Invalid Match save: opening-context-m…'
- `rejects a forged ThreeCostUnit count before invoking any atom expansion` — AssertionError: expected [Function] to throw error including 'G23 reward authority' but got 'Invalid Match save: opening-context-m…'
- `rejects an unearned frozen bundle with forged id before expansion` — AssertionError: expected "g23RewardAtoms" to not be called at all, but actually been called 1 times
- `rejects an unearned frozen bundle with forged round before expansion` — AssertionError: expected "g23RewardAtoms" to not be called at all, but actually been called 1 times
- `rejects an unearned frozen bundle with forged source before expansion` — AssertionError: expected [Function] to throw error including 'G23 reward authority' but got 'Invalid Match save: opening-context-m…'
- `rejects an unearned frozen bundle with forged tier before expansion` — AssertionError: expected [Function] to throw error including 'G23 reward authority' but got 'Invalid Match save: opening-context-m…'

### `tests/server/bot-driver.test.ts`

- `BotDriver: no takeover by default (P2, TFT behaviour) leaves a disconnected human seat alone: no takeover timer, no bot step, the seat stays human and its board still fights` — Error: Test timed out in 5000ms.

### `tests/t5r-private-seat-view.test.ts`

- `T5R private own-seat whitelist SR-B7-02 1-2: current public preview survives display adaptation without hidden fields` — AssertionError: expected { encounterId: 'minions-a-v1', …(2) } to deeply equal { encounterId: 'minions-a-v1', …(2) }
- `T5R private own-seat whitelist SR-B7-02 1-3: current public preview survives display adaptation without hidden fields` — AssertionError: expected { encounterId: 'minions-b-v1', …(2) } to deeply equal { encounterId: 'minions-b-v1', …(2) }
- `T5R private own-seat whitelist SR-B7-02 1-4: current public preview survives display adaptation without hidden fields` — AssertionError: expected { encounterId: 'minions-c-v1', …(2) } to deeply equal { encounterId: 'minions-c-v1', …(2) }
- `T5R private own-seat whitelist SR-B7-02 2-7: current public preview survives display adaptation without hidden fields` — AssertionError: expected { encounterId: 'krugs-v1', …(2) } to deeply equal { encounterId: 'krugs-v1', …(2) }
- `T5R private own-seat whitelist SR-B7-02 3-7: current public preview survives display adaptation without hidden fields` — AssertionError: expected { encounterId: 'wolves-v1', …(2) } to deeply equal { encounterId: 'wolves-v1', …(2) }
- `T5R private own-seat whitelist SR-B7-02 4-7: current public preview survives display adaptation without hidden fields` — AssertionError: expected { encounterId: 'razorbeaks-v1', …(2) } to deeply equal { encounterId: 'razorbeaks-v1', …(2) }
- `T5R private own-seat whitelist SR-B7-02 5-7: current public preview survives display adaptation without hidden fields` — AssertionError: expected { Object (encounterId, units, ...) } to deeply equal { Object (encounterId, units, ...) }
- `T5R private own-seat whitelist SR-B7-02 6-7: current public preview survives display adaptation without hidden fields` — AssertionError: expected { encounterId: 'rift-herald-v1', …(2) } to deeply equal { encounterId: 'rift-herald-v1', …(2) }

## 本次运行的旧测试文件

- `tests/epic-loot-reforger.test.ts`：21 通过 / 7 失败。
- `tests/g2-3-content.test.ts`：10 通过 / 0 失败。
- `tests/g2-3-netcode-hooks.test.ts`：12 通过 / 2 失败。
- `tests/g2-4a-conqueror-items.test.ts`：4 通过 / 2 失败。
- `tests/g2-4b-artifact-forge.test.ts`：4 通过 / 3 失败。
- `tests/g2-4b-reward-order.test.ts`：0 通过 / 1 失败。
- `tests/g2-4b-support-forge.test.ts`：5 通过 / 3 失败。
- `tests/inventory.test.ts`：45 通过 / 0 失败。
- `tests/loot-orb-claim.test.ts`：24 通过 / 3 失败。
- `tests/m5-command-phases.test.ts`：13 通过 / 0 失败。
- `tests/m8-b8-resource-provenance.test.ts`：64 通过 / 0 失败。
- `tests/opening-encounters-batch-a.test.ts`：93 通过 / 1 失败。
- `tests/opening-encounters-batch-b.test.ts`：68 通过 / 3 失败。
- `tests/opening-encounters-integration.test.ts`：37 通过 / 1 失败。
- `tests/opening-encounters-pr2.test.ts`：22 通过 / 9 失败。
- `tests/opening-encounters-pr6.test.ts`：28 通过 / 14 失败。
- `tests/restore-audit/g23-reward-allocation.test.ts`：4 通过 / 7 失败。
- `tests/server/bot-driver.test.ts`：8 通过 / 1 失败。
- `tests/t5r-private-seat-view.test.ts`：8 通过 / 8 失败。
- `tests/t7-bot-policy.test.ts`：24 通过 / 0 失败。
- `tests/tp-shared-pool.test.ts`：14 通过 / 0 失败。
- `tests/unit-stats.test.ts`：42 通过 / 0 失败。
