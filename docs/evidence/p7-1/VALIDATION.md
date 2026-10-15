# P7-1 rules validation

Implementation commit: `409a11c9ea27885b66017ed069fde9234af9bb4f` (tree `acaba5a40a50581639725634c6ba6eb1c2336fbc`), directly based on `343877a5d364231ac64cdca0e2b7882730f35dea`.
Source checks use this implementation tree; final standard tests additionally include the latest multiplayer documentation. The following evidence-only commit does not change code, configuration or fixtures. No Opus server commit is included. This PR must not merge or release independently: Opus stacks the server adapter/test PR on this branch and validates the combined tree before ordered merges.

- CONTENT: `fnv1a32-utf16:22f31569` → `fnv1a32-utf16:bb66f4f8` (one change).
- LOOT_REPLAY: `fnv1a32-utf16:028e5593` unchanged.
- Targeted rules/identity: 4 files / 25 tests passed (`targeted-tests.txt`).
- Typecheck passed (`typecheck.txt`).
- Server entry passed, 145 inputs; UTF-8 state/event/RNG equality and text/object restore checks (`test-server-entry.txt`).

## Standard test runs

All full runs use exactly `npm test`, with no pool/worker/isolation overrides. No timeout, budget or test configuration was changed.

1. `npm-test.sandbox.txt`: 234 files, 2,938 tests; 2,910 pass / 28 fail. **Every failure is in tests/server/**; all nonserver tests pass. Seven carousel-room failures, one LocalRoomClient timeout, and 20 socket/listen failures under the sandbox (`EPERM 127.0.0.1`). Duration 685.56 s.
2. `npm-test.unsandboxed-first.txt`: repeated with permission to bind local sockets: 234 files, 2,938 tests; 2,928 pass / 10 fail. Server failures reduced to the same seven carousel-room cases and one LocalRoomClient timeout. Two existing nonserver tests exceeded their unchanged wall budgets: B7 4-7 restore (20 s) and B8 mutable-input replay (5 s); both passed in run 1. Duration 774.84 s. Preserved rather than hidden.

3. Final standard validation runs against the exact source merge with multiplayer `8288ea3f6984db6e38e1f7b016677dd96fd71572`: tree `3d15effd9f1ed3620d07891c4d6c5a96525e76ad`. The target advanced from the requested base by two docs-only commits, solely appending 14 lines to DISPATCH. This temporary documentation merge is not added to the rules branch. **Final result: 234 files, 2,938 tests; 2,930 pass / 8 fail, all failures in tests/server/. Nonserver failures: zero. Duration 720.24 s (`npm-test.txt`).** The only failing files are carousel-room.test.ts (7) and local-room-client.test.ts (1), listed below.

Timing first run (`test-timing.first.txt`): 6 files, 31/32 tests passed in 258.93 s. Existing B8 replay one-tick budget failed: median startup 11.77 ms (pass), median longest advance 101.93 ms (>50 ms). Source, input, fingerprints, sample counts and budgets are unchanged. **Final serial rerun: 6 files / 32 tests passed, zero failures, 250.68 s (`test-timing.txt`), exact `npm run test:timing`, no concurrent full test or fixture generation.**

## Fixture and byte evidence

`release-audit.json` replays the public routes and compares all 134 archived states with the explicit content identity change; commands/events/RNG remain equal. Raw bytes are independently compared, not normalized, in `fixture-byte-evidence.json`: ten files list old/new byte counts, SHA256 and first difference. `battle-byte-evidence.json` compares compiled C19 bytes and retains identical B8 fingerprints.

Herald fixtures were re-recorded using public routes, exported before production restore import, and checked with five restore/start/15-tick continuations. The raw fixture manifest pins source SHA256 `824ae6ac72d0931360573508c63ebf933870d1e698a47ea3869be8a7501afc13`. Archived G2-2 fixtures remain untouched.

## Server handoff and expected failures

No src/server/ or tests/server/ files were edited. MULTIPLAYER_CONTRACT §21.6 and MATCH_CONTRACT's P7-1 revision define the migration and command/failure enums: runtime openingPending removed, private pendingCarouselUnits renamed heldCarouselUnits, canonical heldCarouselUnits and preparationReceipts added; pendingUnits/type alias and old command exports remain deprecated compatibility aliases.

Expected broken tests/server/carousel-room.test.ts cases:

1. opens the match with the 1-1 carousel on createCarouselMatch seats: no free unit, no gold, no component, no shop
2. runs on the rules' release times, auto-picks bots on release and the rest at the deadline, then deals the first shop
3. a disconnected player is picked for at the deadline (not on release) and resumes onto the same carousel
4. a timer firing early, with time passing during the catch-up, never skips a release batch (real clocks do both)
5. option B: stays until the deadline and departure after every seat holds a unit
6. 2-4 releases lowest HP first, replaces the component supply, settles the round once and the match plays to its end
7. faults the room when the rules refuse to open the carousel

The existing LocalRoomClient `plays the room from the first preparation to the final ranking, pushing one replay per battle round` also timed out in both full runs; handed to Opus without modifying its budget.

`tests/server/e2e/p7-carousel.mjs` was not run or edited. Its 1-1 segment expects no free unit, an opening carousel, ring/board button and Space switching, release batches, click-pick, disconnected B auto-pick/recovery, and deadline/departure. These assertions need the restored free-Irelia opening and migration of carousel interaction checks to 2-4. Its subsequent 2-4 segment also relies on the removed prelude. Opus must cover heldCarouselUnits projection and bench/board/held outcomes.

Console logs retain test output with trailing blank lines at EOF removed for diff whitespace checks; fixture byte evidence uses unchanged binary/UTF-8 fixture bytes.
