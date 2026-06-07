# Stage 08: Pencil Prototype And Design System

## Objective

Implement the live Pencil wireframe/prototype, primitive extraction, design-system artifact generation, and semantic visual alignment QA loop.

## Success Criteria

- Scripts require selected visual references before Pencil or DS/prototype work can proceed.
- Pencil operations target an Autodesign-owned `.pen` file, not an unrelated active user document.
- Stage 08 cannot pass on metadata/path records alone; live Pencil MCP canvas generation and export evidence is required.
- Wireframe/prototype metadata, canvas exports, primitive inventory, DS tokens/contracts, and visual QA reports are persisted.
- Visual QA supports up to two refinement attempts before requiring a user gate.
- Manifest/graph state tracks Pencil, primitive, DS, prototype, QA, and refinement gates.
- No frontend handoff generation is implemented in this stage.

## Implementation Notes

- Pencil MCP is a hard dependency. If it is unavailable, implementation may add scripts/contracts, but validation must classify live Pencil output as blocked or `NOT READY`.
- Runtime scripts may record metadata, but they do not satisfy Stage 08 by themselves. A live Pencil agent must target `autodesign/outputs/pencil/*.pen`, run `get_editor_state`, create wireframe/prototype frames with `batch_design`, export screenshots with `export_nodes`, and write cross-checkable evidence JSON.
- Externally supplied live-check JSON is not a sole trust source. Evidence must include `evidenceType`, `mcpToolCalls`, `targetPenPath`, `batchDesign.createdNodeIds`, `exportNodes.nodeIds`, per-screen frame node ids, and export path/bytes/sha256/node bindings that scripts can compare to actual export files.
- The Pencil MCP disconnected during the stage preflight after relaunch, so live canvas work must be rechecked before final Stage 08 PASS.
- Do not write to the currently active user `.pen` file; create or open an Autodesign-specific file first.
