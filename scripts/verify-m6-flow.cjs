/* Public-input F2 scenario shares the unchanged normal-route/golden driver. */
process.argv.push('--m6-f2');
require('./verify-m5-browser.cjs');
