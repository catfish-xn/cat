/** Independent frozen source records for every admitted G2 hero. */
exports.champions = () => Object.fromEntries(require('../../src/simulation/content/source/s13-14.24b/normalized/g2-1-champions.json').champions.filter(c => c.status !== 'blocked-on-form-stats').map(c => [c.id, c.record]));
