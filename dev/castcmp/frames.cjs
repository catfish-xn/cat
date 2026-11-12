// The frames v-capture writes: <unit>-<ms>.jpg, ms zero-padded to at least 4 digits (10 s and later have 5 or more).
// Sorted by time, not by name: a name sort put 10033 before 2000.
const fs = require('fs'), path = require('path');
const FRAME = /-(\d{4,})\.jpg$/;
const frameTime = name => { const m = FRAME.exec(name); return m ? Number(m[1]) : null; };
const frames = dir => fs.readdirSync(dir).map(f => ({ t: frameTime(f), file: path.join(dir, f) })).filter(f => f.t !== null).sort((a, b) => a.t - b.t);
module.exports = { frameTime, frames };
