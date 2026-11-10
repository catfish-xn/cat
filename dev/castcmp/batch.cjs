// node dev/castcmp/batch.cjs <jobs.txt> <outRoot> [--parallel 1] [--port 5311] [--assetPort 5419] [--serve] [--root <assetDir>] [--upstream <assets3d url>]
// Cross-platform batch runner (replaces run.sh / lane.sh). Each non-empty, non-# line of jobs.txt is
//   <v-capture.cjs|v-capture-attack.cjs> <unit> <name> [capture args...]
// and records into <outRoot>/<name>; <outRoot>/<name>.ok marks a finished job, so a rerun only does what is left.
// --serve starts vite (repo root) and assets.cjs for the run and stops them afterwards.
const { spawn, spawnSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
const [jobsFile, outArg] = argv;
if (!jobsFile || !outArg) { console.error('usage: batch.cjs <jobs.txt> <outRoot> [--parallel N] [--serve]'); process.exit(2); }
const outRoot = path.resolve(outArg), repo = path.resolve(__dirname, '../..');
const port = opt('port') ?? '5311', assetPort = opt('assetPort') ?? '5419', parallel = Number(opt('parallel') ?? 1);
const jobs = fs.readFileSync(jobsFile, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => l.split(/\s+/));
const up = url => new Promise(r => http.get(url, res => { res.resume(); r(res.statusCode < 500); }).on('error', () => r(false)));
const children = [];
const stop = () => { for (const c of children) { try { process.platform === 'win32' ? spawnSync('taskkill', ['/pid', String(c.pid), '/t', '/f']) : c.kill(); } catch {} } };

async function serve() {
  const node = process.execPath;
  children.push(spawn(node, [path.join(__dirname, 'assets.cjs'), assetPort, ...(opt('root') ? ['--root', opt('root')] : []), ...(opt('upstream') ? ['--upstream', opt('upstream')] : [])], { stdio: 'ignore' }));
  children.push(spawn(node, [path.join(repo, 'node_modules/vite/bin/vite.js'), '--port', port, '--strictPort', '--host', '127.0.0.1'], { cwd: repo, stdio: 'ignore' }));
  for (let i = 0; i < 120 && !(await up(`http://127.0.0.1:${port}/dev/castcmp/index.html`) && await up(`http://127.0.0.1:${assetPort}/`)); i++) await new Promise(r => setTimeout(r, 500));
}

function run([script, unit, name, ...rest]) {
  const dir = path.join(outRoot, name), ok = dir + '.ok';
  if (fs.existsSync(ok)) return Promise.resolve();
  const t0 = Date.now(), log = fs.createWriteStream(dir + '.log');
  return new Promise(resolve => {
    const c = spawn(process.execPath, [path.join(__dirname, script), unit, dir, ...rest, '--port', port, '--assetPort', assetPort], { cwd: repo });
    c.stdout.pipe(log); c.stderr.pipe(log);
    const kill = setTimeout(() => c.kill(), 15 * 60 * 1000);
    c.on('exit', code => {
      clearTimeout(kill);
      if (code === 0) fs.writeFileSync(ok, '');
      console.log(`${name} exit=${code} ${((Date.now() - t0) / 1000).toFixed(0)}s ${new Date().toTimeString().slice(0, 8)}`);
      resolve();
    });
  });
}

(async () => {
  fs.mkdirSync(outRoot, { recursive: true });
  if (argv.includes('--serve')) await serve();
  const queue = [...jobs], t0 = Date.now();
  await Promise.all(Array.from({ length: parallel }, async () => { while (queue.length) await run(queue.shift()); }));
  const left = jobs.filter(j => !fs.existsSync(path.join(outRoot, j[2] + '.ok'))).map(j => j[2]);
  console.log(`ALL-DONE ${jobs.length - left.length}/${jobs.length} in ${((Date.now() - t0) / 1000).toFixed(0)}s${left.length ? ' missing: ' + left.join(' ') : ''}`);
  stop();
  process.exit(left.length ? 1 : 0);
})().catch(e => { console.error(e); stop(); process.exit(1); });
