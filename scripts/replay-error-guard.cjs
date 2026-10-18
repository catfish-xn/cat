'use strict';

/** Observe across pipe chunks, including a final line without a newline. */
function replayErrorGuard(onFailure) {
  let tail = '', failed = false;
  return chunk => {
    const text = tail + String(chunk);
    if (!failed && /\breplay\.failed\b|\breplay-divergence\b/.test(text)) {
      failed = true;
      onFailure(new Error(`Server replay error: ${text.trim()}`));
    }
    tail = text.slice(-256);
  };
}

/** Remains active after readiness; an explicit success exit cannot mask a replay failure. */
function watchServerReplayErrors(child, cleanup) {
  const fail = error => {
    process.stderr.write(`${error.message}\n`);
    cleanup();
    process.exit(1);
  };
  child.stdout.on('data', replayErrorGuard(fail));
  child.stderr.on('data', replayErrorGuard(fail));
}

function assertNoReplayErrors(failures) {
  if (failures.length) throw new Error(`Server replay errors: ${failures.length}\n${failures.join('\n')}`);
}

module.exports = { replayErrorGuard, watchServerReplayErrors, assertNoReplayErrors };
