# Evidence classification

All `*-build.log` files are original successful `npm run build` output from independent fixed-SHA archives or explicitly labelled isolated probes. JSON files produced by `measure.cjs` contain actual file raw bytes, gzip9 bytes and SHA-256, not Vite's displayed gzip figure. Their fixed source SHA appears in label; baseline877 is 87782695f864ba5d493d7a40c9c3652b48aacc86. Probe inputs are stored as `.ts.txt` so they are evidence, not runnable product sources.

- `baseline.json`: untouched 877 source.
- `encounter-import.json`: 877 plus a separate HTML module entry exposing two existing public queries.
- `names44-additive.json`, `names89-additive.json`: independent changes to 877, not accumulated on top of the encounter probe. Their values are current provisional/existing labels. They do not prove any new official translation.
- `before-u3-static.json`, `after-u3-static.json`, `before-u3-dynamic.json`, `after-u3-dynamic.json`: historical fixed SHA rebuilds.
- `before-b7.json`, `signed-m7.json`: fixed 947 and M7 rebuilds.
- `name-inventory.json`: existing runtime names extracted through the bundled standalone inventory tool. It contains the 5 active traits; the broader89 dictionary instead uses all 17 existing presentation trait labels (includes those 5), avoiding double counting.
- `planning-summary.json`: forecast assumptions, expressly NOT measurements.

`reproduce-probes.sh` takes REPO and NODE_BIN environment variables, makes fresh temporary archives, symlinks existing dependencies and reproduces four baseline/probe builds. It does not modify the provided repository. `build-history.sh` is the literal historical rebuild command saved during this run and contains this workspace's original paths; adjust paths when reproducing elsewhere. No build artifacts, downloaded full-language source archives or node_modules are included.
