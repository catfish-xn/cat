# 14.24 野怪恢复：剩余失败逐项清单

合计 145 项；没有独立oracle、现行机制或奖励资格失败。分类只描述当前首先失败的检查，不能据此声称改一个版本字段即可通过其后恢复／golden断言。Claude统一生成新纪元与新录制fixture后，必须完整重跑这些案例；历史v25字节不就地覆盖。

来源：`artifacts/neutrals/review-final-routes.json`、`review-final-tests.json`。完整剩余测试文件及通过数见 [主报告](../../NEUTRALS_14_24_RESTORATION.md#验收记录与文件定位)。

| # | 文件／用例（完整Vitest名称） | 分类 | 当前错误 |
| --- | --- | --- | --- |
| 1 | `m5-route.test.ts`：M5 ordinary three-build routes and independent resource ledger sniper-caitlyn normally buys five-cost Caitlyn and fields her for at least two real battles | 纯身份／摘要（当前首先失败点） | AssertionError [ERR_ASSERTION]: golden rulesVersion: review explicit rule/version change |
| 2 | `m5-route.test.ts`：M5 ordinary three-build routes and independent resource ledger cannon cannon: ordinary purchases/rewards to 6-7 with a complete build | 纯身份／摘要（当前首先失败点） | AssertionError [ERR_ASSERTION]: golden rulesVersion: review explicit rule/version change |
| 3 | `m5-route.test.ts`：M5 ordinary three-build routes and independent resource ledger sniper sniper: ordinary purchases/rewards to 6-7 with a complete build | 纯身份／摘要（当前首先失败点） | AssertionError [ERR_ASSERTION]: golden rulesVersion: review explicit rule/version change |
| 4 | `m5-route.test.ts`：M5 ordinary three-build routes and independent resource ledger mage mage: ordinary purchases/rewards to 6-7 with a complete build | 纯身份／摘要（当前首先失败点） | AssertionError [ERR_ASSERTION]: golden rulesVersion: review explicit rule/version change |
| 5 | `content-identity-constants.test.ts`：committed identities cover complete archived content (CI fast) matches the original full content root, including explanation/source columns | 纯身份／摘要（当前首先失败点） | AssertionError: Recompute: node scripts/update-content-identities.cjs --write: expected 'fnv1a32-utf16:f671ab88' to be 'fnv1a32-utf16:ec6dce7d' // Object.is equality |
| 6 | `content-identity-constants.test.ts`：committed identities cover complete archived content (CI fast) matches the full loot replay root | 纯身份／摘要（当前首先失败点） | AssertionError: Recompute: node scripts/update-content-identities.cjs --write: expected 'fnv1a32-utf16:36ebfac2' to be 'fnv1a32-utf16:df6b9e07' // Object.is equality |
| 7 | `epic-loot-reforger.test.ts`：v17 epic rewards and unified consumables a real 5-7 command path restores new forge receipts and never repeats the rewards | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 8 | `epic-loot-reforger.test.ts`：v17 epic rewards and unified consumables the real 6-7 terminal keeps full-bench heroes retained-terminal while completing forge fallback once | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 9 | `epic-loot-reforger.test.ts`：v17 epic rewards and unified consumables uses exact approved zh_cn names and rejects prior-epoch state identities without migration | 纯身份／摘要（当前首先失败点） | AssertionError: expected 's13-g2-3-v26-neutrals-1424' to be 's13-g2-3-v25-online-rules' // Object.is equality |
| 10 | `opening-random-identity.test.ts`：binds v25-online-rules to fresh public rules and preserved v24-online-rules byte evidence | 纯身份／摘要（当前首先失败点） | AssertionError: expected 's13-g2-3-v26-neutrals-1424' to be 's13-g2-3-v25-online-rules' // Object.is equality |
| 11 | `opening-random-identity.test.ts`：cannon: checkpoint 0 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 12 | `opening-random-identity.test.ts`：cannon: checkpoint 1 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 13 | `opening-random-identity.test.ts`：cannon: checkpoint 2 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 14 | `opening-random-identity.test.ts`：cannon: checkpoint 3 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 15 | `opening-random-identity.test.ts`：cannon: checkpoint 4 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 16 | `opening-random-identity.test.ts`：cannon: checkpoint 5 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 17 | `opening-random-identity.test.ts`：cannon: checkpoint 6 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 18 | `opening-random-identity.test.ts`：cannon: checkpoint 7 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 19 | `opening-random-identity.test.ts`：cannon: checkpoint 8 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 20 | `opening-random-identity.test.ts`：cannon: checkpoint 9 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 21 | `opening-random-identity.test.ts`：cannon: checkpoint 10 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 22 | `opening-random-identity.test.ts`：cannon: checkpoint 11 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 23 | `opening-random-identity.test.ts`：cannon: checkpoint 12 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 24 | `opening-random-identity.test.ts`：cannon: checkpoint 13 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 25 | `opening-random-identity.test.ts`：cannon: checkpoint 14 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 26 | `opening-random-identity.test.ts`：cannon: checkpoint 15 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 27 | `opening-random-identity.test.ts`：cannon: checkpoint 16 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 28 | `opening-random-identity.test.ts`：cannon: checkpoint 17 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 29 | `opening-random-identity.test.ts`：cannon: checkpoint 18 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 30 | `opening-random-identity.test.ts`：cannon: checkpoint 19 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 31 | `opening-random-identity.test.ts`：cannon: checkpoint 20 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 32 | `opening-random-identity.test.ts`：cannon: checkpoint 21 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 33 | `opening-random-identity.test.ts`：cannon: checkpoint 22 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 34 | `opening-random-identity.test.ts`：cannon: checkpoint 23 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 35 | `opening-random-identity.test.ts`：cannon: checkpoint 24 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 36 | `opening-random-identity.test.ts`：cannon: checkpoint 25 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 37 | `opening-random-identity.test.ts`：cannon: checkpoint 26 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 38 | `opening-random-identity.test.ts`：cannon: checkpoint 27 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 39 | `opening-random-identity.test.ts`：cannon: checkpoint 28 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 40 | `opening-random-identity.test.ts`：cannon: checkpoint 29 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 41 | `opening-random-identity.test.ts`：cannon: checkpoint 30 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 42 | `opening-random-identity.test.ts`：cannon: checkpoint 31 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 43 | `opening-random-identity.test.ts`：cannon: checkpoint 32 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 44 | `opening-random-identity.test.ts`：cannon: checkpoint 33 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 45 | `opening-random-identity.test.ts`：cannon: checkpoint 34 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 46 | `opening-random-identity.test.ts`：cannon: checkpoint 35 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 47 | `opening-random-identity.test.ts`：cannon: checkpoint 36 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 48 | `opening-random-identity.test.ts`：cannon: checkpoint 37 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 49 | `opening-random-identity.test.ts`：cannon: checkpoint 38 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 50 | `opening-random-identity.test.ts`：cannon: checkpoint 39 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 51 | `opening-random-identity.test.ts`：cannon: checkpoint 40 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 52 | `opening-random-identity.test.ts`：cannon: checkpoint 41 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 53 | `opening-random-identity.test.ts`：cannon: checkpoint 42 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 54 | `opening-random-identity.test.ts`：cannon: checkpoint 43 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 55 | `opening-random-identity.test.ts`：cannon: checkpoint 44 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 56 | `opening-random-identity.test.ts`：cannon: checkpoint 45 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 57 | `opening-random-identity.test.ts`：cannon: checkpoint 46 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 58 | `opening-random-identity.test.ts`：cannon: checkpoint 47 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 59 | `opening-random-identity.test.ts`：cannon: checkpoint 48 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 60 | `opening-random-identity.test.ts`：cannon: checkpoint 49 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 61 | `opening-random-identity.test.ts`：cannon: checkpoint 50 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 62 | `opening-random-identity.test.ts`：cannon: checkpoint 51 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 63 | `opening-random-identity.test.ts`：cannon: checkpoint 52 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 64 | `opening-random-identity.test.ts`：cannon: checkpoint 53 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 65 | `opening-random-identity.test.ts`：cannon: checkpoint 54 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 66 | `opening-random-identity.test.ts`：cannon: checkpoint 55 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 67 | `opening-random-identity.test.ts`：cannon: checkpoint 56 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 68 | `opening-random-identity.test.ts`：cannon: checkpoint 57 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 69 | `opening-random-identity.test.ts`：cannon: checkpoint 58 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 70 | `opening-random-identity.test.ts`：cannon: checkpoint 59 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 71 | `opening-random-identity.test.ts`：cannon: checkpoint 60 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 72 | `opening-random-identity.test.ts`：cannon: checkpoint 61 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 73 | `opening-random-identity.test.ts`：cannon: checkpoint 62 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 74 | `opening-random-identity.test.ts`：cannon: checkpoint 63 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 75 | `opening-random-identity.test.ts`：cannon: checkpoint 64 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 76 | `opening-random-identity.test.ts`：cannon: checkpoint 65 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 77 | `opening-random-identity.test.ts`：cannon: checkpoint 66 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 78 | `opening-random-identity.test.ts`：sniper: checkpoint 0 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 79 | `opening-random-identity.test.ts`：sniper: checkpoint 1 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 80 | `opening-random-identity.test.ts`：sniper: checkpoint 2 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 81 | `opening-random-identity.test.ts`：sniper: checkpoint 3 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 82 | `opening-random-identity.test.ts`：sniper: checkpoint 4 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 83 | `opening-random-identity.test.ts`：sniper: checkpoint 5 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 84 | `opening-random-identity.test.ts`：sniper: checkpoint 6 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 85 | `opening-random-identity.test.ts`：sniper: checkpoint 7 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 86 | `opening-random-identity.test.ts`：sniper: checkpoint 8 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 87 | `opening-random-identity.test.ts`：sniper: checkpoint 9 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 88 | `opening-random-identity.test.ts`：sniper: checkpoint 10 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 89 | `opening-random-identity.test.ts`：sniper: checkpoint 11 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 90 | `opening-random-identity.test.ts`：sniper: checkpoint 12 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 91 | `opening-random-identity.test.ts`：sniper: checkpoint 13 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 92 | `opening-random-identity.test.ts`：sniper: checkpoint 14 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 93 | `opening-random-identity.test.ts`：sniper: checkpoint 15 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 94 | `opening-random-identity.test.ts`：sniper: checkpoint 16 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 95 | `opening-random-identity.test.ts`：sniper: checkpoint 17 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 96 | `opening-random-identity.test.ts`：sniper: checkpoint 18 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 97 | `opening-random-identity.test.ts`：sniper: checkpoint 19 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 98 | `opening-random-identity.test.ts`：sniper: checkpoint 20 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 99 | `opening-random-identity.test.ts`：sniper: checkpoint 21 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 100 | `opening-random-identity.test.ts`：sniper: checkpoint 22 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 101 | `opening-random-identity.test.ts`：sniper: checkpoint 23 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 102 | `opening-random-identity.test.ts`：sniper: checkpoint 24 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 103 | `opening-random-identity.test.ts`：sniper: checkpoint 25 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 104 | `opening-random-identity.test.ts`：sniper: checkpoint 26 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 105 | `opening-random-identity.test.ts`：sniper: checkpoint 27 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 106 | `opening-random-identity.test.ts`：sniper: checkpoint 28 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 107 | `opening-random-identity.test.ts`：sniper: checkpoint 29 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 108 | `opening-random-identity.test.ts`：sniper: checkpoint 30 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 109 | `opening-random-identity.test.ts`：sniper: checkpoint 31 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 110 | `opening-random-identity.test.ts`：sniper: checkpoint 32 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 111 | `opening-random-identity.test.ts`：sniper: checkpoint 33 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 112 | `opening-random-identity.test.ts`：sniper: checkpoint 34 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 113 | `opening-random-identity.test.ts`：sniper: checkpoint 35 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 114 | `opening-random-identity.test.ts`：sniper: checkpoint 36 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 115 | `opening-random-identity.test.ts`：sniper: checkpoint 37 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 116 | `opening-random-identity.test.ts`：sniper: checkpoint 38 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 117 | `opening-random-identity.test.ts`：sniper: checkpoint 39 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 118 | `opening-random-identity.test.ts`：sniper: checkpoint 40 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 119 | `opening-random-identity.test.ts`：sniper: checkpoint 41 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 120 | `opening-random-identity.test.ts`：sniper: checkpoint 42 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 121 | `opening-random-identity.test.ts`：sniper: checkpoint 43 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 122 | `opening-random-identity.test.ts`：sniper: checkpoint 44 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 123 | `opening-random-identity.test.ts`：sniper: checkpoint 45 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 124 | `opening-random-identity.test.ts`：sniper: checkpoint 46 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 125 | `opening-random-identity.test.ts`：sniper: checkpoint 47 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 126 | `opening-random-identity.test.ts`：sniper: checkpoint 48 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 127 | `opening-random-identity.test.ts`：sniper: checkpoint 49 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 128 | `opening-random-identity.test.ts`：sniper: checkpoint 50 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 129 | `opening-random-identity.test.ts`：sniper: checkpoint 51 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 130 | `opening-random-identity.test.ts`：sniper: checkpoint 52 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 131 | `opening-random-identity.test.ts`：sniper: checkpoint 53 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 132 | `opening-random-identity.test.ts`：sniper: checkpoint 54 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 133 | `opening-random-identity.test.ts`：sniper: checkpoint 55 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 134 | `opening-random-identity.test.ts`：sniper: checkpoint 56 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 135 | `opening-random-identity.test.ts`：sniper: checkpoint 57 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 136 | `opening-random-identity.test.ts`：sniper: checkpoint 58 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 137 | `opening-random-identity.test.ts`：sniper: checkpoint 59 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 138 | `opening-random-identity.test.ts`：sniper: checkpoint 60 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 139 | `opening-random-identity.test.ts`：sniper: checkpoint 61 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 140 | `opening-random-identity.test.ts`：sniper: checkpoint 62 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 141 | `opening-random-identity.test.ts`：sniper: checkpoint 63 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 142 | `opening-random-identity.test.ts`：sniper: checkpoint 64 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 143 | `opening-random-identity.test.ts`：sniper: checkpoint 65 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 144 | `opening-random-identity.test.ts`：sniper: checkpoint 66 survives strict text/object restore | 纯身份／摘要（当前首先失败点） | Error: Invalid Match save: unsupported-version |
| 145 | `opening-random-identity.test.ts`：recomputes the first battle terminal and every event hash from public commands | 非纯身份：录制战斗轨迹变化 | AssertionError: expected { seed: 42, ticks: 164, …(4) } to deeply equal { seed: 42, ticks: 274, …(4) } |
