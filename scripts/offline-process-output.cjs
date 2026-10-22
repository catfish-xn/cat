/* File-backed capture also works where sandboxed child pipes cannot be polled.
 * Preserve exit failures; never accept partial output after a spawn error. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

exports.readProcessOutput = (file, args, options = {}) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chem-process-'));
  const output = path.join(directory, 'stdout');
  const fd = fs.openSync(output, 'w');
  try {
    execFileSync(file, args, { ...options, stdio: ['ignore', fd, 'inherit'] });
    return fs.readFileSync(output);
  } finally {
    fs.closeSync(fd);
    fs.rmSync(directory, { recursive: true, force: true });
  }
};
