// Compare every replay in mp-sim-perf-probe's full-match ledgers. Existing
// refusals remain explicit outcomes, never counted as successful replay bytes.
// node script.cjs <before-root> <after-root> <ledger-dir> <output-dir> [upstream-root]
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const os = require('node:os');
const { createHash } = require('node:crypto');
const [beforeRoot, afterRoot, ledgerDir, outputDir, upstreamRoot] = process.argv.slice(2).map(p => path.resolve(p));

async function main() {
  assert(beforeRoot && afterRoot && ledgerDir && outputDir, 'Four paths required');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-replay-probe-'));
  fs.mkdirSync(outputDir, { recursive: true });
  const rows = [];
  try {
    const load = async (root, name) => {
      const built = await require('esbuild').build({ stdin: { contents: "export {toCombatReplay} from './src/simulation/combat-replay-view';", resolveDir: root },
        bundle: true, platform: 'node', format: 'cjs', write: false });
      const file = path.join(temp, name + '.cjs'); fs.writeFileSync(file, built.outputFiles[0].contents);
      return require(file);
    };
    const before = await load(beforeRoot, 'before'), after = await load(afterRoot, 'after');
    const upstream = upstreamRoot && await load(upstreamRoot, 'upstream');
    const replay = (api, battle) => {
      try { return { bytes: Buffer.from(JSON.stringify(api.toCombatReplay(battle))) }; }
      catch (error) { return { error: { name: error.name, message: error.message } }; }
    };
    for (const seed of [42, 7, 11]) {
      const lines = zlib.gunzipSync(fs.readFileSync(path.join(ledgerDir, `seed-${seed}-ledger.ndjson.gz`))).toString().trim().split('\n');
      for (const line of lines) {
        const record = JSON.parse(line);
        const battles = record.kind === 'two-sided' ? [record.battle] : record.outcomes.map(o => o.combat).filter(Boolean);
        for (const battle of battles) {
          const a = replay(before, battle), b = replay(after, battle);
          const meta = { seed, kind: record.kind === 'two-sided' ? 'pvp' : 'pve', battleId: battle.battleId ?? battle.initial.combatId,
            events: battle.events.length, ticks: battle.terminal.tick };
          assert.deepEqual(a.error, b.error, JSON.stringify(meta));
          if (a.error) {
            if (upstream) assert.deepEqual(replay(upstream, battle).error, a.error, JSON.stringify(meta));
            rows.push({ ...meta, error: a.error, alsoRejectedByUpstream: !!upstream });
            console.log(JSON.stringify(rows.at(-1)));
          } else {
            assert(a.bytes.equals(b.bytes), JSON.stringify(meta));
            rows.push({ ...meta, bytes: a.bytes.length, sha256: createHash('sha256').update(a.bytes).digest('hex') });
          }
        }
      }
      console.log(JSON.stringify({ seed, checked: rows.filter(row => row.seed === seed).length }));
    }
    fs.writeFileSync(path.join(outputDir, 'replay-comparison.json'), JSON.stringify(rows, null, 2) + '\n');
    console.log(JSON.stringify({ checked: rows.length, identicalBytes: rows.filter(row => !row.error).length,
      identicalRejections: rows.filter(row => row.error).length }));
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
