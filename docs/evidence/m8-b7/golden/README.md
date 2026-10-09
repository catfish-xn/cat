# B7 golden migration and independent route comparison

The eight PvE rosters replace B6 placeholders. The accepted 947 golden is preserved byte-for-byte in `tests/fixtures/m5/full-match-golden.pre-m8-b7.json` (SHA256 `983806603e27718f263d280c0a4fd42740226bca1e56163f9b5d214ef8ec5fac`). Neither the route generator, independent economic oracle, assert-golden checks nor CI thresholds were relaxed.

`node scripts/update-m8-b7-golden.cjs` records the new observations only after the existing independent oracle passes, exact old commands match, victory/38 settlements/33 battles remain true, and all eight real neutral rosters satisfy independent count, classification, mana and crit checks. This recording alone is not evidence that all trajectory changes are expected.

A separate read-only comparison executed all four builds against the baseline merge tree `bda9a75e20cdee8f40860704a89c301d2a27b886` and current B7. The baseline reproduces every archived state/event hash. `route-difference-proof.json` records the comparison:

- All commands, 38 non-timing economic/HP/XP/streak settlements, economic/build checkpoints, schedule rewards and all four Match RNG streams after every command are identical.
- Sniper, mage and sniper-Caitlyn change only the eight PvE event streams.
- Cannon additionally changes nine later PvP streams. At new PvE 4-7, Tristana gets one extra +125 bps growth event at tick 77, event 225; the baseline has none. Persistent AD becomes 1125 versus 1000. Every later differing PvP input is confined to that Tristana's persistent source/AD. Opponents, formations, seeds and all other inputs match; later growth events match.
- In 5-1 her first tick packet changes raw 116→117 and mitigated 53→54. In 6-2 rounding makes the attacks identical despite differing AD bps; 6-3 first differs at tick 243, crit raw 168→169.
- Causal source chain: `combat-s13.ts:292–303` → `match.ts:202–210` → `strategy-snapshot.ts:92–95`. Combat/growth executor, ability executor, strategy compiler, generator and oracle files are byte-identical between baseline and B7.

Reproduce from the B7 root, with a Node22 baseline checkout containing the same locked dependencies:

```sh
node docs/evidence/m8-b7/golden/compare-routes.cjs /path/to/baseline-merge /tmp/b7-route-review
```

The comparison writes only temporary proof files. The expected list of changed rounds is an observation checked by the comparison, not an alternative battle oracle. These are seed-42 route observations, not blanket balance acceptance. All four routes still have zero fully formed battles and five component grants under the existing deferred B8/B9 assertions.
