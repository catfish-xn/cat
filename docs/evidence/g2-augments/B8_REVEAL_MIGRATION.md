# W4 B7/B8 public-fixture migration

## Scope and evidence classification

Only `tests/m8-b8-live-reveal.test.ts`, `tests/m8-b7-match-wiring.test.ts`, and `tests/m8-b8-equipment-fixture.test.ts` are migrated here. No shared helper, simulator, stored fixture, resource grant, combat-state assignment, or production rule is changed. The existing command-only drivers remain authoritative for fixture acquisition. This is implementation self-check / regression-fixture maintenance, not independent audit.

Tick and event-sequence numbers below are observed trajectory anchors of an actual public-command run, not an independent damage oracle. Independent expectations remain the scenario obligations: two different neutral deaths in one batch, four frozen drop entries, no acquisition before settlement, only the killed source's eligibility, exact-once settlement, strict source-death corruption rejection, and identical continuation after restore.

## Same-tick reveal and partial defeats

The seed-42 mage driver still reaches real 4-7 preparation. Its current chosen augments are Bronze For Life I, Pumping Up II, and Bronze For Life II. The complete team kills r00 and r01 at tick 48, combat event sequences 413 and 414. The four pre-frozen drop entries are all owned by r00, so each reveal must reference event 413; a forged substitution of the real r01 event 414 must fail strict restoration. The test stops at tick 47, restores, and compares the entire next-step transition. It retains four reveals, two deaths, unchanged resources, once-only grants and Continue equivalence.

The previous lone `unit-7` fixture no longer kills a source under the expanded augment route; accepting zero kills would lose the test's purpose. Public bench commands now leave the already acquired two-star Loris `unit-15` deployed instead. He kills only r00 at tick 381 and loses at tick 423. Four direct receipts and two granted item serials survive the defeat. The negative branch keeps the real two-star Lux `unit-12`, who kills only r01 at tick 152 and loses at tick 211; since r01 owns none of the four drops, all four are forfeited. No resources or kill facts are injected, and both branches retain corruption, restoration and idempotency assertions.

## Herald action identity after real earlier maintenance

The live equipment branch previously assumed one tick-one maintenance action from Sunfire. Current Sunfire's declaration starts at tick 40, so changing the expected charge identity from `[1,1]` to `[0,1]` would silently remove the regression condition.

The same complete public sniper route already acquired and equipped Ionic Spark on another hero. The test now uses the public sell command to return that existing item, verifies its inventory location, and publicly equips it to the original single Herald target `unit-1`, slot 1. It round-trips this legal preparation before starting combat. Ionic Spark's periodic shred starts at tick 1; the test requires a real aura contribution and retains the independent charge identity `[1,1]`. The three nonempty raw branches retain one / one / two aura-maintenance actions and the corresponding charge identities. All malformed-status rejection assertions remain.

## Genuine two-Bloodthirster acquisition

The seed-6240 equipment helper still acquires the same four required recipe components through real loot and scheduled choices. The 2-4 sword is item-4, the 3-4 cloak is item-7; original item-1 and item-6 complete the two recipes. Additional assertions pin both combination provenance events: item-1 + item-4 → item-8, and item-6 + item-7 → item-9, both Bloodthirsters. All existing acquisition, scheduled-choice and surviving-inventory assertions remain.

The expanded offer route now chooses Manaflow I and Pumping Up II. Neither increases maximum HP, so original Irelia's independent base-HP expectation is 700 rather than the previous Investment Strategy I's 708. Item definitions and component routing are unchanged.

## Targeted verification

- `npx vitest run tests/m8-b8-live-reveal.test.ts tests/m8-b8-equipment-fixture.test.ts`: initial migrated cases 7/7 pass.
- `npx vitest run tests/m8-b7-match-wiring.test.ts`: 30/30 pass with actual preceding aura maintenance restored.
- Final combined command: `npx vitest run tests/m8-b8-live-reveal.test.ts tests/m8-b7-match-wiring.test.ts tests/m8-b8-equipment-fixture.test.ts`: 3 files, 37/37 tests pass, 17.75 seconds. Includes both added recipe and original-unit identity assertions.
