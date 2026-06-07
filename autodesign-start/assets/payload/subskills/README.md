# Payload Subskills

Stage 11 includes concrete private subskill contracts.

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

The readiness check validates manifest state, graph dependencies, required upstream artifact paths, declared output artifact ids, disabled behavior guards, selected-reference gates, Pencil gates, DS gates, prototype gates, refinement gates, handoff gates, and reconcile gates.

The canonical subskills `interview`, `stories`, `brand`, `views`, `ux`, and `visual-anchors` are implemented through `scripts/generate-canonical.mjs`. The `visuals` subskill is implemented through `scripts/generate-visual-references.mjs` for prompt, candidate, and selected-reference records.

The `wireframe`, `primitives`, `ds`, `prototype`, and `qa` subskills are implemented through `scripts/generate-pencil-prototype.mjs`. These Stage 08 actions require approved selected visual references; Pencil-derived actions also require a live Pencil MCP handoff with `get_editor_state`, `batch_design`, and `export_nodes`, an Autodesign-owned virtual `.pen` filePath, created/exported node bindings, and real canvas export paths.

The `handoff` and `reconcile` subskills are implemented through `scripts/generate-handoff.mjs`. Handoff writes JSON and Markdown documentation only. Reconcile writes an advisory JSON report only.

The `skillopt` subskill is implemented through `scripts/generate-skillopt.mjs`. It requires an E2E PASS eval report, records accepted/rejected prompt-version edits, and writes review-only patch proposal JSON. Eval remains a later-stage upstream contract.
