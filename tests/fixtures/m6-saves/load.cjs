const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
/** Reads the frozen M6-exported save fixtures (gzip JSON) next to this file. */
exports.manifest = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
exports.load = file => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, file))).toString('utf8'));
