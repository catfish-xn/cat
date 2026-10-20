# Avarice prototype, not in the selectable catalog

Prototype code and successful 4-6 seed23 trace existed at a025389b89463fc24e9f268a7811c1e2f7c184e9. Its six numeric vectors and 4-6 object/JSON replay checks are historical experimental evidence, not current complete-feature acceptance.

Blocked production boundaries:
- room.ts:115 accepts economy operations during battle, but :795 documents that live seat commands never affect frozen battle inputs. battle-resolver.ts:23-35 has no money-change input. Correct live gold scaling therefore needs a server/recorded-combat command interface, outside this task's write permissions.
- b8-restore.ts:272 authenticates opening bank from current gold / settlement goldBefore; PvE direct drops before settlement make goldBefore differ from opening gold. This must be reconstructed from independently validated receipts before integration.
- The baseline does not contain the preparation command ledger. A single-field bank rejection does not establish independent authenticity of the starting Match.gold or protection against coordinated edits.

The prototype is removed from default content rather than advertising snapshot-only behavior as the original effect. No source rule, validation or server contract is relaxed.
