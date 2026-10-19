# Existing replay refusal on multiplayer 829128f

Reproduction input: seed 42 full-room ledger, battle `bot-room:r23:b1` (round 23), 1,241 events, terminal tick 463.

`toCombatReplay` throws `RangeError: replay-divergence` on pure 829128f, integrated baseline 79fa6b9, and the optimization candidate. No test or validation was disabled. The full-room diagnostic records this refusal separately from successful byte comparisons.

The initial roster appends `['t2','b6','unit','unit-24']:g23-forge` after `['t2','b6','unit','unit-7']` (actual IDs use double-quoted JSON). `snapshotCombat` appends the junker-king forge after sorting normal units. `advanceS13Tick` sorts the roster by ID each tick. `alignReplayUnits` requires surviving units to preserve their order, so the first step rejects the reordered forge. This is present upstream and was not changed as part of performance-only work.

Raw reproduction input and every outcome's metadata are retained in the workspace evidence directory. The optimized and baseline paths reject exactly the same inputs.
