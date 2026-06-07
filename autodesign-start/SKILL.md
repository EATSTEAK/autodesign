---
name: autodesign-start
description: Start Autodesign setup from the eatsteak/autodesign skill package. Use when the user asks to initialize, start, install-check, bootstrap, validate state, inspect the artifact graph, check subskill readiness, record gates, compute dirty artifacts, generate canonical artifacts, run visual reference gates, or run Stage 08 Pencil/DS/prototype/QA metadata records. Do not generate frontend handoff.
---

# Autodesign Start

This is the only public skill exposed by the `eatsteak/autodesign` package at install time.

## Current Stage

Stage 08 provides a one-shot bootstrap runtime that materializes the bundled Autodesign workspace template into a target project, deterministic manifest and artifact graph state-management scripts, private subskill readiness checks, canonical artifact generation from real project input files, visual reference prompt/candidate/selection record gates, and Stage 08 Pencil/DS/prototype/QA metadata workflows.

Allowed Stage 08 generation is limited to canonical planning artifacts, visual reference records, Pencil live-check records, wireframe/prototype metadata, canvas export path records, primitive inventory, DS tokens/contracts, semantic visual QA, and max-two-refinement records. Pencil canvas edits and exports are performed by the active agent through Pencil; scripts only record real evidence and fail fast when live-check evidence, active `batch_design`/`export_nodes` evidence, an Autodesign-owned virtual `.pen` filePath, created/exported node bindings, or real export files are missing. Do not generate frontend handoff files.

## Bundled Payload

Runtime assets live under `assets/payload/`:

- `subskills/` for private Autodesign subskill contracts.
- `schemas/` for manifest and artifact graph JSON schema files.
- `scripts/bootstrap.mjs` for deterministic plan/apply workspace materialization.
- `scripts/generate-canonical.mjs` for deterministic canonical artifact generation and manifest/graph updates.
- `scripts/generate-visual-references.mjs` for visual reference prompt, candidate, and selected-reference records.
- `scripts/generate-pencil-prototype.mjs` for Stage 08 Pencil live-check, wireframe, primitive, DS, prototype, QA, and refinement-gate records.
- `scripts/validate-state.mjs`, `scripts/check-dependencies.mjs`, `scripts/can-run-subskill.mjs`, `scripts/record-gate.mjs`, and `scripts/dirty-artifacts.mjs` for state and contract readiness management.
- `hooks/` for no-op lifecycle hook adapters.
- `workspace-template/` for files materialized by the bootstrap runtime.

Read `assets/payload/payload-manifest.json` for the concrete Stage 08 payload inventory.

## Bootstrap Command

Always plan before applying:

```bash
node autodesign-start/assets/payload/scripts/bootstrap.mjs --target /absolute/path/to/project --plan
```

Apply only after the user explicitly approves the bootstrap write:

```bash
node autodesign-start/assets/payload/scripts/bootstrap.mjs --target /absolute/path/to/project --apply --approve-bootstrap
```

If the plan reports any `overwrite` actions, apply only after the user separately approves overwrites:

```bash
node autodesign-start/assets/payload/scripts/bootstrap.mjs --target /absolute/path/to/project --apply --approve-bootstrap --approve-overwrite
```

## Approval Gates

1. Run `--plan` first and report the `create`, `overwrite`, and `preserve` counts.
2. Do not run `--apply` unless the user explicitly approves writing bootstrap files.
3. Pass `--approve-bootstrap` with every `--apply` command.
4. If the plan contains `overwrite`, ask for explicit overwrite approval and pass `--approve-overwrite`.
5. Never treat approval to bootstrap as approval to run later Autodesign generation phases.

## State Commands

Validate manifest and graph JSON:

```bash
node autodesign-start/assets/payload/scripts/validate-state.mjs --workspace /absolute/path/to/project
```

Check required upstream dependencies and cycles:

```bash
node autodesign-start/assets/payload/scripts/check-dependencies.mjs --workspace /absolute/path/to/project
```

Check whether a named private subskill contract can be entered:

```bash
node autodesign-start/assets/payload/scripts/can-run-subskill.mjs --workspace /absolute/path/to/project --subskill interview
```

Compute dirty downstream artifacts from changed upstreams:

```bash
node autodesign-start/assets/payload/scripts/dirty-artifacts.mjs --workspace /absolute/path/to/project --changed canonical.requirements
```

Record an approval gate only with an explicit actor, timestamp, and write approval:

