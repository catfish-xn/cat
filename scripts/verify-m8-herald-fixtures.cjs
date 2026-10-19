/* Stable entry point for the Herald restore-input check. Each rules epoch records
 * its own Herald raw directory with a per-epoch copy of the generator (the copy's
 * own path is part of that directory's recorded sources), so this entry delegates
 * to the current epoch instead of regenerating a frozen historical directory.
 * Default: regenerate and verify checked-in bytes/metadata; --write: replace the
 * generated files explicitly. Arguments pass through unchanged.
 * When a new epoch records a new Herald directory, point CURRENT at its generator. */
const CURRENT = '../tests/fixtures/record-g2-4b-herald.cjs'; // s13-g2-3-v13 -> tests/fixtures/g2-4b-herald-raw
require(CURRENT);
