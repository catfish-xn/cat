# S13 P1 implementation checkpoint (not signed off)

Base: 075e9a494758b13620c8ae36e55364cc214fd364 (multiplayer v11).
Branch: codex/s13-augments-p1. Versions deliberately unchanged until integration.

Implemented and targeted checks completed: Going Long, Hedge Fund, Investment Strategy II (shared income); Blinding Speed, Portable Forge, Radiant Relics (acquisition receipts/choice); Avarice Incarnate (5 gold and damage scaling, authenticated combat bank).
- tests/s13-p1-income.test.ts: 8 passed after correcting Going Long to round start (not settlement).
- tests/s13-p1-acquisition.test.ts: 3 passed, pending/selected/next-round object/JSON restore.
- tests/s13-p1-avarice.test.ts: 6 independent damage vectors passed.
- node scripts/verify-s13-p1-avarice.cjs: seed 23 public command path to 4-6 passed acquisition, object/JSON restore, forged bank rejection, state/event continuation.
- Full regression, integration boundaries, final typecheck and g2-4b fingerprints pending. This is WIP, not a completed feature release.

Avarice 40 means percentage, not gold. Total amplifier capped at 40% follows the 14.24 English parenthesis; this text-derived interpretation is recorded for review. The original grant is one-time 5 gold.

Remaining: Duo Queue, Heroic Grab Bag, Level Up, Headhunter, Calling Card, Into the Unknown, Ultimate Hero, Dual Wielding. Dependencies are being examined rather than publishing nonfunctional selectable definitions. In particular baseline lacks the B preparation-command ledger, held lesser duplicators, full emblem effects/trait projection, and four-star unit representation.

No server/rendering edits, timeout changes, skipped tests or full-suite run. Historical g2-3/g2-augments directories untouched. No external push yet.
