# G2-4B restore diagnostic: expanded lawful inputs

This is a diagnostic protocol, not a performance acceptance gate. It does not change production code, timeouts, budgets, or correctness assertions. Existing historical reports remain untouched; the script refuses to overwrite an existing report or retained fixture.

## Scenarios

The six existing small-army scenarios retain their original seed, public-command construction, equipment, checkpoints (ticks 0, 1, 50, 99, 100 when reached, plus terminal), and seven warm JSON/object samples. Their cold observation remains one fresh-process **terminal JSON** restore. All cold restores now additionally assert complete state equality, rather than checking only the tick.

Two new diagnostic scenarios intentionally use larger legally acquired armies, not claims about a typical player's naturally obtained inventory:

- `largeGoldMix`: target round 3-5; nine two-star heroes and six gold items.
- `lateGoldMixZephyr`: target round 4-1; the same army/items plus Zephyr, to exercise the complete-state replay path as well as longer round/resource history. This scenario has not yet been executed in the preliminary validation below.

The army is Dr. Mundo, Garen, Illaoi, Elise, Jayce, Twitch, Heimerdinger, Tristana, and Vi. Collector goes to Tristana/Twitch, Gambler's Blade to Jayce/Heimerdinger, and Mogul's Mail to Dr. Mundo/Garen. The second scenario adds Zephyr to Illaoi. The original opening hero remains on the bench. Native summons are included in actual reported combat-unit counts; nine deployed heroes need not mean nine combat entities.

Construction uses only exported production commands from `match.ts` and `seat-mechanics`: create, an explicitly receipted 1000-gold grant, `buyXp` to level 9, three receipted hero grants per champion through normal merging, deploy, item grant/equip, start/step, select offered choices, and next round. It does not edit Match/combat fields, inject a round number, adjust HP, shorten a battle, remove requested heroes, or fabricate a history. Normal supply rounds may already be settled and advance through `nextRound`. The augment choice policy uses the first offered choice other than placebo/glass-cannon when available. This follows the public-command pattern in `tests/match-helpers.ts` without importing Vitest or a test fixture into the measured bundle.

A rejected command, death before the destination, missing requested hero, or restore mismatch fails visibly with the actual reason/node. Do not replace such a failure by trimming the lineup or mutating state to reach the requested label.

## Sampling and retained inputs

Each new battle is run to its natural terminal state. Its samples are the original opening, actual midpoint (`floor(terminalTick / 2)`), and terminal snapshots. For each checkpoint:

1. Serialize the original production state. Optionally retain these exact bytes using `--fixtures-dir`; use this option for the final evidence run.
2. Perform one untimed, complete-equality-checked warmup per input form.
3. Measure seven warm JSON restores and seven warm object restores, asserting complete equality after **each** restore and verifying the source object did not change.
4. Run a separate fresh Node process for JSON and another for object input. Import/parse happen before timing; complete equality and input nonmutation checks happen after timing. These are cold rules-module caches, not claims about OS filesystem cache or browser responsiveness.
5. Record actual round, tick, terminal status, total/player/enemy combat entities, serialized byte length, item-gold receipt count, individual samples/median/max, and cold times. Record Git HEAD/dirty paths, Node/npm/esbuild, CPU/count, architecture/platform, and the actual preceding round trace.

No benchmark run should compete with tests, browser capture, builds, or another benchmark. Pin the intended production revision and preserve the script revision/diff with the report. Do not compare an unrecorded dirty tree to a previous release as if only the mechanism changed.

## Commands

Syntax check only:

```sh
node --check scripts/measure-g2-4b-restore.cjs
```

One lawful-route validation, with **no timing samples and no cold processes**:

```sh
node scripts/measure-g2-4b-restore.cjs --scenario=largeGoldMix --validate-only /tmp/g24-large-validation-new.json
```

After the release revision is fixed, run each desired new scenario serially with a fresh report name and a fresh raw-input directory:

```sh
node scripts/measure-g2-4b-restore.cjs --scenario=largeGoldMix --fixtures-dir=/tmp/g24-large-raw-new /tmp/g24-large-measured-new.json
node scripts/measure-g2-4b-restore.cjs --scenario=lateGoldMixZephyr --fixtures-dir=/tmp/g24-late-raw-new /tmp/g24-late-measured-new.json
```

`--scenario` also accepts each original name: `baseline`, `collector`, `gambler`, `mogul`, `zephyr`, `gamblerZephyr`. Omitting it runs all eight scenarios; do not do that during preliminary preparation. The first positional argument remains the report destination. Neither old report paths nor old raw-input directories should be reused.

## Preliminary validation, 2026-10-17

Only `largeGoldMix --validate-only` was completed, against production HEAD `5f61f70c2ad96de1564604a1beea6614fee467f3` with this measurement-script change still uncommitted. Node v24.19.0, npm 11.9.0, esbuild 0.28.2; AMD EPYC 9V74 80-Core Processor. This is correctness/setup evidence, **not measured restore latency**.

The public progression reached round 3-5 with HP 100, level 9, and all nine requested two-star heroes deployed. Actual combat contained 15 entities: ten friendly (including Jayce's forge) and five enemy.

| Actual tick | State | Serialized bytes | Gold receipt count |
| --- | --- | ---: | ---: |
| 0 | Opening | 159015 | 0 |
| 79 | Midcombat | 186187 | 12 |
| 159 | Terminal | 167880 | 25 |

Each checkpoint passed full JSON and object restore equality; preparation also passed a JSON restore equality check. No warm/cold timing run was performed, and the 4-1 Zephyr scenario remains unvalidated. Initial setup corrections fixed the content ID spelling `drmundo` and recognized the normal supply-round settled state; they did not change the requested army, equipment, target round, or any production state field.

### Additional preparation verification

The same direct continuation also ran `lateGoldMixZephyr --validate-only`.
It naturally reached4-1:16entities (10friendly/6enemy), checkpoints0/101/203,
serialized195935/227321/209857bytes and0/16/33item-gold receipts. All three
JSON/object restores matched completely. This supersedes the earlier statement
that the late scenario was unvalidated; it still supplies no latency samples.
The raw preparation report is `direct/late-gold-zephyr-route-validation.json`.
Its recorded HEAD is5f61f70 with the exact staged measurement-script update;
subsequent cd48003 preserved that script without production changes.
