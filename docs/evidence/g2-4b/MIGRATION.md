# G2-4b fixture migration preparation

Pending generation at the final integrated rules tree. No candidate fixture, identity, or passing test result is claimed by this preparation.

## Freeze and commands

Finish integration and choose final rules/content versions before recording. Keep all G2-3 inputs and audits unchanged. Set BASE to the full integrated baseline commit that contains the retained G2-3 fixtures; the scripts verify referenced archived bytes against git show at this commit. They fail on missing or mismatched historical bytes. BASE is provenance, not a request to normalize old states.

Run from repository root, sequentially:

```
node scripts/record-g2-4b-release.cjs --baseline-commit="$BASE"
node tests/fixtures/record-g2-4b-herald.cjs --write
node scripts/record-g2-4b-inputs.cjs --baseline-commit="$BASE"
node scripts/record-g2-4b-live-reveal.cjs --baseline-commit="$BASE"
```

Then verify without rewriting:

```
node scripts/record-g2-4b-release.cjs --baseline-commit="$BASE" --check
node tests/fixtures/record-g2-4b-herald.cjs
node scripts/record-g2-4b-inputs.cjs --baseline-commit="$BASE" --check
node scripts/record-g2-4b-live-reveal.cjs --baseline-commit="$BASE" --check
```

No generation may overlap source editing or timing measurements. Complete consumer edits before recording: Herald source provenance includes the neutral helper and tests. The release/inputs/live-reveal generators fingerprint simulation, server entry, the route/oracle and migration scripts, then reject source mutation during recording. Herald independently fingerprints its full source list and rejects mutation too.

## Evidence retained

- Four public-command routes; 33 battles each; cannon/sniper each retain 67 before/after/final states and full text/object round trips.
- Prior and candidate byte sizes, SHA256, first different byte, first command/event difference, complete ledger, route/oracle fingerprints.
- Five Herald raw states exported before loading production serialization, independent command oracle, full start plus fifteen successor round trips; trajectory/manifest hashes.
- C19 compiled from archived side inputs, independent exact burn interval/death assertions; B8 explicit 0/1/9-unit fingerprints. The C19 snapshot content tag selects the current compiler; no archived Match save is edited or restored as current.
- Live-reveal public mage route, fixed simultaneous and partial-death assertions, historical/current assertion and test-byte evidence. Unexpected tick/event changes need an explained rule cause, not silent expectation refresh.
- Historical opening-random chain remains checked; G2-3-to-G2-4b identity and byte chain is separate. Old versions/digests remain rejected. No assertion that loot replay digest must change or remain unchanged is added.

The consumer imports intentionally point to not-yet-generated G2-4b artifacts. Typechecking/tests that resolve these artifacts must wait until recording finishes; do not create placeholder JSON or weaken assertions. Final version literals in simulation contracts and their direct contract tests are owned by the integration task.
