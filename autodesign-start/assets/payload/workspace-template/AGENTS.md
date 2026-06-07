# Autodesign Workspace

This project has been materialized by the Autodesign Stage 11 bootstrap, state, subskill contract, canonical pipeline, visual reference gate, Pencil, design-system, prototype, QA, refinement, handoff, reconcile, SkillOpt, and advisory hook runtime.

Allowed Stage 09 behavior:

- Inspect `autodesign/.system/install-state.json`.
- Inspect and validate `autodesign/manifest.json`.
- Inspect and validate `autodesign/artifact-graph.json`.
- Run deterministic Stage 09 state scripts from the installed payload.
- Run `can-run-subskill.mjs` to check private contract readiness.
- Run `generate-canonical.mjs` only with its plan/apply approval gates.
- Run `generate-visual-references.mjs` only with its prompt, candidate, and selection approval gates.
- Run `generate-pencil-prototype.mjs --action live-check` only after the active Pencil MCP agent has produced `get_editor_state` evidence for an Autodesign-owned virtual `.pen` filePath under `autodesign/outputs/pencil/`.
- Run `generate-pencil-prototype.mjs --action wireframes` only after selected references, Pencil live-check approval, an Autodesign-owned `.pen` file under `autodesign/outputs/pencil/`, active `batch_design`/`export_nodes` evidence, and real canvas exports exist.
- Run `generate-pencil-prototype.mjs --action primitives`, `ds`, `prototype`, or `qa` only with the action-specific approval flag, `--actor`, and `--at`.
- Run `generate-handoff.mjs --action handoff` only after Stage 08 artifacts and prototype QA/refinement gates exist; apply requires `--approve-handoff-generation`, `--actor`, and `--at`.
- Run `generate-handoff.mjs --action reconcile` only after handoff docs exist; apply requires `--changed`, `--approve-reconcile-report`, `--actor`, and `--at`.
- Run `generate-skillopt.mjs` only after `autodesign/logs/eval-report.json` exists with E2E `PASS`; apply requires `--approve-skillopt-hardening`, `--actor`, and `--at`.
- Inspect `.codex/config.toml` and `.codex/hooks/*.mjs`.
- Use the bootstrap script to re-plan or re-apply template files with explicit approval gates.

Still not implemented:

- Executable prototype implementation files.
- Fake Pencil canvas output.
- Evaluation report generation.
- Automatic upstream SkillOpt patch application.

Bootstrap approval remains separate from any later generation approval.

Canonical generation is limited to source-of-truth planning artifacts. UX rules, interaction model, screen-state matrix, and visual anchor proposals must stop if platform selection is missing from `autodesign/inputs`. Primary visual anchor proposals are not approved by generation.

Visual reference scripts persist prompt text, active-agent image-generation instructions, generated output path fields, and review metadata. They must not hardcode an image model, create image files, fake image generation, or auto-select references.

Stage 09 scripts require approved selected visual references before Pencil, DS, prototype, QA, handoff, or reconcile records. Pencil-derived records require live Pencil MCP tool evidence and real files; if Pencil is unavailable, Stage 08-derived prerequisites remain NOT READY and scripts fail fast instead of fabricating output.

Handoff generation writes JSON and Markdown documentation only under `autodesign/outputs/handoff`. Reconcile generation writes an advisory JSON report only under `autodesign/logs/reconcile-report.json`. Hooks are observational/advisory only and must not generate artifacts, call image generation, call Pencil MCP, mutate design files, or create frontend code.

SkillOpt generation writes only `autodesign/logs/skillopt-report.json`, `autodesign/logs/skillopt-patch-proposals.json`, and state metadata. Patch proposals are review-only artifacts and must not be applied automatically.
