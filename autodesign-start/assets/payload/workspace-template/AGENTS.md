# Autodesign Workspace

This project has been materialized by the Autodesign Stage 07 bootstrap, state, subskill contract, canonical pipeline, and visual reference gate runtime.

Allowed Stage 07 behavior:

- Inspect `autodesign/.system/install-state.json`.
- Inspect and validate `autodesign/manifest.json`.
- Inspect and validate `autodesign/artifact-graph.json`.
- Run deterministic Stage 07 state scripts from the installed payload.
- Run `can-run-subskill.mjs` to check private contract readiness.
- Run `generate-canonical.mjs --plan` to plan canonical artifact generation.
- Run `generate-canonical.mjs --apply --approve-canonical-generation --actor <actor> --at <timestamp>` only after explicit canonical generation approval.
- Run `generate-visual-references.mjs --action prompts --plan` to plan visual prompt records after generated canonical visual anchor proposals.
- Run `generate-visual-references.mjs --action prompts --apply --approve-visual-prompts --actor <actor> --at <timestamp>` only after explicit prompt approval.
- Run `generate-visual-references.mjs --action candidates --prompt-id <prompt-id> --generated-output-path <path> --apply --approve-visual-candidates --actor <actor> --at <timestamp>` only after manual `canonical.visual-anchor-selection` approval and real image generation by the active agent.
- Run `generate-visual-references.mjs --action selection --reference-id <candidate-id> --apply --approve-visual-reference-selection --actor <actor> --at <timestamp>` only after explicit user approval of selected references.
- Inspect `.codex/config.toml` and `.codex/hooks/*.mjs`.
- Use the bootstrap script to re-plan or re-apply template files with explicit approval gates.

Not implemented in Stage 07:

- Pencil operations.
- Design-system behavior.
- Prototype generation.
- Handoff.
- Report generation.
- Skill optimization.
- Real subskill phase behavior.

Bootstrap approval remains separate from any later generation approval.

Canonical generation is limited to source-of-truth planning artifacts. UX rules, interaction model, screen-state matrix, and visual anchor proposals must stop if platform selection is missing from `autodesign/inputs`. Primary visual anchor proposals are not approved by generation.

Visual reference scripts persist prompt text, active-agent image-generation instructions, generated output path fields, and review metadata. They must not hardcode an image model, create image files, fake image generation, or auto-select references.
