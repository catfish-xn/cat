/* Frozen regression trajectory, separate from the hand-calculated rules oracle. */
const assert = require('node:assert/strict');
const { hash } = require('../../../scripts/m4-evidence.cjs');
const golden = require('./full-match-golden.json');
module.exports = function assertGolden(route) {
  assert.deepEqual(route.actions.map(action => action.command), golden.commands);
  assert.deepEqual(route.rounds.map(round => ({ round: round.round, stateHash: hash(round.settled),
    eventsHash: hash(round.events.filter(event => 'tick' in event)) })), golden.rounds);
};
