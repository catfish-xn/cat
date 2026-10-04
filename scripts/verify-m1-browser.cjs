/* Legacy entrypoint: M1 interaction regressions now run in the continuous M2 match suite. */
if (process.env.M1_URL && !process.env.M2_URL) process.env.M2_URL = process.env.M1_URL;
if (process.env.M1_EVIDENCE_DIR && !process.env.M2_EVIDENCE_DIR) process.env.M2_EVIDENCE_DIR = process.env.M1_EVIDENCE_DIR;
require('./verify-m2-browser.cjs');
