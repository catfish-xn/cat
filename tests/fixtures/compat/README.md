# Spoils compatibility baseline

`pre-spoils-seed42.json` freezes the review-E public route:
`createMatch(42) → resolveM5Choices → fieldBench → startMatchCombat → stepMatch` until settlement.

Generated in an isolated `/tmp` copy of `23ff9d74307bfe7664efc3f3ee5d24c237697ec6`,
with only `src/simulation/g2-3-settlement.ts` replaced by its pre-fb3prog version
from `808d16ae` (`git show 808d16ae:src/simulation/g2-3-settlement.ts`).
The baseline exporter asserted its own serialize/restore round trip before writing the bytes.
No digest fields were patched. Review E's original pre2 JSON has an older content
identity; regenerating with current content isolates this settlement compatibility
check from the separately recorded v23 content epoch.

The regression requires exact serialized byte equality and restores the frozen
JSON with independently recorded battle history before comparing subsequent rounds.

## v24 content identity

`pre-spoils-v24-seed42.json` repeats the same public seed-42 opening with the
unchanged working-tree source at `8aa8c627` and **only** the settlement module
replaced by `git show 808d16ae:src/simulation/g2-3-settlement.ts` at bundle time.
The exporter checks `restoreMatch(serializeMatch(state))` before writing; no
digest is patched. The original v23 baseline above remains untouched.

A structural comparison against `pre-spoils-seed42.json` has exactly five differences:
`rulesVersion`, `contentVersion`, `contentDigest`, `combatInputBasis.contentDigest`,
and `m8.loot.frozen.replayDigest`. All combat, reward, receipt, RNG and roster data
are identical. The current settlement implementation must still match the new
pre-Spoils bytes exactly and continue both following rounds with full history.
