# G2-4b eleven mechanism items — WIP

Base: `0bc011fa1c3a2b4947c86b24c4367a90268cc10d`, target `multiplayer`.
Scope: eight artifacts and Shroud, Zephyr, radiant-ID Zz'Rot support item.
No forges, Conqueror tier restoration, UI, or server implementation.

The source extraction is reproducible with
`python scripts/extract-g2-4b-mechanism-items.py`.
The resulting normalized JSON contains exact archive hashes, English JSON
pointers, map22 keys, and the actual Chinese localization references for all
eleven items. All eleven belong to TFTSet13; map22 constants equal English
effects. 14.24 is the authorized archive for 14.24b (no B-patch artifact/support
changes, confirmed by the user's dispatch and supplied values investigation).

Important distinctions:
- Normal Mogul's Mail grants 1 gold at 35 stacks, not the HR variant's 3.
- Normal Gambler's Blade has AS 45, 1% per gold capped at 30 gold, and 5% proc.
- Trench Coat uses 50% trigger / 30% copy HP, not later patches' 66% / 25%.
- The actual Zz'Rot map22 localization reference resolves to 兹若特传送门;
  another legacy string says 兹若特的邀请 and must not be selected by substring.

Unresolved source semantics, not adopted conventions: Voidspawn stage HP/AD,
copy equipment/stat inheritance. Beam width, collision fallback and Fishbones
target-pool/stacking rules are explicitly provisional conventions in overrides.
No incomplete item is registered merely because its numeric extraction exists.
Fishbones, Spectral Cutlass and Shroud are now registered. The runtime policy
revision/digest have changed; old fixture migration is still pending (WIP).

The two planning attachments were read through the supported Library read API.
Local signed-URL materialization was denied by the network proxy (HTTP 403).
Their older scope proposals do not supersede the latest eleven-item dispatch.

Validation: source pins, item kernel, gold receipt kernel, Fishbones real Match
roundtrip/multi-target, Cutlass geometry/public save, and Shroud two-seat tests.
The gold/deferred-damage kernels are not connected to settlement/combat yet.
Eight items, final fixture migration, final full suite, CI and JS measurement
remain pending. This branch must remain a draft until complete.

Draft PR creation attempted with gh (normal and approved escalation); both
returned GitHub GraphQL Forbidden. Git push succeeded.

## Checkpoint after replay and source follow-up

- Added `tests/g2-4b-replay.test.ts`: all three registered items reproduce every
  compact replay frame; omitting an attack event rejects replay. The Shroud
  case also checks the restored maximum mana after first cast.
- Related execution: the previous eight files / 36 tests passed; the added
  replay file and changed Cutlass adapter were checked together (two files /
  seven tests passed, including four existing Cutlass tests). Total distinct
  tests across these checkpoints: 39. No full suite has run.
- `npm run build` passed, including TypeScript checking. No independent review.
- Cutlass's inactive ticks now avoid allocating and sorting the whole army.
  This preserves outcomes and does not change policy values.
- JS gzip level 9: 552935 bytes, **1.3017494462x** the CI-pinned signed-off M7
  build (`15313a75c6e74beec739fe52a2875c104c55eae3`, 424763 bytes).
  Against branch base `0bc011f` (550288 bytes): **1.0048102085x**.
  See `G2-4B-WIP-JS.json`. This measures size only, not interactive performance;
  it is not final-PR-head acceptance and does not claim CI is green.
- Latest fetch still has `origin/multiplayer` at the base above. Predecessor
  merges are not present. Final synchronization and another revision bump are
  outstanding. Do not merge this branch.

Remaining implementation boundaries (not claimed as permission blockers):
gold must connect opportunities to battle state, settlement payouts, economy
replay and save authority; Gambler additionally needs an authoritative bank
snapshot. Existing High Roller receipts cannot represent item gold. Deferred
damage needs shield/redirect ordering and event/restore integration. Zephyr
needs true absence from action, area-target and passive processing, not merely
stun/untargetability. Clones need authoritative membership and inherited stat
compilation without counting additional traits or minting inventory assets.
Voidspawn requires a verified stage table and spawn/restore integration.
