# Additional D12-shard overlap candidates — local only, CI paused

Parent/local measurement baseline: `07af2bfbde736685ba88c23d55623c4aa4f93dee`, tree `ab138503db7f46fc1eec34b35b9386ee23b817b1`. The previously published ten-file work is retained. This follow-up changes four further test files; it is saved locally and must not be pushed or trigger CI until the user gives notice.

The pause notice reached D13 after07af had already been published and automatically created run39372329138. D13 did not manually rerun that run, and makes no later push, CI dispatch or rerun after receipt of the pause. The user controls CI-slot cancellations. This local candidate has no CI result.

## Scope and source

New source: [D12 run39372322168 / job118462717843](https://github.com/catfish-xn/cat/actions/runs/39372322168/job/118462717843), verified run head `1f8a921e06095a545f6874c328a6bd154a431d3c`. `ci-source.txt` preserves the six file totals and reported slower case lines. They establish elapsed times only; they do not establish CPU-contention causality. The local before/after production revision is07af, not D12's1f8, so these are not interchangeable baselines.

All six files fit the general test-review boundary, but only four have preparation changes in this delivery. None was in the old29-file list by its own filename; M6's common helper had already been audited through its mage wrapper. No D12 production file, M5 file, existing shared driver, Vitest/CI scheduling, timeout, threshold, assertion, golden or digest is changed.

- Chest: repeated identical initial CombatState compilation becomes immutable fixture input, with a fresh deep copy for every seed. `combatOf` remains live in the content/compiler tests. Actual grant RNG, item application, candidate sampling, all continuation ticks and validation remain live. The receiver input is prepared once rather than12times, and its reference is released afterward. Warmog acquisition is prepared before the negative save group; each restore still executes in its case.
- Task mechanisms: prewarm only seed77,3151248/glass-cannon-ii,42,112 and the separate wrapped public rod route. Existing public builders return detached copies. No target start, grant/deploy, task traversal, restore or evidence-cache result is cached or moved.
- T12: the seed9 glove route reaches its original unresolved4-4 choice in a scoped hook. The input is plain `{acquired,state}` data, cloned for the one case and released after it. All component/equip/restore/continuation assertions remain in the case.
- Projection: prepare plain first-PvP battle/state data without calling the tested projection or replay builders. Every `toCombatReplayFor`, mirror, playback, identity check and byte-size assertion remains in the case. Scope and release the large stored input immediately after that case; dispose its producing Room. Overtime and empty-board matches remain entirely live.

Conflict boundaries: D12 owns production restoration hot paths and both M5 replay cases/helpers; none is changed. M6's common helper affects four integration wrappers and is untouched. Its141.412s per-battle acceptance and26.293s envelope acceptance are genuine tested work, not a fixture to cache. A smaller possible preparation duplicate is the second `startMatchCombat(record.context)` for the middle-check oracle, after `independentlyStarted` already exists; this was identified but not changed or credited with savings. Any such helper change needs independent measurement and all consumer checks. Shared-pool-room's29.777/23.471s whole matches likewise remain live, including every publication's conservation assertion, revisions, release and ranking.

The supplied D12 restoration stage (~86s) and whole-test325.791/329.747s are external measurements. This follow-up does not claim to explain that gap, reduce concurrency, or achieve240s.

## Validation and actual measured limits

Same baseline lockfile and machine as prior evidence: Debian13.6 / Linux6.18.55 x86_64, AMD EPYC9V74,5 logical CPUs,18007MiB RAM; Node24.19.0, npm11.9.0, Vitest5.0.3, TypeScript5.9.3, Vite7.3.6. CI/D12 use different environments; no direct cross-environment speedup is claimed.

Each of the four files was run alone before and after: `npm test -- <file> --maxWorkers=1 --reporter=json --outputFile=<path>`;39+20+48+9 =116/116 passed both before and after. The exact four files, one worker, shuffled seeds42 and20261020:116/116 each. `npm run typecheck` / `tsc --noEmit` and `git diff --check` pass. No local full suite. The previously published154 cases were verified separately; no combined270-case shuffled run is claimed.

The assertion verifier now also compares explicit object-form test options (including Chest's120000/180000ms limits), in addition to numeric/default limits. Every original expect/deepStrictEqual expression, multiplicity and per-callback assertion set/options matches the full original baseline. `results.json` records the complete AST check and exact tested source SHA256 values. No tested restore/validation decision is reused.

Case budgets improve partly because preparation now runs in hooks. The file intervals below include Vitest's reported file execution interval (`endTime-startTime`), not shell wall time, CPU utilization or a CI-job measurement. The changes are much smaller than the isolated case-budget reductions; preserve that distinction. A single before/after sample cannot establish a causal or repeatable CI speedup. All long real validation/overtime work remains visible in the per-case rows.

| File | Before JSON file interval ms | After JSON file interval ms |
| --- | ---: | ---: |
| g2-4b-unstable-chest.test.ts | 16851.021 | 15523.589 |
| task-mechanism-restore.test.ts | 9355.625 | 8035.338 |
| t12-combat-equip.test.ts | 5975.479 | 5541.072 |
| server/projection-wire.test.ts | 16940.081 | 16619.323 |

## Per-case measured milliseconds

| File | Case | Before | After |
| --- | --- | ---: | ---: |
| g2-4b-unstable-chest.test.ts | pools the 35 ordinary completed items except Thief's Gloves, in apiName order, each as a valid program | 6.251 | 4.715 |
| g2-4b-unstable-chest.test.ts | rewrites legacy mechanic tags and strategy stats into declarative programs (G24-CHEST-04) | 1.144 | 1.443 |
| g2-4b-unstable-chest.test.ts | declares one holder-death grant to four allies ordered by health ratio then id | 0.676 | 0.693 |
| g2-4b-unstable-chest.test.ts | the four healthiest allies by ratio each gain one item when the holder dies; ties break by id; full units still receive | 45.494 | 24.014 |
| g2-4b-unstable-chest.test.ts | summons and structures never receive an item (user 2026-10-17 06:25); the next healthiest champion does | 22.525 | 14.27 |
| g2-4b-unstable-chest.test.ts | every pool item gained mid-combat applies its stats and start effects at once and passes restore validation for the rest of the fight | 3601.812 | 2976.189 |
| g2-4b-unstable-chest.test.ts | granted periodic and stacking items keep working after the grant | 56.651 | 27.98 |
| g2-4b-unstable-chest.test.ts | a mid-combat JSON save continues to the identical terminal state and ledger | 524.792 | 431.45 |
| g2-4b-unstable-chest.test.ts | M1: Lux casts after receiving Nashor, accepts 594 magic damage and rejects 595 | 11.432 | 11.54 |
| g2-4b-unstable-chest.test.ts | M1: Lux casts at two Archangel pulses, accepts 972 magic damage and rejects 973 | 27.058 | 22.653 |
| g2-4b-unstable-chest.test.ts | M1: Vander casts before Shojin arrives, accepts the old 540 physical damage and rejects 541 | 8.666 | 8.045 |
| g2-4b-unstable-chest.test.ts | M2: Lux dies after casting at two granted Archangel pulses; 972 magic restores and continues identically | 287.263 | 230.423 |
| g2-4b-unstable-chest.test.ts | M2: Lux shields Irelia after two granted Archangel pulses, then dies; the ally shield restores and continues identically | 275.338 | 224.277 |
| g2-4b-unstable-chest.test.ts | granted periodic candidates stay bounded by the save clock even without live tasks or a known sample tick | 23.38 | 15.311 |
| g2-4b-unstable-chest.test.ts | three Titans plus three granted Archangels restore after eight pulses without expanding 102 million histories | 99.581 | 95.517 |
| g2-4b-unstable-chest.test.ts | every AP and AD a receiver had since the grant is among the restore candidates for that sample | 1031.714 | 855.165 |
| g2-4b-unstable-chest.test.ts | receivers that attack and cast after the grant keep every mid-combat save valid | 7739.448 | 7404.954 |
| g2-4b-unstable-chest.test.ts | accepts the genuine grants | 0.896 | 1.048 |
| g2-4b-unstable-chest.test.ts | rejects an item outside the pool | 0.631 | 0.629 |
| g2-4b-unstable-chest.test.ts | rejects a future tick | 0.581 | 0.578 |
| g2-4b-unstable-chest.test.ts | rejects a different tick from its siblings | 0.489 | 0.482 |
| g2-4b-unstable-chest.test.ts | rejects a duplicated ordinal | 0.626 | 0.556 |
| g2-4b-unstable-chest.test.ts | rejects a fifth grant | 0.916 | 0.592 |
| g2-4b-unstable-chest.test.ts | rejects a second grant to one receiver | 0.631 | 0.512 |
| g2-4b-unstable-chest.test.ts | rejects an enemy receiver | 0.592 | 0.51 |
| g2-4b-unstable-chest.test.ts | rejects a living holder | 0.54 | 0.465 |
| g2-4b-unstable-chest.test.ts | rejects an unfired chest | 0.5 | 0.513 |
| g2-4b-unstable-chest.test.ts | rejects an extra field | 0.497 | 0.513 |
| g2-4b-unstable-chest.test.ts | a Match save whose unit claims an item it never received is rejected | 1214.934 | 29.18 |
| g2-4b-unstable-chest.test.ts | a Match save with not an array as combat item grants is an invalid save | 6.006 | 5.862 |
| g2-4b-unstable-chest.test.ts | a Match save with a null record as combat item grants is an invalid save | 5.781 | 5.7 |
| g2-4b-unstable-chest.test.ts | a Match save with an item outside the pool as combat item grants is an invalid save | 5.46 | 6.41 |
| g2-4b-unstable-chest.test.ts | a Match save with an unknown item as combat item grants is an invalid save | 5.123 | 5.566 |
| g2-4b-unstable-chest.test.ts | a Match save with a missing chest as combat item grants is an invalid save | 5.706 | 6.757 |
| g2-4b-unstable-chest.test.ts | a Match save with a text ordinal as combat item grants is an invalid save | 5.464 | 4.952 |
| g2-4b-unstable-chest.test.ts | a Match save with a fractional tick as combat item grants is an invalid save | 5.189 | 4.908 |
| g2-4b-unstable-chest.test.ts | A holds the chest: grants go to the holder's own seat and every tick restores | 782.869 | 734.99 |
| g2-4b-unstable-chest.test.ts | B holds the chest: grants go to the holder's own seat and every tick restores | 740.808 | 723.789 |
| g2-4b-unstable-chest.test.ts | a mirror copy of the chest seat fights the identical battle | 300.021 | 310.589 |
| task-mechanism-restore.test.ts | a holder-owned summon kills as itself; holder contribution=false controls only assists, with identical restored ticks | 3635.855 | 3318.859 |
| task-mechanism-restore.test.ts | a holder-owned summon kills as itself; holder contribution=true controls only assists, with identical restored ticks | 3318.912 | 3003.684 |
| task-mechanism-restore.test.ts | saves Morgana curse without a summon or bracer, restores object/JSON, and continues every tick | 245.2 | 193.164 |
| task-mechanism-restore.test.ts | rejects altered or invented target reave facts beside the legal seed 3151248 curse | 86.629 | 66.324 |
| task-mechanism-restore.test.ts | restores the legal target reave and retains Irelia shielding at tick 104 | 37.66 | 33.693 |
| task-mechanism-restore.test.ts | rejects forged Black Rose member cast counts, including redistribution with an unchanged team total | 547.2 | 86.845 |
| task-mechanism-restore.test.ts | restores legal Black Rose member counts and keeps Sion bound at tick 21 | 45.72 | 34.825 |
| task-mechanism-restore.test.ts | rejects corrupted curse attachment binding for object and JSON beside a valid control | 33.409 | 35.843 |
| task-mechanism-restore.test.ts | rejects corrupted curse source binding for object and JSON beside a valid control | 42.992 | 35.355 |
| task-mechanism-restore.test.ts | rejects corrupted curse timing binding for object and JSON beside a valid control | 40.61 | 53.197 |
| task-mechanism-restore.test.ts | rejects corrupted curse action binding for object and JSON beside a valid control | 34.029 | 32.973 |
| task-mechanism-restore.test.ts | rejects corrupted curse amount binding for object and JSON beside a valid control | 35.377 | 46.572 |
| task-mechanism-restore.test.ts | rejects corrupted curse missing binding for object and JSON beside a valid control | 31.108 | 35.863 |
| task-mechanism-restore.test.ts | rejects transferring pulses to another real Morgana even with rebuilt source/holder/key identities | 54.599 | 58.659 |
| task-mechanism-restore.test.ts | rejects an appended fake bleed while retaining every genuine Morgana curse pulse | 34.615 | 35.346 |
| task-mechanism-restore.test.ts | restores a living Bulky Buddies holder after its Forge buddy dies and Jayce revives that same Forge | 788.956 | 668.743 |
| task-mechanism-restore.test.ts | compares every restore for tasks only while reusing only exact detached replay evidence | 84.961 | 69.569 |
| task-mechanism-restore.test.ts | compares every restore for bracer and tasks while reusing only exact detached replay evidence | 101.707 | 87.326 |
| task-mechanism-restore.test.ts | bounds replay evidence, separates complete input contents and detaches every returned graph | 37.687 | 35.11 |
| task-mechanism-restore.test.ts | reuses verified hashes and incrementally hashes appended events against the full-ledger oracle | 116.624 | 101.338 |
| t12-combat-equip.test.ts | offline pve preparation: inventory, bench, board and in-place combine; ownership/phase rejects | 8.328 | 9.01 |
| t12-combat-equip.test.ts | offline pve combat: inventory, bench, board and in-place combine; ownership/phase rejects | 4.984 | 4.897 |
| t12-combat-equip.test.ts | offline pve choice: inventory, bench, board and in-place combine; ownership/phase rejects | 4.797 | 4.814 |
| t12-combat-equip.test.ts | offline pve settlement: inventory, bench, board and in-place combine; ownership/phase rejects | 4.068 | 4.416 |
| t12-combat-equip.test.ts | offline pvp preparation: inventory, bench, board and in-place combine; ownership/phase rejects | 6.312 | 6.28 |
| t12-combat-equip.test.ts | offline pvp combat: inventory, bench, board and in-place combine; ownership/phase rejects | 6.111 | 6.208 |
| t12-combat-equip.test.ts | offline pvp choice: inventory, bench, board and in-place combine; ownership/phase rejects | 6.956 | 6.052 |
| t12-combat-equip.test.ts | offline pvp settlement: inventory, bench, board and in-place combine; ownership/phase rejects | 5.901 | 5.891 |
| t12-combat-equip.test.ts | online pve preparation: inventory, bench, board and in-place combine; ownership/phase rejects | 3.477 | 3.618 |
| t12-combat-equip.test.ts | online pve combat: inventory, bench, board and in-place combine; ownership/phase rejects | 5.76 | 3.466 |
| t12-combat-equip.test.ts | online pve choice: inventory, bench, board and in-place combine; ownership/phase rejects | 2.973 | 2.949 |
| t12-combat-equip.test.ts | online pve settlement: inventory, bench, board and in-place combine; ownership/phase rejects | 3.088 | 5.533 |
| t12-combat-equip.test.ts | online pvp preparation: inventory, bench, board and in-place combine; ownership/phase rejects | 5.305 | 5.059 |
| t12-combat-equip.test.ts | online pvp combat: inventory, bench, board and in-place combine; ownership/phase rejects | 5.139 | 5.143 |
| t12-combat-equip.test.ts | online pvp choice: inventory, bench, board and in-place combine; ownership/phase rejects | 4.851 | 4.469 |
| t12-combat-equip.test.ts | online pvp settlement: inventory, bench, board and in-place combine; ownership/phase rejects | 4.591 | 4.669 |
| t12-combat-equip.test.ts | sword + worn sword yields deathblade with one permanent ID | 3.128 | 2.935 |
| t12-combat-equip.test.ts | rod + worn rod yields deathcap with one permanent ID | 2.249 | 2.163 |
| t12-combat-equip.test.ts | bow + worn bow yields red-buff with one permanent ID | 2.053 | 2.317 |
| t12-combat-equip.test.ts | sword + worn rod yields gunblade with one permanent ID | 2.254 | 2.3 |
| t12-combat-equip.test.ts | sword + worn bow yields giant-slayer with one permanent ID | 2.009 | 2.048 |
| t12-combat-equip.test.ts | rod + worn bow yields rageblade with one permanent ID | 1.953 | 2.143 |
| t12-combat-equip.test.ts | tear + worn tear yields blue-buff with one permanent ID | 2.012 | 2.191 |
| t12-combat-equip.test.ts | vest + worn vest yields bramble-vest with one permanent ID | 1.906 | 1.98 |
| t12-combat-equip.test.ts | gloves + worn gloves yields thiefs-gloves with one permanent ID | 3.567 | 3.078 |
| t12-combat-equip.test.ts | also accepts every current ordinary recipe with a full final three-slot set | 64.632 | 65.723 |
| t12-combat-equip.test.ts | retains ownership, slot, unique and exclusive failures without a resource/ID/RNG/event change | 3.766 | 3.675 |
| t12-combat-equip.test.ts | 3-5 sword+rod: consumed frozen component survives restoration; every tick is unchanged | 356.143 | 355.792 |
| t12-combat-equip.test.ts | 3-5 gloves+gloves: consumed frozen component survives restoration; every tick is unchanged | 309.395 | 308.261 |
| t12-combat-equip.test.ts | 3-7 sword+rod: consumed frozen component survives restoration; every tick is unchanged | 341.339 | 328.636 |
| t12-combat-equip.test.ts | 3-7 gloves+gloves: consumed frozen component survives restoration; every tick is unchanged | 363.772 | 323.224 |
| t12-combat-equip.test.ts | running restore rejects free detachment, cross-unit combining, non-equipment mutation and illegal suffixes | 25.499 | 18.071 |
| t12-combat-equip.test.ts | online PvE equipment commands conserve pool holdings and failed transactions retain both references | 10.492 | 12.615 |
| t12-combat-equip.test.ts | locked live-seat in-place combination preserves both sides and mirror frozen result byte-for-byte | 288.288 | 256.972 |
| t12-combat-equip.test.ts | 3-5 preparation: equip and in-place combine restore and continue identically | 21.27 | 17.901 |
| t12-combat-equip.test.ts | 3-5 settlement: equip and in-place combine restore and continue identically | 49.011 | 40.901 |
| t12-combat-equip.test.ts | 3-7 preparation: equip and in-place combine restore and continue identically | 17.589 | 18.265 |
| t12-combat-equip.test.ts | 3-7 settlement: equip and in-place combine restore and continue identically | 35.341 | 34.864 |
| t12-combat-equip.test.ts | augment choice and supply choice retain offers while equipment saves resume | 624.05 | 529.032 |
| t12-combat-equip.test.ts | PvE settlement permits in-place combination and preserves direct grant order on restore | 126.199 | 104.441 |
| t12-combat-equip.test.ts | rejects the T11 digest without migration | 2.887 | 2.888 |
| t12-combat-equip.test.ts | a permanent unit killed in this combat can equip; next battle uses the new stats | 829.414 | 636.445 |
| t12-combat-equip.test.ts | pve: latest board/bench gear migrates after deferred merge, frozen rewards commit once | 61.294 | 55.434 |
| t12-combat-equip.test.ts | pvp: latest board/bench gear migrates after deferred merge, frozen rewards commit once | 110.962 | 95.506 |
| t12-combat-equip.test.ts | T12 supply choice permits fresh component transactions and single-save continuation | 1638.757 | 19.675 |
| t12-combat-equip.test.ts | T12 an existing frozen glove roll and a new parent roll remain independent | 457.34 | 433.11 |
| t12-combat-equip.test.ts | T12 online PvE restores the frozen player descriptor and keeps every live-seat combat tick unchanged | 119.452 | 134.533 |
| t12-combat-equip.test.ts | T12 restore rejects a fabricated cross-unit recipe although births and recipe are valid | 10.479 | 11.072 |
| server/projection-wire.test.ts | sends only the private view: first snapshot, increments, resume snapshot and the fault snapshot | 140.368 | 117.788 |
| server/projection-wire.test.ts | keeps the fault snapshot projected | 125.051 | 112.932 |
| server/projection-wire.test.ts | hands the local client the same projection on pushes, accepted and refused commands | 43.403 | 35.345 |
| server/projection-wire.test.ts | mirrors side B (cells, movement, cast cells, unitUpdated, teams, result) and plays to the terminal view | 2454.732 | 178.431 |
| server/projection-wire.test.ts | mirrors every coordinate-bearing replay field, including ones a short battle may not produce | 1.516 | 1.384 |
| server/projection-wire.test.ts | builds PvE replays from the rules own combat (start, finish and ledger; no per-tick frames kept) | 442.233 | 437.857 |
| server/projection-wire.test.ts | sends each battle once as the room's own replay and never as combat frames (C6) | 462.579 | 441.147 |
| server/projection-wire.test.ts | runs a match past 6-7 into overtime-N rounds and ends with a unique ranking | 12472.794 | 12094.403 |
| server/projection-wire.test.ts | ends a match of eight empty boards in a bounded number of rounds (every draw costs both real seats HP) | 797.081 | 876.323 |
