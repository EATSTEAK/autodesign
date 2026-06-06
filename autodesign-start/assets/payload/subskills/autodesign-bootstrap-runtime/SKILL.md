---
name: autodesign-bootstrap-runtime
description: Private Stage 04 placeholder for the Autodesign bootstrap and state runtime boundary. Do not expose as a public skill and do not run generation behavior.
---

# Autodesign Bootstrap Runtime Placeholder

This private placeholder documents the Stage 04 bootstrap and state boundary.

Allowed in Stage 04:

- Explain that `scripts/bootstrap.mjs` plans and materializes `workspace-template/`.
- Explain the approval gates: `--approve-bootstrap` for writes and `--approve-overwrite` for overwrites.
- Point to `autodesign/.system/install-state.json` after bootstrap.
- Point to `autodesign/manifest.json` and `autodesign/artifact-graph.json` for state and dependency semantics.
- Point to the Stage 04 validation, dependency, gate-record, and dirty-artifact scripts.

Not implemented in Stage 04:

- Canonical generation.
- Image generation.
- Pencil operations.
- Visual reference generation.
- Design-system behavior.
- Handoff.
- Real subskill phase behavior.
