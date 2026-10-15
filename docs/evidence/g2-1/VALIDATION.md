# G2-1 candidate validation

Base: `origin/multiplayer@9e3d203cad4d593ac5a54b510f39c84af7118ab8`. Pairing docs were committed separately and opened as PR#92 before content work. Content branch: `codex/g2-1-content`.

- `npm run typecheck`: passed.
- `npm run test:server-entry`: passed;165 start/tick state, event and RNG traces compared as UTF-8 buffers across Node/browser-target bundles; restored continuation, isolated CLI and rejected forged identities included. First battle164 ticks,106 events, unchanged event/RNG hashes. Combat state hash changed with the frozen content-input identity; old probe file remains unchanged, new hash pinned in `tests/g2-1-content-baseline.json`.
- Final targeted run:10 files,159 tests passed in48.07s; no skips or increased budgets. Full suite was not run.

```
npx vitest run tests/g2-1-content.test.ts tests/g2-1-skills.test.ts \
  tests/t13-identity.test.ts tests/m8-content-equivalence.test.ts \
  tests/shop.test.ts tests/tp-shared-pool.test.ts tests/shared-pool-cache.test.ts \
  tests/m5-combat.test.ts tests/m8-contracts.test.ts tests/server/round-commit.test.ts \
  --maxWorkers=1
```

Source extraction, default existing import, generated runtime data and reconciliation checks passed. Frozen raw source was not edited. The independent shop oracle has a new `oracle.g2.cjs` copy with33 literal species; the historical #90 oracle remains unchanged. Four public-command routes finished in victory at round38;134 before/after/final states were re-recorded, text/object restore bytes match, historical #90 recordings and golden remain unchanged. Full byte hashes and first actual command/event differences appear in `release-audit.json`; no identity replacement disguises gameplay differences.

Fourteen fixed-seed skill oracles and five added combat-mechanic regression oracles cover the admitted heroes; all new origin thresholds compile through the real effect compiler, including family mana floors. The shop/pool tests pin nine/eight/six/six/four species with270/200/108/60/36 copies. Bot smoke covers buying and deploying each admitted hero. Source pointer equality covers34 raw hero records,3 origins and44 existing items, including36 recipes.

Scope checks: no `src/server/`, presentation, rendering or public asset changes. Icon manifest records81/81 downloaded source/hash entries; images stay under `/tmp/g2-1-assets`. The candidate remains draft: Swain form stats, the requested ninth component's meaning, and substantive coefficient/hidden-field limitations in the reconciliation need resolution. Passing tests does not establish full inventory or Riot behavior equivalence.
