---
name: autodesign-qa
description: Private Stage 08 semantic visual QA subskill. Persists QA and max-two-refinement gate records.
---

# Autodesign QA

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running deterministic readiness checks.

## Required Upstream Artifacts

- `visual.reference-set` after approved selected visual references
- `pencil.wireframe-set` at `autodesign/outputs/pencil/wireframes/wireframe-metadata.json`
- `pencil.canvas-exports` at `autodesign/outputs/pencil/canvas-exports.json`
- `design-system.tokens` at `autodesign/outputs/design-system/tokens.json`
- `design-system.contracts` at `autodesign/outputs/design-system/contracts.json`
- `prototype.package` at `autodesign/outputs/prototype/prototype-metadata.json`
- `prototype.canvas-exports` at `autodesign/outputs/prototype/canvas-exports.json`

## Output Artifacts

- `prototype.visual-qa-report` at `autodesign/outputs/prototype/visual-qa-report.json`
- `prototype.refinement-log` at `autodesign/outputs/prototype/refinement-log.json`

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill qa` must pass.
- `visual.reference-selection` must be approved and contain selected records.
- `prototype.package` must already be generated.
- Wireframe and prototype metadata must include Pencil MCP evidence summaries from `batch_design` and `export_nodes`.
- Prototype canvas export records must include Pencil node and screen bindings.
- `--refinement-attempt` must be an integer from `0` to `2`.
- Further refinement is blocked after two unsuccessful attempts unless a separate user gate is recorded.

## Run

Plan first:

```bash
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace <workspace> --action qa --refinement-attempt 0 --qa-status pass --plan
```

Apply only with explicit approval:

```bash
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace <workspace> --action qa --refinement-attempt 0 --qa-status pass --apply --approve-prototype-qa --actor <actor> --at <timestamp>
```

QA is semantic metadata QA over selected references, Pencil records, DS tokens/contracts, and prototype records. It does not inspect or invent Pencil canvas content and does not generate frontend handoff files. If the live Pencil MCP handoff evidence is missing, QA blocks instead of approving Stage 08.
