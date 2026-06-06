# Autodesign Workspace

This project has been materialized by the Autodesign Stage 05 bootstrap, state, and subskill contract runtime.

Allowed Stage 05 behavior:

- Inspect `autodesign/.system/install-state.json`.
- Inspect and validate `autodesign/manifest.json`.
- Inspect and validate `autodesign/artifact-graph.json`.
- Run deterministic Stage 05 state scripts from the installed payload.
- Run `can-run-subskill.mjs` to check private contract readiness.
- Inspect `.codex/config.toml` and `.codex/hooks/*.mjs`.
- Use the bootstrap script to re-plan or re-apply template files with explicit approval gates.

Not implemented in Stage 05:

- Canonical generation.
- Image generation.
- Pencil operations.
- Visual reference generation.
- Design-system behavior.
- Prototype generation.
- Handoff.
- Report generation.
- Skill optimization.
- Real subskill phase behavior.

Bootstrap approval remains separate from any later generation approval.
