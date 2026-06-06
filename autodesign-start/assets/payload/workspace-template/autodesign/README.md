# Autodesign Runtime Workspace

This directory is the materialized Autodesign workspace for Stage 06 manifest, artifact graph, private subskill contract, and canonical pipeline state management.

- `.system/install-state.json` records the installed bootstrap state.
- `manifest.json` records workspace state, private subskill contracts, approval gates, generation records, and disabled behaviors.
- `artifact-graph.json` records artifact dependencies and reconcile metadata.
- `inputs/` stores user-provided source material for canonical generation.
- `outputs/canonical/` is created by `generate-canonical.mjs` for Stage 06 source-of-truth artifacts.
- `logs/decision-log.json` is created and updated by the canonical pipeline.

Stage 06 generates canonical planning artifacts only. It does not generate images, Pencil files, visual references, design-system outputs, prototypes, handoff material, reports, optimized skills, or downstream phase outputs.
