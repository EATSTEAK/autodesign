# Autodesign Runtime Workspace

This directory is the materialized Autodesign workspace for Stage 09 manifest, artifact graph, private subskill contract, canonical pipeline, visual reference, Pencil, design-system, prototype, QA, refinement, handoff, reconcile, and advisory hook state management.

- `.system/install-state.json` records the installed bootstrap state.
- `manifest.json` records workspace state, private subskill contracts, approval gates, generation records, and disabled behaviors.
- `artifact-graph.json` records artifact dependencies and reconcile metadata.
- `inputs/` stores user-provided source material for canonical generation.
- `outputs/canonical/` is created by `generate-canonical.mjs` for source-of-truth artifacts.
- `outputs/visual-references/` is created by `generate-visual-references.mjs` for prompt, candidate, and selected-reference records.
- `outputs/pencil/` stores Pencil live-check records, Autodesign-owned `.pen` files, wireframe metadata, and canvas export path records.
- `outputs/design-system/` stores primitive inventory, DS tokens, and DS contracts.
- `outputs/prototype/` stores prototype metadata, prototype canvas export path records, visual QA reports, and refinement logs.
- `outputs/handoff/` stores Stage 09 JSON and Markdown frontend handoff documentation.
- `logs/decision-log.json` is created and updated by the canonical pipeline.
- `logs/reconcile-report.json` is created by the Stage 09 reconcile report action.

Stage 09 requires approved selected visual references before Pencil, DS, prototype, QA, handoff, or reconcile records. Pencil-derived records require real Pencil `get_editor_state`, `batch_design`, and `export_nodes` evidence, an Autodesign-owned virtual `.pen` filePath under `autodesign/outputs/pencil/`, created/exported node bindings, and existing canvas export files.

The scripts persist metadata, documentation, and path records only. They do not create or fake Pencil canvas output, generate executable prototype code, or create frontend source files. Without completed Stage 08 Pencil/DS/prototype/QA prerequisites, Stage 09 handoff and reconcile actions remain blocked.
