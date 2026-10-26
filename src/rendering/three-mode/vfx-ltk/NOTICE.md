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
Desktop editor UI, shader translation services and unsupported screen passes are
not bundled. See `docs/VFX_PORT_PLAN.md` for the supported boundary.

No League game assets or converted game data are included. The software license
notice does not grant rights in separately supplied game assets.
