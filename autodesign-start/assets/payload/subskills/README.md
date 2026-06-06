# Payload Subskills

Stage 07 includes concrete private subskill contracts.

These subskills are not public install-time skills. `autodesign-start` remains the only public router.

Each direct contract documents:

- required upstream artifacts
- declared output artifacts
- hard gates
- fail-fast behavior

Before entering any private contract, run:

```bash
node autodesign-start/assets/payload/scripts/can-run-subskill.mjs --workspace /absolute/path/to/project --subskill <name>
```

The readiness check validates manifest state, graph dependencies, required upstream artifact paths, declared output artifact ids, disabled behavior guards, and canonical hard gates such as platform selection.

The canonical subskills `interview`, `stories`, `brand`, `views`, `ux`, and `visual-anchors` are implemented through `scripts/generate-canonical.mjs`. The `visuals` subskill is implemented through `scripts/generate-visual-references.mjs` for prompt, candidate, and selected-reference records.

Pencil, design-system, prototype, handoff, reconcile, eval, and skill optimization subskills remain contract-only in Stage 07.
