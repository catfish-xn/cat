// Shared bits of the castcmp capture scripts: browser launch per OS, 30fps timeline, timing log.
const fs = require('fs');

// Windows (desktop GPU): headless Chrome on D3D11. Linux (no GPU): SwiftShader software GL.
// --gl gpu|swift overrides; --chrome <path> or CASTCMP_CHROME overrides the browser binary.
function launchOptions(opt) {
  const win = process.platform === 'win32';
  const gl = opt('gl') ?? (win ? 'gpu' : 'swift');
  const candidates = [opt('chrome'), process.env.CASTCMP_CHROME,
    ...(win ? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
      : process.platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'] : ['/usr/bin/google-chrome'])];
  const executablePath = candidates.find(p => p && fs.existsSync(p));
  const args = gl === 'gpu'
    ? ['--ignore-gpu-blocklist', '--enable-gpu', ...(win ? ['--use-angle=d3d11'] : [])]
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  if (!win) args.unshift('--no-sandbox');
  return { gl, options: { headless: true, ...(executablePath ? { executablePath } : {}), args } };
}

// 30fps time points: round(i * 1000 / 30) for 0..ms.
function timeline(ms) {
  const out = [];
  for (let i = 0; ; i++) { const t = Math.floor(i * 1000 / 30 + 0.5); if (t > ms) break; out.push(t); }
  return out;
}

function timer() {
  const t0 = Date.now();
  return name => console.log('T', name, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}

// --form: the renderer (placeholder-renderer.ts) draws the front form for 'melee' only and the back form for anything else,
// so a value outside the rules' UnitForm ('melee' | 'ranged', seat-mechanics/types.ts) silently recorded the back form
// (11-13: --form front on Elise and Jayce played their ranged systems).
const FORMS = ['melee', 'ranged'];
/** Why a --form value cannot be used, or null (undefined: no --form given). */
function formProblem(form) {
  return form === undefined || FORMS.includes(form) ? null : `--form must be ${FORMS.join(' or ')} (the renderer draws anything but melee as the ranged form), got ${form}`;
}

module.exports = { launchOptions, timeline, timer, FORMS, formProblem };
