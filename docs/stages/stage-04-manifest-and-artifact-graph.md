# Stage 04: Manifest And Artifact Graph

## Objective

Implement deterministic workspace state management for Autodesign artifacts.

## Success Criteria

- Workspace template includes `autodesign/manifest.json` and `autodesign/artifact-graph.json`.
- Payload includes schema files for manifest and artifact graph shape.
- Scripts can validate manifest/graph JSON, check required upstream dependencies, record approvals/gates, and compute dirty downstream artifacts from upstream changes.
- Reconcile metadata supports preserve/may-change policies.
- Scripts are deterministic and do not generate canonical, visual, Pencil, DS, or handoff artifacts.

## Implementation Notes

- Treat canonical artifacts as source of truth and generated visual outputs as references/targets only.
- Keep Stage 04 focused on state, validation, and dependency semantics.
- Later stages should consume these scripts instead of reimplementing dependency checks.
