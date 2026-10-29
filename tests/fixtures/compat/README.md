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

## v25 content identity

`pre-spoils-v25-seed42.json` uses checkout `97068956` with the same isolated
pre-Spoils settlement module from `808d16ae`. Reproduce into a **new** file with:

```sh
git show 808d16ae:src/simulation/g2-3-settlement.ts | node scripts/export-pre-spoils-compat.cjs /tmp/pre-spoils-v25.json
```

The exporter verifies its own serialize/restore, then checks that every gameplay
field equals the retained v24 fixture. Exactly the same five identity fields
listed above differ; no digest is patched and neither earlier fixture is changed.
The regression still requires exact serialized byte equality and continued replay
of both following rounds. This is a settlement compatibility fixture, not epoch
evidence or an old-identity save migration.

### v25 Starry Night identity refresh

At `e0147d72`, both pre-Spoils parameter cases were independently checked against
the retained v25 bytes before updating this fixture. Only `contentDigest`,
`combatInputBasis.contentDigest` (`229d9f7e` → `f671ab88`), and the derived
`m8.loot.frozen.replayDigest` (`55f72339` → `36ebfac2`) differ. Reversing those
identity substitutions restores the old file byte for byte. No gameplay data was
regenerated; v23/v24 files remain unchanged. Full hashes and the corresponding
Swarm/B9 proofs are recorded in [V25_STARRY_PINS.md](../../../docs/V25_STARRY_PINS.md).
