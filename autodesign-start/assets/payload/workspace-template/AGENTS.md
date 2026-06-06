# Autodesign Workspace

This project has been materialized by the Autodesign Stage 04 bootstrap and state runtime.

Allowed Stage 04 behavior:

- Inspect `autodesign/.system/install-state.json`.
- Inspect and validate `autodesign/manifest.json`.
- Inspect and validate `autodesign/artifact-graph.json`.
- Run deterministic Stage 04 state scripts from the installed payload.
- Inspect `.codex/config.toml` and `.codex/hooks/*.mjs`.
- Use the bootstrap script to re-plan or re-apply template files with explicit approval gates.

Not implemented in Stage 04:

- Canonical generation.
- Image generation.
- Pencil operations.
- Visual reference generation.
- Design-system behavior.
- Handoff.
- Real subskill phase behavior.

Bootstrap approval remains separate from any later generation approval.
