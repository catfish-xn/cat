# CI209 first page.evaluate payload diagnosis

Read-only investigation: no browser run, no repository changes, no production changes, no callbacks or CI modified. All files are local diagnostic artifacts.

## Finding

The unchanged argument exceeds Chromium DevTools pipe capacity after the exact locked Playwright 1.63.0 serializer. This directly matches the CI209 stderr at 08:16:47.793, before the first measurement callback marker and before cleanup. It is not an inferred out-of-memory failure.

- Original plain JSON: 68,699,305 bytes (65.516763 MiB).
- Playwright client protocol argument: 124,775,324 bytes. This is not the Chromium CDP message.
- Actual Chromium CDP serialized fixture argument: 107,470,221 bytes (102.491590 MiB).
- CDP command lower bound: 107,480,699 JSON bytes; NUL-terminated pipe message 107,480,700 bytes. Runtime object IDs, session ID and command ID were deliberately replaced by minimum-size placeholders; their actual CI values were not recorded, so the exact final CI message length is not claimed.
- Chromium limit from CI stderr: 104,857,600 bytes. Lower-bound excess: 2,623,100 bytes.
- Playwright pipe transport writes JSON.stringify(message), then one NUL (locked bundle lines 39429–39430).
- Client→driver protocol roundtrip produces the same encoded argument hash and length.

## Exact source and route match

- Local HEAD at start: 8014d83e3364bad4da3dcf46873207f30b981ba2; CI sha: e77dd38da5c525b1915698a0663472724ff1fdcb.
- Source fingerprint matches CI: 85307dbc1cc695a410f9f8d301f1f0ef040ef7c1b9e83d3154f94ac13c505755
- Project evidence scriptHash matches CI: 0ed69956cccb528183faf4764b4aa61b28210c683ffb83ab21e1c5af1a5949dc
- Actual script-file SHA-256: f459b61f3c8b76b84fc6775c5b279186b307ad4f9c4e92f9441c6f33e7c74853. Project evidence scriptHash uses its project-specific hash input representation.
- All five complete sizes, incremental selected sizes, deterministic route summaries, selected payload metadata and bounded-envelope hash match CI209 exactly. Runtime timings intentionally differ.

## Full fields (bytes and SHA-256)

- complete: plain 25,153,739; standalone codec 40,153,386; plain SHA-256 cba941d401794051a52db0d361774eb5ee2fa0bb1b7029997524c55edf5bf5ea
- current: plain 20,019,632; standalone codec 32,139,520; plain SHA-256 683eb25047d8a679e2b62f32df654e55a9910023d645919805c2f1597e2f9166
- record: plain 1,982,398; standalone codec 3,012,316; plain SHA-256 0a706bf6c0e9088b84a137addae3024efbf2c858a3f862135eba62580df1d94f
- fullLoad: plain 21,543,400; standalone codec 34,878,166; plain SHA-256 b2f35cc491a91e516a3a35ebb5a461e33745072fc7b9124ae7c1b4815a4f1700
- expectedBattleCount: plain 2; standalone codec 2; plain SHA-256 c6f3ac57944a531490cd39902d0f777715fd005efac9a30622d5f5205e7f6894
- restorationIssue: plain 45; standalone codec 45; plain SHA-256 d7194dcb56051d7b0e53dbffc980cdf2361f6e78f854da998395a4f289d721a9

The current envelope is 20,019,632 bytes and includes 28 completed battles plus round-33 current battle. The manifest incrementalBytes=2,190,029 describes the separate {match,currentBattle,battleKeys} selection metric, not the transmitted current envelope. complete and fullLoad each have 33 completed battles.

## Graph and JSON fidelity

- No undefined values. Plain JSON roundtrip deepStrictEqual passes for values, but does not preserve identity.
- Original graph: 518,938 unique objects; 19,685 repeated-object edges; 3,619 cross-field alias edges.
- current→record: shared context, initial, and 3,614 current-prefix event objects (3,616 cross-field edges total).
- complete→fullLoad: match.m8.round, match.m8.preparation.enemies, and one enemy also referenced by fullLoad.match.preparation.units[9] (3 cross-field edges).
- The full edge list is graph-aliases.json. JSON cloning raises encoded size to 113,818,566 bytes, so dropping identity does not solve the cause.

## Candidate transport proposal; not implemented

- Two connected groups preserve all current cross-field aliases: {complete,fullLoad} and {current,record}.
- Exact standalone encoded group sizes: 75,143,636 and 32,212,896 bytes, each below the pipe bound.
- Offline decode/reconstruction passed deepStrictEqual, full SHA-256 identity, and exact alias graph equality.
- A fix could preload these groups into JSHandles before the original measured callback, then construct its original fixture object from those handles. No data trimming, fixture changes, measurement callbacks or samples are necessary for this candidate.
- Future fixture changes require guarding against cross-group aliases and checking serialized group size; one-field-at-a-time handles would break current aliases.
- Actual browser behavior is not validated by this offline task.

## Reproduction and files

- reproduce.sh records exact run commands. generate.cjs compiles the original prefix with its original filename for resolution; generation-copy.cjs preserves the actual executed source.
- fixtures-preserve-identity.v8 preserves graph identity. fixtures.json and each top-field JSON preserve full value bytes.
- locked-playwright-coreBundle.js is the installed pinned implementation; serializer-extracted.cjs contains unmodified extracted serializer, evaluation and CDP parameter-builder functions.
- identity-preserved-cdp-message-empty-dynamic-ids.json preserves the measured command lower bound.
- measured-summary.json, generated-summary.json, group-and-ci-comparison.json, *.log, CI manifest and raw CI job log contain the machine-readable evidence.
