# Autodesign Workspace

This project has been materialized by the Autodesign Stage 08 bootstrap, state, subskill contract, canonical pipeline, visual reference gate, Pencil, design-system, prototype, QA, and refinement runtime.

Allowed Stage 08 behavior:

- Inspect `autodesign/.system/install-state.json`.
- Inspect and validate `autodesign/manifest.json`.
- Inspect and validate `autodesign/artifact-graph.json`.
- Run deterministic Stage 08 state scripts from the installed payload.
- Run `can-run-subskill.mjs` to check private contract readiness.
- Run `generate-canonical.mjs` only with its plan/apply approval gates.
- Run `generate-visual-references.mjs` only with its prompt, candidate, and selection approval gates.
- Run `generate-pencil-prototype.mjs --action live-check` only after the active Pencil MCP agent has produced `get_editor_state` evidence for an Autodesign-owned virtual `.pen` filePath under `autodesign/outputs/pencil/`.
- Run `generate-pencil-prototype.mjs --action wireframes` only after selected references, Pencil live-check approval, an Autodesign-owned `.pen` file under `autodesign/outputs/pencil/`, active `batch_design`/`export_nodes` evidence, and real canvas exports exist.
- Run `generate-pencil-prototype.mjs --action primitives`, `ds`, `prototype`, or `qa` only with the action-specific approval flag, `--actor`, and `--at`.
- Inspect `.codex/config.toml` and `.codex/hooks/*.mjs`.
- Use the bootstrap script to re-plan or re-apply template files with explicit approval gates.

Not implemented in Stage 08:

- Frontend handoff.
- Executable prototype implementation files.
- Fake Pencil canvas output.
- Reconcile report generation.
- Evaluation report generation.
- Skill optimization.

Bootstrap approval remains separate from any later generation approval.

Canonical generation is limited to source-of-truth planning artifacts. UX rules, interaction model, screen-state matrix, and visual anchor proposals must stop if platform selection is missing from `autodesign/inputs`. Primary visual anchor proposals are not approved by generation.

Visual reference scripts persist prompt text, active-agent image-generation instructions, generated output path fields, and review metadata. They must not hardcode an image model, create image files, fake image generation, or auto-select references.

Stage 08 scripts require approved selected visual references before Pencil, DS, prototype, or QA records. Pencil-derived records require live Pencil MCP tool evidence and real files; if Pencil is unavailable, Stage 08 is NOT READY and scripts fail fast instead of fabricating output.
