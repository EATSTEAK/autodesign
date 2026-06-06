---
name: autodesign-bootstrap-runtime
description: Private Stage 03 placeholder for the Autodesign bootstrap runtime boundary. Do not expose as a public skill and do not run generation behavior.
---

# Autodesign Bootstrap Runtime Placeholder

This private placeholder documents the Stage 03 bootstrap boundary.

Allowed in Stage 03:

- Explain that `scripts/bootstrap.mjs` plans and materializes `workspace-template/`.
- Explain the approval gates: `--approve-bootstrap` for writes and `--approve-overwrite` for overwrites.
- Point to `autodesign/.system/install-state.json` after bootstrap.

Not implemented in Stage 03:

- Canonical generation.
- Image generation.
- Pencil operations.
- Visual reference generation.
- Design-system behavior.
- Handoff.
- Real subskill phase behavior.
