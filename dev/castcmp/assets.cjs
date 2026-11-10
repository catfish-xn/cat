// node dev/castcmp/assets.cjs <port> [--root <dir>] [--upstream <url>]
// Read-through mirror of the test-server asset root, cached on disk under --root, served with CORS.
// --upstream none serves only what is already in --root.
const http = require('http'), fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
const ROOT = path.resolve(opt('root') ?? process.env.CASTCMP_ASSET_ROOT ?? path.join(__dirname, '.asset-mirror'));
const UPSTREAM = (opt('upstream') ?? 'http://119.45.45.247:5190/assets3d').replace(/\/$/, '');
const OVERLAY = process.env.OVERLAY_DIR || null; // optional dir whose files replace the mirror's (previews)
const inflight = new Map();
function fetchUp(rel, file) {
  if (!inflight.has(rel)) inflight.set(rel, (async () => {
    for (let i = 0; i < 4; i++) {
      try {
        if (UPSTREAM === 'none') return false;
        const r = await fetch(UPSTREAM + rel);
        if (r.status === 404) return false;
        if (!r.ok) throw new Error('http ' + r.status);
        const buf = Buffer.from(await r.arrayBuffer());
        fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.tmp', buf); fs.renameSync(file + '.tmp', file);
        return true;
      } catch { await new Promise(s => setTimeout(s, 1000 * (i + 1))); }
    }
    return false;
  })().finally(() => inflight.delete(rel)));
  return inflight.get(rel);
}
const TYPES = { '.json': 'application/json', '.png': 'image/png', '.ktx2': 'image/ktx2', '.wasm': 'application/wasm', '.js': 'text/javascript' };
http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const over = OVERLAY && /^\/(ui\/)?[\w.-]+\.json$/.test(rel) && fs.existsSync(OVERLAY + rel) ? OVERLAY + rel : null;
  const file = over ?? path.resolve(ROOT, '.' + rel);
  if (!over && !file.startsWith(ROOT + path.sep)) return res.writeHead(403).end();
  if (!fs.existsSync(file) && !(await fetchUp(rel, file))) return res.writeHead(404).end();
  fs.readFile(file, (e, b) => {
    if (e) return res.writeHead(404).end();
    res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream'); res.end(b);
  });
}).listen(Number(argv[0] || 5419), '127.0.0.1', () => console.log('assets', ROOT, '<-', UPSTREAM));