```bash
node autodesign-start/assets/payload/scripts/record-gate.mjs --workspace /absolute/path/to/project --gate state.record-gate --status approved --actor <actor> --at <timestamp> --approve-record
```

## Canonical Generation

Plan before applying:

```bash
node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace /absolute/path/to/project --plan
```

Apply only with explicit canonical generation approval and deterministic metadata:

```bash
node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace /absolute/path/to/project --apply --approve-canonical-generation --actor <actor> --at <timestamp>
```

Generation reads real files from `autodesign/inputs`. UX rules, interaction model, screen-state matrix, and visual anchor proposals are blocked unless project inputs include explicit platform selection. Primary visual anchor proposals are emitted as unapproved proposals only.

## Visual Reference Gates

Prompt records require generated canonical visual anchor proposals:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace /absolute/path/to/project --action prompts --plan
```

Apply prompt records only with explicit approval:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace /absolute/path/to/project --action prompts --apply --approve-visual-prompts --actor <actor> --at <timestamp>
```

Candidate records require a manually approved `canonical.visual-anchor-selection` gate and real generated image paths:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace /absolute/path/to/project --action candidates --prompt-id <prompt-id> --generated-output-path <path> --apply --approve-visual-candidates --actor <actor> --at <timestamp>
```

Selected references require explicit reference ids and approval:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace /absolute/path/to/project --action selection --reference-id <candidate-id> --apply --approve-visual-reference-selection --actor <actor> --at <timestamp>
```

The visual reference script never auto-selects references and never creates image files.

## Stage 08 Pencil, DS, Prototype, And QA

Run `generate-pencil-prototype.mjs --plan` before any apply. All actions require approved selected visual references. Pencil-derived actions require a live Pencil MCP handoff: `get_editor_state`, `batch_design`, `export_nodes`, target `autodesign/outputs/pencil/*.pen`, frame evidence for canonical screens, export node bindings, and real canvas export paths.

```bash
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace /absolute/path/to/project --action live-check --pencil-live-check-source-path <path> --plan
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace /absolute/path/to/project --action wireframes --pencil-evidence-path <path> --canvas-export-path <path> --plan
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace /absolute/path/to/project --action primitives --plan
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace /absolute/path/to/project --action ds --plan
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace /absolute/path/to/project --action prototype --pencil-evidence-path <path> --canvas-export-path <path> --plan
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace /absolute/path/to/project --action qa --refinement-attempt 0 --qa-status pass --plan
```

Apply only with the action-specific approval flag, `--actor`, and `--at`. The QA action blocks refinement after two unsuccessful attempts.

Handoff contract when code cannot call MCP directly: Stage 08 is NOT READY until a live Pencil agent has targeted the Autodesign-owned virtual `.pen` filePath, created wireframe/prototype frames with `batch_design`, exported screenshots with `export_nodes`, and written evidence JSON containing `evidenceType`, `mcpToolCalls`, `targetPenPath`, `liveCheckEvidenceHash`, `batchDesign.createdNodeIds`, `exportNodes.nodeIds`, per-screen `frames[]`, and `exports[]` with matching path/bytes/sha256/node bindings.

## Materialized Files

The bootstrap runtime copies `assets/payload/workspace-template/` into the target project. Stage 08 materializes:

- `AGENTS.md`
- `.codex/config.toml`
- `.codex/hooks/*.mjs`
- `autodesign/README.md`
- `autodesign/manifest.json`
- `autodesign/artifact-graph.json`
- `autodesign/.system/install-state.json`
- marker README files under `autodesign/inputs/`, `autodesign/outputs/`, and `autodesign/logs/`

## When Invoked

1. Confirm that `autodesign-start` is installed and visible.
2. Locate `assets/payload/scripts/bootstrap.mjs`.
3. Run the plan command against the requested target workspace.
4. Report planned file actions and approval gates.
5. Apply only with the explicit approval flags described above.
6. For private subskill requests, run `can-run-subskill.mjs` and report readiness before any apply command.
7. For canonical generation requests, run `generate-canonical.mjs --plan` first and apply only with `--approve-canonical-generation --actor <actor> --at <timestamp>`.
8. For visual reference requests, run `generate-visual-references.mjs --plan` first. Apply prompt, candidate, or selection records only with that action's explicit approval flag.
9. For Pencil, DS, prototype, or QA requests, run `generate-pencil-prototype.mjs --plan` first. Apply only with the action-specific approval flag, `--actor`, and `--at`.
