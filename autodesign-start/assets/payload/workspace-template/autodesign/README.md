# Autodesign Runtime Workspace

This directory is the materialized Autodesign workspace for Stage 08 manifest, artifact graph, private subskill contract, canonical pipeline, visual reference, Pencil, design-system, prototype, QA, and refinement state management.

- `.system/install-state.json` records the installed bootstrap state.
- `manifest.json` records workspace state, private subskill contracts, approval gates, generation records, and disabled behaviors.
- `artifact-graph.json` records artifact dependencies and reconcile metadata.
- `inputs/` stores user-provided source material for canonical generation.
- `outputs/canonical/` is created by `generate-canonical.mjs` for source-of-truth artifacts.
- `outputs/visual-references/` is created by `generate-visual-references.mjs` for prompt, candidate, and selected-reference records.
- `outputs/pencil/` stores Pencil live-check records, Autodesign-owned `.pen` files, wireframe metadata, and canvas export path records.
- `outputs/design-system/` stores primitive inventory, DS tokens, and DS contracts.
- `outputs/prototype/` stores prototype metadata, prototype canvas export path records, visual QA reports, and refinement logs.
- `logs/decision-log.json` is created and updated by the canonical pipeline.

Stage 08 requires approved selected visual references before Pencil, DS, prototype, or QA records. Pencil-derived records require real Pencil `get_editor_state`, `batch_design`, and `export_nodes` evidence, an Autodesign-owned virtual `.pen` filePath under `autodesign/outputs/pencil/`, created/exported node bindings, and existing canvas export files.

The scripts persist metadata and path records only. They do not create or fake Pencil canvas output, generate executable prototype code, or create frontend handoff material. Without a completed live Pencil MCP handoff, Stage 08 remains NOT READY.
