# ltk-manager VFX port

Derived from LeagueToolkit/ltk-manager, local source commit
`a3e5ef85ca4cf50486f2dcd9024831432ec9921b` (package 1.30.5).
Upstream package license: **GPL-3.0-or-later**. The unmodified upstream GPL v3 text
is included in `LICENSE`. Original comments and any copyright/license notices in
copied files are retained after the added source-path headers. Copyright in the
upstream work remains with its respective authors.

Source paths are recorded on every copied/adapted file. In addition to the
`src/modules/workshop/bin/vfx/engine/` implementation, this port includes selected
rendering utilities, shaders and particle writers from that module, generated
VFX-related declarations from `src/lib/bindings.ts`, the bin hash helper, and the
viewport's independent numeric space definitions.

Changes (2026-10-26, catfish-xn/cat): browser asset adapter instead of Tauri;
explicit Three.js draw lifetimes instead of React/R3F; optional child pool limits;
uniform board-scale corrections for billboards/rays/projections. The runtime,
validation and timeline adapters are supplied alongside the derived engine.
Desktop editor UI and shader translation services are not bundled.
The follow-up port (2026-10-26) includes viewport LTKG/LTKS/LTKA buffer readers,
pose evaluation, submesh filtering and particle bone palettes, the bare avatar
overlay draw, and upstream frame/depth capture and phase ordering. Converted
`.sco` meshes are accepted alongside `.scb`; cube PNG strips become CubeTextures.
See `docs/VFX_PORT_REPORT.md` for current validation and remaining visual limits;
`docs/VFX_PORT_PLAN.md` records the initial port's historical boundary.

No League game assets or converted game data are included. The software license
notice does not grant rights in separately supplied game assets.
