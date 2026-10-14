# CI140 browser B9 boundary evidence

- Commit: `61b680ec531ba07a21d40c910e7b3cdbb5aa00b4`.
- [Run37905614966 / artifact11604394523](https://github.com/catfish-xn/cat/actions/runs/37905614966/artifacts/11604394523), `m5-browser-dev-mage-sample1`.
- [Job113738228126](https://github.com/catfish-xn/cat/actions/runs/37905614966/job/113738228126).
- Original downloaded ZIP SHA256: `e8e91e8d512ce9a3595f748ba7ab0122779ffccd1ae549a1ab637445bc040fef`, matched GitHub metadata; ZIP CRC verified by parent. Selected files preserved byte-for-byte under gzip; no credentials/environment configuration copied.
- `progress.json`: index153, round36, commandcontinue, elapsed767.187s.
- `failure-state.json`: canonical6-6/ordinal37, phasecombat, tick0/running, completedCount31, pausedfalse, save status saved.
- `manifest.json`: errors exactly three `战斗历史超过冻结边界`; final assertion `normal-time battle timeout`.
- Root cause: `src/m6/application.ts:104` throws when completed history exceeds30; new catalog has33 battles. The domain already finished6-5 as31st battle; subsequent6-6 starts but normal presentation loop no longer advances.
- Owner B9. No timeout increase or blanket browser-job skip is authorized. A later checkpoint must explicitly bound browser assertions at the existing application capacity and retain the complete headless33-battle route, plus itemized tail/final-comparison deferrals. This file records actual failure; it does not claim the adaptation passed.
