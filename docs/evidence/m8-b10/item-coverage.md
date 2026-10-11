# M8 B10 装备覆盖矩阵（自动生成）

由 `node scripts/m8-b10-item-coverage.cjs` 生成；按测试源码统计，不运行测试；测试是否通过以同 SHA 的 `npm test` 为准。共 44 件，144 个测试文件。
带 * 的文件遍历整个冻结目录（脚本校验其仍遍历 44 件）；其余文件按名提到该装备。前三列是 M8_PLAN §7.1 要求的 independentTest → combatTest → save/replayTest，“缺”即缺口；获取/经济列仅供参考（获取由通用组件池/掉落规则覆盖，不按件要求）。

| contentId | 类型 | 来源约定 | 独立数值 | 实战触发 | 存档/回放 | 获取/经济（参考） | 按名文件数 |
| --- | --- | --- | --- | --- | --- | --- | ---: |
| `belt` | component | GLOBAL-STAT-01 | 1：m8-b4-catalog* | 1：m8-b10-item-save-replay* | 2：m8-b8-golden-guard、m8-b10-item-save-replay* | 4：m8-b8-live-economy、m8-b8-live-growth、m8-b8-loot-freeze… | 11 |
| `bow` | component | GLOBAL-STAT-01 | 1：m8-b4-catalog* | 3：m8-b4-audit-regressions、m8-b8-combat-input、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | 4：m8-b8-live-cross-round、m8-b8-live-economy、m8-b8-loot-freeze… | 11 |
| `cloak` | component | GLOBAL-STAT-01 | 1：m8-b4-catalog* | 3：m8-b3-audit、m8-b8-equipment-fixture、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | 6：m8-b5-equipment-history、m8-b5-grant-upgrade、m8-b5-temporary… | 12 |
| `gloves` | component | GLOBAL-STAT-01 | 1：m8-b4-catalog* | 2：m8-b8-combat-input、m8-b10-item-save-replay* | 2：m8-b10-temporary-replay、m8-b10-item-save-replay* | 8：m8-b5-equipment-history、m8-b5-grant-upgrade、m8-b5-instances… | 14 |
| `rod` | component | GLOBAL-STAT-01 | 1：m8-b4-catalog* | 1：m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | 9：m8-b5-grant-upgrade、m8-b5-queries、m8-b8-live-cross-round… | 16 |
| `sword` | component | GLOBAL-STAT-01 | 1：m8-b4-catalog* | 3：m8-b8-combat-input、m8-b8-equipment-fixture、m8-b10-item-save-replay* | 3：m8-b8-golden-guard、m8-b8-restore、m8-b10-item-save-replay* | 13：m8-b5-grant-upgrade、m8-b5-instances、m8-b5-queries… | 25 |
| `tear` | component | GLOBAL-STAT-01 | 1：m8-b4-catalog* | 1：m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | 6：m8-b8-live-capacity、m8-b8-live-economy、m8-b8-live-reveal… | 10 |
| `vest` | component | GLOBAL-STAT-01 | 1：m8-b4-catalog* | 2：m8-b4-audit-regressions、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | 6：m8-b5-grant-upgrade、m8-b5-queries、m8-b8-live-economy… | 11 |
| `adaptive-helm` | completed | A-01, GLOBAL-STAT-01 | 2：m8-b4-tear、m8-b4-catalog* | 2：m8-b4-tear、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | 2：m8-b5-equipment-history、m8-b5-temporary | 4 |
| `archangel` | completed | A-02, GLOBAL-STAT-01 | 2：m8-b4-rod、m8-b4-catalog* | 2：m8-b4-rod、m8-b10-item-save-replay* | 2：m8-b10-temporary-replay、m8-b10-item-save-replay* | 1：m8-b8-live-transfer | 8 |
| `bloodthirster` | completed | A-04, GLOBAL-STAT-01 | 3：m8-b4-sword、m8-g06、m8-b4-catalog* | 7：m8-b3-second-integration、m8-b4-audit-regressions、m8-b4-integration… | 1：m8-b10-item-save-replay* | **缺** | 9 |
| `blue-buff` | completed | A-05, GLOBAL-STAT-01 | 2：m8-b4-tear、m8-b4-catalog* | 3：m8-b4-tear、m8-b8-combat-input、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | 3：m8-b5-grant-upgrade、m8-b5-instances、m8-b5-queries | 6 |
| `bramble-vest` | completed | A-06, GLOBAL-STAT-01 | 2：m8-b4-vest、m8-b4-catalog* | 2：m8-b4-vest、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | 2：m8-b5-equipment-history、m8-b5-temporary | 4 |
| `crownguard` | completed | A-08, GLOBAL-STAT-01 | 2：m8-b4-rod、m8-b4-catalog* | 4：m8-b4-audit-regressions、m8-b4-integration、m8-b4-rod… | 1：m8-b10-item-save-replay* | 1：m8-b5-temporary | 5 |
| `deathblade` | completed | A-09, GLOBAL-STAT-01 | 2：m8-b4-sword、m8-b4-catalog* | 2：m8-b4-sword、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | 6：m8-b5-instances、m8-b5-temporary、m8-b8-live-economy… | 10 |
| `deathcap` | completed | B-06, GLOBAL-STAT-01 | 2：m8-b4-rod、m8-b4-catalog* | 2：m8-b4-rod、m8-b10-item-save-replay* | 2：m8-b10-temporary-replay、m8-b10-item-save-replay* | 1：m8-b8-live-transfer | 5 |
| `dragons-claw` | completed | A-10, GLOBAL-STAT-01 | 2：m8-b4-cloak、m8-b4-catalog* | 3：m8-b3-audit、m8-b4-cloak、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | **缺** | 4 |
| `edge-of-night` | completed | A-14, GLOBAL-STAT-01 | 2：m8-b4-sword、m8-b4-catalog* | 2：m8-b4-sword、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | **缺** | 3 |
| `evenshroud` | completed | GLOBAL-STAT-01 | 2：m8-b4-cloak、m8-b4-catalog* | 3：m8-b4-cloak、m8-b4-integration、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | **缺** | 4 |
| `gargoyle` | completed | A-12, GLOBAL-STAT-01 | 2：m8-b4-vest、m8-b4-catalog* | 2：m8-b4-vest、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | 1：m8-b5-temporary | 5 |
| `giant-slayer` | completed | GLOBAL-STAT-01, GS-01 | 2：m8-b4-sword、m8-b4-catalog* | 4：m8-b4-audit-regressions、m8-b4-integration、m8-b4-sword… | 1：m8-b10-item-save-replay* | **缺** | 4 |
| `guardbreaker` | completed | B-04, GLOBAL-STAT-01 | 2：m8-b4-belt、m8-b4-catalog* | 2：m8-b4-belt、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | **缺** | 3 |
| `gunblade` | completed | A-16, GLOBAL-STAT-01 | 3：m8-b4-sword、m8-g06、m8-b4-catalog* | 5：m8-b3-integration、m8-b3-second-integration、m8-b4-audit-regressions… | 1：m8-b10-item-save-replay* | 1：m8-b5-queries | 12 |
| `hand-of-justice` | completed | GLOBAL-STAT-01 | 2：m8-b4-tear、m8-b4-catalog* | 4：m8-b4-integration、m8-b4-tear、m8-b8-equipment-fixture… | 1：m8-b10-item-save-replay* | **缺** | 4 |
| `infinity-edge` | completed | A-17, GLOBAL-STAT-01 | 2：m8-b4-sword、m8-b4-catalog* | 3：m8-b4-integration、m8-b4-sword、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | **缺** | 5 |
| `ionic-spark` | completed | A-18, GLOBAL-STAT-01 | 2：m8-b4-rod、m8-b4-catalog* | 3：m8-b4-integration、m8-b4-rod、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | **缺** | 4 |
| `jeweled-gauntlet` | completed | A-19, GLOBAL-STAT-01 | 2：m8-b4-rod、m8-b4-catalog* | 3：m8-b4-integration、m8-b4-rod、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | **缺** | 5 |
| `last-whisper` | completed | A-20, GLOBAL-STAT-01 | 3：m8-b4-bow、m8-g02、m8-b4-catalog* | 3：m8-b4-audit-regressions、m8-b4-bow、m8-b10-item-save-replay* | 2：m8-b9-status-events、m8-b10-item-save-replay* | 1：m8-b5-instances | 7 |
| `morellonomicon` | completed | B-01, B-02, GLOBAL-STAT-01 | 2：m8-b4-rod、m8-b4-catalog* | 3：m8-b4-audit-regressions、m8-b4-rod、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | **缺** | 3 |
| `nashors-tooth` | completed | A-21, GLOBAL-STAT-01 | 2：m8-b4-bow、m8-b4-catalog* | 2：m8-b4-bow、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | **缺** | 2 |
| `protectors-vow` | completed | A-11, GLOBAL-STAT-01 | 2：m8-b4-tear、m8-b4-catalog* | 2：m8-b4-tear、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | **缺** | 2 |
| `quicksilver` | completed | GLOBAL-STAT-01 | 2：m8-b4-cloak、m8-b4-catalog* | 3：m8-b4-cloak、m8-b4-integration、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | 1：m8-b5-instances | 5 |
| `rageblade` | completed | A-15, GLOBAL-STAT-01 | 2：m8-b4-bow、m8-b4-catalog* | 2：m8-b4-bow、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | 2：m8-b8-live-cross-round、m8-b8-resource-provenance | 8 |
| `red-buff` | completed | B-07, GLOBAL-STAT-01 | 2：m8-b4-bow、m8-b4-catalog* | 4：m8-b4-audit-regressions、m8-b4-bow、m8-b4-integration… | 1：m8-b10-item-save-replay* | **缺** | 4 |
| `redemption` | completed | B-09, GLOBAL-STAT-01 | 2：m8-b4-tear、m8-b4-catalog* | 3：m8-b3-periodic-integration、m8-b4-tear、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | **缺** | 5 |
| `runaans-hurricane` | completed | B-10, GLOBAL-STAT-01 | 2：m8-b4-bow、m8-b4-catalog* | 4：m8-b4-audit-regressions、m8-b4-bow、m8-b4-integration… | 1：m8-b10-item-save-replay* | **缺** | 4 |
| `shojin` | completed | GLOBAL-STAT-01 | 2：m8-b4-sword、m8-b4-catalog* | 2：m8-b4-sword、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | **缺** | 3 |
| `statikk-shiv` | completed | B-13, GLOBAL-STAT-01 | 2：m8-b4-bow、m8-b4-catalog* | 2：m8-b4-bow、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | **缺** | 2 |
| `steadfast-heart` | completed | GLOBAL-STAT-01 | 2：m8-b4-vest、m8-b4-catalog* | 2：m8-b4-vest、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | **缺** | 2 |
| `steraks-gage` | completed | GLOBAL-STAT-01 | 2：m8-b4-sword、m8-b4-catalog* | 3：m8-b4-integration、m8-b4-sword、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | **缺** | 3 |
| `sunfire-cape` | completed | B-02, GLOBAL-STAT-01 | 2：m8-b4-vest、m8-b4-catalog* | 3：m8-b4-integration、m8-b4-vest、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | **缺** | 3 |
| `thiefs-gloves` | completed | GLOBAL-STAT-01 | 2：m8-b4-gloves、m8-b4-catalog* | 3：m8-b4-gloves、m8-b8-combat-input、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | 5：m8-b5-grant-upgrade、m8-b5-instances、m8-b5-queries… | 8 |
| `titans-resolve` | completed | GLOBAL-STAT-01 | 2：m8-b4-bow、m8-b4-catalog* | 3：m8-b4-audit-regressions、m8-b4-bow、m8-b10-item-save-replay* | 1：m8-b10-item-save-replay* | **缺** | 3 |
| `warmog` | completed | GLOBAL-STAT-01 | 2：m8-b4-belt、m8-b4-catalog* | 4：m8-b4-audit-regressions、m8-b4-belt、m8-b8-equipment-fixture… | 1：m8-b10-item-save-replay* | **缺** | 5 |

缺格（0）：无
