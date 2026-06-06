# Autodesign Runtime Workspace

This directory is the materialized Autodesign workspace for Stage 07 manifest, artifact graph, private subskill contract, canonical pipeline, and visual reference gate state management.

- `.system/install-state.json` records the installed bootstrap state.
- `manifest.json` records workspace state, private subskill contracts, approval gates, generation records, and disabled behaviors.
- `artifact-graph.json` records artifact dependencies and reconcile metadata.
- `inputs/` stores user-provided source material for canonical generation.
- `outputs/canonical/` is created by `generate-canonical.mjs` for source-of-truth artifacts.
- `outputs/visual-references/` is created by `generate-visual-references.mjs` for prompt, candidate, and selected-reference records.
- `logs/decision-log.json` is created and updated by the canonical pipeline.

Stage 07 generates canonical planning artifacts and visual reference records only. Visual prompt records may instruct the active agent to generate images, but scripts do not create or fake image files. Candidate records require real generated output paths, and selected references require explicit user approval.

Stage 07 does not generate Pencil files, design-system outputs, prototypes, handoff material, reports, optimized skills, or later downstream phase outputs.
