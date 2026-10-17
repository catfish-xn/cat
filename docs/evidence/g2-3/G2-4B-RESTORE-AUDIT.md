# G2-4b bounded restore audit — WIP

Measured production code checkpoint: `d095d2b30b48b5b2a7708a85ce2e1cb344d40b2b`.
No production code, revision, performance gate, timeout or gameplay convention
was changed for this audit. No full suite ran.

## Production measurements

Reproduce: `node scripts/measure-g2-4b-restore.cjs /tmp/g24-restore.json`.
Raw samples: `G2-4B-RESTORE-TIMING.json`. Node24.19.0, Linux,
Intel Xeon Platinum8573C. The harness bundles the actual production
`restoreMatch` and public rule commands with esbuild, without mocks. It creates
legal states through create/grant/equip/start/step; no combat fields are injected.
Fixture generation, module import and equality assertions are outside timing.
36 checkpoints cover six scenarios at ticks0/1/50/99/100 and actual terminal.
Each JSON/object checkpoint has seven warm samples; terminal cold results are
one restore in a fresh process, not a cold-run distribution.

| Scenario | Terminal tick / units | Warm JSON median ms | Warm object median ms | Cold JSON ms |
| --- | --- | --- | --- | --- |
| No new item | 164 /3 | 1.34 | 1.73 | 17.53 |
| Collector | 103 /3 | 9.06 | 9.03 | 47.19 |
| Gambler | 117 /3 | 9.85 | 10.24 | 50.88 |
| Mogul | 164 /3 | 13.73 | 13.93 | 63.04 |
| Zephyr | 166 /3 | 12.44 | 13.65 | 65.96 |
| Gambler + Zephyr | 152 /3 | 11.65 | 11.73 | 49.61 |

The extra cost has a concrete cause: each restoration initializes a fresh combat
and executes every elapsed tick, then compares authoritative gold/stack data or
all Zephyr combat data. Warm terminal JSON restores here are about6.8–10.3× the
no-item terminal baseline; battle lengths differ, so this is diagnostic cost,
not an isolated per-item causal benchmark. Some cold restores exceed50ms even
for3 units. That is a potential synchronous responsiveness concern, **not a
claim that an existing acceptance gate was run or passed/failed**. No optimization
or caching was introduced. Larger armies, genuine1200-tick states, browser main
thread and repeated every-tick restoration are unmeasured. Replaying every saved
tick through time T entails cumulative quadratic tick work; this audit does not
establish a worst-case latency bound.

## Authority and cache boundaries

`tests/g2-4b-restore-authority.test.ts` uses transparent spies only for call-count
assertions, separately from the uninstrumented measurements. Each Collector,
Gambler, Mogul and Zephyr call performs one fresh `createCombatWithEvents` and
exactly `candidate.tick` real `stepCombat` calls for a valid checkpoint, including
repeated identical JSON and object inputs. The new replay paths have no shared
result cache or cross-call trusted outcome memo.

The whole application is **not cache-free**. Existing `restoredStrategies` caches
up to16 pure compilations keyed by already-validated frozen input JSON, and
`immutable-json` interns immutable declarations/metadata. Both predate this PR
(compare multiplayer0bc011f); neither caches candidate combat acceptance. This
audit does not remove or broaden those existing caches.

Checks cover valid restoration, unchanged inputs, warmed valid→tampered→valid
calls, interleaved seeds, returned-runtime mutation isolation, changed frozen
battle seed, forged current bank, changed absence deadline, and an extra fully
formed Collector opportunity plus the matching RNG cursor. The latter is
constructed by the real receipt kernel and rejected by independent reconstruction,
not by an intentionally malformed receipt ID. No candidate ledger establishes
its own authorization.

Production `restoreMatch` validates tick as an integer in0..1200 before replay.
Negative/fractional/1201/MAX_SAFE_INTEGER/nonfinite values invoke neither combat
creation nor stepping. A forged in-range1199 Zephyr checkpoint stops at the
independently reached real terminal tick and rejects; it cannot force the loop
past combat termination. Measured invalid1201 JSON rejection was at most2.42ms
in this small fixture set. This is a measured sample, not a general bound.

## Voidspawn public entry audit

- Preparation movement uses exported `readItemSummons` / `moveItemSummon` from
  `src/simulation/match.ts`. These are new domain APIs on the existing Match
  boundary, not existing UI actions or an already connected online command.
- The two-sided test now imports `snapshotForBattle`, `restorePlayerBattleSnapshot`,
  `compileBattle`, `startTwoSidedCombat`, `enableMultiplayerSettlement` and
  `lockMatchCombatRoster` from the **existing `src/server-entry` public barrel**.
  It checks the actual persistent chosen cell at A(0,7)/B(0,0), JSON restoration,
  unknown item rejection and failed movement after roster lock. Snapshotting
  itself must precede the roster lock; the public API rejects a new snapshot
  after locking. The test follows that existing lifecycle.
- Movement preserves permanent unit/item assets and population. The position
  map is frozen into solo inputs and private two-sided snapshots and is
  namespaced before the opponent's coordinates are mirrored once.
- No UI/server implementation was changed. `src/server-entry` does **not yet
  re-export the new movement/read APIs**; Claude still needs that export/command
  dispatch and presentation wiring. Therefore this is domain/snapshot integration,
  not a claim of completed online interaction or browser end-to-end acceptance.

The previous combat-only automatic-placement proposal was superseded because
Riot14.6 explicitly made Voidspawn a movable preparation summon;14.8 fixed
cross-round position persistence. These sources were already recorded in
EXTERNAL_SOURCES/RECONCILIATION. Domain movement follows that evidence. Default
placement, collisions and stage-table boundary conventions remain pending;
this audit does not approve them or the Mirror/Trench inheritance proposals.

Claude's required data: `ItemSummonOrigin.kind/ownerId/itemInstanceId/unit`,
including `unit.id/definitionId/team/starLevel/location`; invoke movement with
`itemInstanceId` plus `HexCell`, consume `seatMechanicChanged`, and display the
returned authoritative projection. The saved owner-visible map is
`seatMechanics.seat.g24ItemPositions`; frozen snapshots carry
`itemSummonPositions`. Combat/replay already carry derived summon membership.
Zephyr independently exposes optional `CombatViewUnit.banished`. Presentation
must not mint units, infer a death from absence, calculate stage stats or pay gold.
