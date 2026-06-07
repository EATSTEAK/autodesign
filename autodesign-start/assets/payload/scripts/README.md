# Payload Scripts

Stage 08 includes deterministic bootstrap, state-management, subskill readiness, canonical generation, visual reference gate, Pencil, design-system, prototype, QA, and refinement gate scripts.

## Bootstrap

Plan without writing:

```bash
node autodesign-start/assets/payload/scripts/bootstrap.mjs --target /absolute/path/to/project --plan
```

Apply after explicit bootstrap approval:

```bash
node autodesign-start/assets/payload/scripts/bootstrap.mjs --target /absolute/path/to/project --apply --approve-bootstrap
```

If the plan reports `overwrite`, apply only after separate overwrite approval:

```bash
node autodesign-start/assets/payload/scripts/bootstrap.mjs --target /absolute/path/to/project --apply --approve-bootstrap --approve-overwrite
```

The script only copies files from `workspace-template/`. It does not generate canonical artifacts, images, Pencil files, visual references, design-system outputs, prototypes, handoffs, reports, or downstream phase behavior.

## Manifest And Graph State

Validate `autodesign/manifest.json` and `autodesign/artifact-graph.json`:

```bash
node autodesign-start/assets/payload/scripts/validate-state.mjs --workspace /absolute/path/to/project
```

Check upstream dependency references and cycles:

```bash
node autodesign-start/assets/payload/scripts/check-dependencies.mjs --workspace /absolute/path/to/project
```

Check whether a named private subskill contract can be entered:

```bash
node autodesign-start/assets/payload/scripts/can-run-subskill.mjs --workspace /absolute/path/to/project --subskill interview
```

Compute dirty downstream artifacts from changed upstream artifact ids:

```bash
node autodesign-start/assets/payload/scripts/dirty-artifacts.mjs --workspace /absolute/path/to/project --changed canonical.requirements
```

Record approval gates with explicit data and write approval:

```bash
node autodesign-start/assets/payload/scripts/record-gate.mjs --workspace /absolute/path/to/project --gate state.record-gate --status approved --actor <actor> --at <timestamp> --approve-record
```

## Canonical Generation

Plan canonical generation without writing:

```bash
node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace /absolute/path/to/project --plan
```

Apply canonical generation only with explicit approval and deterministic record metadata:

```bash
node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace /absolute/path/to/project --apply --approve-canonical-generation --actor <actor> --at <timestamp>
```

Use `--subskill interview`, `stories`, `brand`, `views`, `ux`, or `visual-anchors` to generate a bounded canonical subset. UX and visual-anchor generation require explicit platform selection in project inputs.

Canonical generation creates canonical artifacts and updates manifest/graph state only. It does not create images, Pencil files, design-system outputs, prototypes, handoffs, reports, optimization artifacts, or downstream phase artifacts.

## Visual Reference Gates

Plan visual prompt records from generated canonical visual anchor proposals:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace /absolute/path/to/project --action prompts --plan
```

Apply visual prompt records only with explicit approval:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace /absolute/path/to/project --action prompts --apply --approve-visual-prompts --actor <actor> --at <timestamp>
```

Prompt records include prompt text, an active-agent image-generation instruction, generated output path fields initialized as empty, and review metadata. The script does not create images or name an image model.

After the active agent generates a real image file, record candidates by referencing the applied prompt and the existing generated output path:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace /absolute/path/to/project --action candidates --prompt-id <prompt-id> --generated-output-path autodesign/outputs/visual-references/generated/<file>.png --apply --approve-visual-candidates --actor <actor> --at <timestamp>
```

Candidate recording requires `canonical.visual-anchor-selection` to be manually approved and validates that every generated output path exists as an image file inside the workspace. It records paths and metadata only; it does not fake image generation.

Select references only by explicit candidate id and explicit approval:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace /absolute/path/to/project --action selection --reference-id <candidate-id> --apply --approve-visual-reference-selection --actor <actor> --at <timestamp>
```

The selection action never auto-selects references.

## Stage 08 Pencil, Design System, Prototype, And QA

Every Stage 08 action requires approved selected visual references. Pencil-derived actions require a live Pencil MCP handoff, not metadata alone: the active Pencil agent must target `autodesign/outputs/pencil/*.pen`, run `get_editor_state`, run `batch_design` to create frames, run `export_nodes`, and write evidence JSON that matches the virtual Pencil filePath and actual export file bytes.

