# Autodesign Runtime Workspace

This directory is the materialized Autodesign workspace for Stage 04 manifest and artifact graph state management.

- `.system/install-state.json` records the installed bootstrap state.
- `manifest.json` records workspace state, approval gates, and disabled behaviors.
- `artifact-graph.json` records artifact dependencies and reconcile metadata.
- `inputs/` is reserved for later user-provided source material.
- `outputs/` is reserved for later generated artifacts.
- `logs/` is reserved for later runtime records.

Stage 04 does not generate canonical artifacts, images, Pencil files, visual references, design-system outputs, handoff material, or phase outputs.
