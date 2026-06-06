# Autodesign Workspace

This project has been materialized by the Autodesign Stage 06 bootstrap, state, subskill contract, and canonical pipeline runtime.

Allowed Stage 06 behavior:

- Inspect `autodesign/.system/install-state.json`.
- Inspect and validate `autodesign/manifest.json`.
- Inspect and validate `autodesign/artifact-graph.json`.
- Run deterministic Stage 06 state scripts from the installed payload.
- Run `can-run-subskill.mjs` to check private contract readiness.
- Run `generate-canonical.mjs --plan` to plan canonical artifact generation.
- Run `generate-canonical.mjs --apply --approve-canonical-generation --actor <actor> --at <timestamp>` only after explicit canonical generation approval.
- Inspect `.codex/config.toml` and `.codex/hooks/*.mjs`.
- Use the bootstrap script to re-plan or re-apply template files with explicit approval gates.

Not implemented in Stage 06:

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

Canonical generation is limited to source-of-truth planning artifacts. UX rules, interaction model, screen-state matrix, and visual anchor proposals must stop if platform selection is missing from `autodesign/inputs`. Primary visual anchor proposals are not approved by generation.