Record a Pencil live-check from real active-agent evidence. The evidence must include `evidenceType: "pencil-mcp-live-check"`, `mcpToolCalls` containing `get_editor_state`, `targetPenPath`, optional matching `penFile.path`, and `agentAttestation.usedActivePencilMcp` set to `true`:

```bash
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace /absolute/path/to/project --action live-check --pencil-live-check-source-path autodesign/outputs/pencil/live-check-source.json --apply --approve-pencil-live-check --actor <actor> --at <timestamp>
```

Record wireframe metadata and validated canvas exports. The evidence must include `evidenceType: "pencil-mcp-wireframe-generation"`, `mcpToolCalls` containing `batch_design` and `export_nodes`, `targetPenPath`, `liveCheckEvidenceHash`, `batchDesign.createdNodeIds`, `exportNodes.nodeIds`, one `frames[]` entry for every canonical screen, and `exports[]` entries whose paths, bytes, and hashes match the supplied screenshots:

```bash
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace /absolute/path/to/project --action wireframes --pencil-evidence-path autodesign/outputs/pencil/wireframe-evidence.json --canvas-export-path autodesign/outputs/pencil/exports/<file>.png --apply --approve-pencil-wireframes --actor <actor> --at <timestamp>
```

Generate deterministic primitive inventory, DS tokens/contracts, and prototype metadata:

```bash
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace /absolute/path/to/project --action primitives --apply --approve-design-system-primitives --actor <actor> --at <timestamp>
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace /absolute/path/to/project --action ds --apply --approve-design-system-generation --actor <actor> --at <timestamp>
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace /absolute/path/to/project --action prototype --pencil-evidence-path autodesign/outputs/prototype/prototype-evidence.json --canvas-export-path autodesign/outputs/prototype/exports/<file>.png --apply --approve-prototype-generation --actor <actor> --at <timestamp>
```

Record semantic visual QA and enforce the max-two-refinement gate:

```bash
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace /absolute/path/to/project --action qa --refinement-attempt 0 --qa-status pass --apply --approve-prototype-qa --actor <actor> --at <timestamp>
```

The Stage 08 script never creates or fakes Pencil canvas output and does not generate frontend handoff files. If code is running without a live Pencil MCP agent, Stage 08 remains NOT READY until that agent completes the handoff and writes cross-checkable evidence.

Minimum live-check evidence shape:

```json
{
  "evidenceType": "pencil-mcp-live-check",
  "status": "available",
  "checkedAt": "2026-06-06T00:00:00Z",
  "mcpToolCalls": ["get_editor_state"],
  "targetPenPath": "autodesign/outputs/pencil/autodesign-prototype.pen",
  "penFile": {
    "path": "autodesign/outputs/pencil/autodesign-prototype.pen"
  },
  "agentAttestation": {
    "usedActivePencilMcp": true,
    "targetFilePathValidated": true
  }
}
```

Minimum frame/export evidence shape for wireframes or prototype:

```json
{
  "evidenceType": "pencil-mcp-wireframe-generation",
  "mcpToolCalls": ["batch_design", "export_nodes"],
  "targetPenPath": "autodesign/outputs/pencil/autodesign-prototype.pen",
  "liveCheckEvidenceHash": "<recorded-live-check-hash>",
  "penFile": {
    "path": "autodesign/outputs/pencil/autodesign-prototype.pen"
  },
  "batchDesign": {
    "filePath": "autodesign/outputs/pencil/autodesign-prototype.pen",
    "createdNodeIds": ["pencil-frame-id"]
  },
  "exportNodes": {
    "filePath": "autodesign/outputs/pencil/autodesign-prototype.pen",
    "nodeIds": ["pencil-frame-id"],
    "outputPaths": ["autodesign/outputs/pencil/exports/start.png"]
  },
  "agentAttestation": {
    "usedActivePencilMcp": true,
    "createdCanvasNodes": true,
    "exportedCanvasNodes": true
  },
  "frames": [
    {
      "screenId": "screen.start",
      "nodeId": "pencil-frame-id",
      "nodeType": "frame",
      "nodeName": "Start",
      "createdByMcp": true
    }
  ],
  "exports": [
    {
      "path": "autodesign/outputs/pencil/exports/start.png",
      "nodeId": "pencil-frame-id",
      "bytes": 1234,
      "sha256": "<actual-export-file-sha256>"
    }
  ]
}
```

Use `evidenceType: "pencil-mcp-prototype-generation"` for prototype evidence.
