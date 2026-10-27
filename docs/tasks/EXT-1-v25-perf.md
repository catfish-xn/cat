# EXT-1 · v25: bring the 8-bot whole match back under the 60 s budget

## Start point
- Repository `catfish-xn/cat`, branch **`claude/v25-perf-wip`** (commit `b862cdac`).
- It is `claude/v25-integration` (`d239794b`, the batch-5 integration) plus a first performance pass:
  - 8-bot whole match: 74.7 s → 68.5 s.
  - Equivalence evidence: seed 42 has identical final ranking, 154 battle ledgers and receipts, and all 127 public replays are byte-identical.
- Read `docs/V25_PERFORMANCE_FOLLOWUP.md` first: it has the profiles, hot spots and repro commands.
- Push your work to the new branch **`codex/v25-perf`**. Do not push to `claude/v25-integration` or `multiplayer`.

## Goal
`tests/server/bot-driver-timing.test.ts` › "plays eight bots from the first round to a unique ranking; every intention is accepted by the rules" must pass reliably under its existing 60 s budget, with margin (target ≤ 55 s on an otherwise idle machine).
- `origin/multiplayer` passes this test today.
- v25 is slower because batch-5 augments added more combat events (111,588 → 176,176 events for the same seed), plus history sampling, death samples, authority replay and per-tick augment hooks.

## Where to look
- Combat execution and per-tick copies:
  - `src/simulation/two-sided-battle.ts`
  - `src/simulation/combat-s13.ts`, `combat-s13-state.ts`, `combat-static.ts`
  - `copyCombatUnitForTick`
- History and death sampling:
  - `src/simulation/augment-death-samples.ts`
  - `src/simulation/augment-history.ts`
- Encoding and freezing:
  - `src/simulation/immutable-json.ts`
  - `src/simulation/content/freeze.ts`
  - `src/simulation/content/index.ts`
  - `src/simulation/shared-pool-ledger.ts`
- Tools on the branch:
  - `scripts/mp-sim-perf-probe.cjs` (CPU probe, compares two checkouts on one seed)
  - `scripts/compare-bot-perf-evidence.cjs`
  - `scripts/bot-perf-event-capture.cjs`

## Hard rules
- **Behaviour must be bit-for-bit unchanged.** Same seed must give the same final ranking, commands, every MatchEvent (not only combat events), ledgers, receipts, replay bytes and content/loot identities.
  - Extend `scripts/compare-bot-perf-evidence.cjs` to compare all MatchEvents before vs after, for at least 3 seeds (e.g. 42, 7, 19), and commit the evidence summary under `docs/`.
- Do not raise, relax or skip any timing budget, test timeout or hook timeout. Do not delete or weaken assertions.
- No game rule or number changes. Do not touch epoch evidence or recorded fixtures; released epochs (v23 and older) are immutable.
- `src/server/` must not gain `setTimeout`, `Date.now`, `performance.now` or the word `window`.
- Online multiplayer is the only target; solo mode does not matter.
- Do not delete or rewrite other branches, do not force-push, do not edit `.github/workflows`.

## Acceptance
1. Run alone on an idle machine:
   ```
   npx vitest run tests/server/bot-driver-timing.test.ts
   ```
   Must pass. Report the wall time of 3 consecutive runs.
2. `npx tsc --noEmit -p .` passes.
3. `npx vitest run tests/mp-sim-perf.test.ts tests/restore-canonical-encoding.test.ts tests/server/net/server-whole-match.test.ts` passes.
4. The before/after equivalence evidence for ≥ 3 seeds shows zero differences.
5. `node scripts/update-content-identities.cjs --check` passes. If identities change you have changed behaviour, so stop and fix.

Report in Chinese in `docs/V25_PERF_DONE.md`: hot spots, what changed, timings before and after, equivalence evidence.
