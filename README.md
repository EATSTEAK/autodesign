# Autodesign

Installable Codex skill package for `eatsteak/autodesign`.

## Public Skill Surface

`autodesign-start/` is the only public skill exposed at install time. Runtime assets, private expanded subskill contracts, scripts, hooks, and workspace files are bundled under `autodesign-start/assets/payload/`.

Stage 11 implements bootstrap workspace materialization, deterministic manifest and artifact graph state management, private subskill readiness checks, canonical pipeline generation from real project input files, visual reference gates, Pencil/DS/prototype/QA metadata records, frontend handoff documentation, reconcile reports, SkillOpt hardening reports, and advisory hooks. Canonical generation emits project brief/interview intent, requirements/stories, brand direction, UX rules, screen model, interaction model, coverage matrix, decision log, navigation, screen-state matrix, and unapproved primary visual anchor proposals.

Visual reference gates add prompt, candidate, and selected-reference records. Prompt records instruct the active agent to generate real images without hardcoding an image model. Candidate records persist only real generated output paths and review metadata. Selected references require explicit user approval and cannot be auto-selected.

Stage 08 adds a `generate-pencil-prototype.mjs` script for Pencil live-check records, wireframe metadata, canvas export path records, primitive inventory, DS tokens/contracts, prototype metadata, semantic visual QA, and a max-two-refinement gate. Pencil canvas work remains live-agent work through Pencil; scripts fail fast if live Pencil evidence, active `batch_design` frame evidence, `export_nodes` node bindings, an Autodesign-owned virtual `.pen` filePath, or real export files are missing.

Stage 09 adds `generate-handoff.mjs` for JSON/Markdown frontend handoff documentation and advisory reconcile reports. It never writes frontend source files, executable prototype code, images, or Pencil canvas changes. Stage 09 hooks are read-only adapters for status injection, lightweight schema validation, overwrite warnings, turn summaries, and reconcile alerts.

Stage 11 adds `generate-skillopt.mjs` for the SkillOpt hardening loop. It reads only an E2E PASS eval report, compares skill prompt/version outputs across golden cases, records accepted/rejected edits, and writes review-only patch proposal JSON. It never applies upstream skill edits, writes frontend code, calls image generation, calls Pencil MCP, or creates design assets.

## Bootstrap Runtime

Plan a target workspace first:

```bash
node autodesign-start/assets/payload/scripts/bootstrap.mjs --target /absolute/path/to/project --plan
```

Apply only with explicit approval:

```bash
node autodesign-start/assets/payload/scripts/bootstrap.mjs --target /absolute/path/to/project --apply --approve-bootstrap
```

If the plan reports overwrites, add `--approve-overwrite` only after separate overwrite approval.

## Package Layout

```text
autodesign-start/
  SKILL.md
  assets/
    payload/
      payload-manifest.json
      schemas/
      subskills/
      scripts/
      hooks/
      workspace-template/
```

The bootstrap script materializes `AGENTS.md`, `.codex/config.toml`, `.codex/hooks/*.mjs`, and the `autodesign/` workspace files from the bundled template.

## Manifest And Artifact Graph

The current runtime materializes:

- `autodesign/manifest.json`
- `autodesign/artifact-graph.json`

Validate the state files:

```bash
node autodesign-start/assets/payload/scripts/validate-state.mjs --workspace /absolute/path/to/project
```

Check graph dependencies:

```bash
node autodesign-start/assets/payload/scripts/check-dependencies.mjs --workspace /absolute/path/to/project
```

Check whether a named private subskill contract can be entered:

```bash
node autodesign-start/assets/payload/scripts/can-run-subskill.mjs --workspace /absolute/path/to/project --subskill interview
```

Compute dirty downstream artifacts from upstream changes:

```bash
node autodesign-start/assets/payload/scripts/dirty-artifacts.mjs --workspace /absolute/path/to/project --changed canonical.requirements
```

Record an approval gate only with an explicit deterministic timestamp and `--approve-record`.

## Canonical Generation

Plan canonical generation from project inputs:

```bash
node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace /absolute/path/to/project --plan
```

Apply only with explicit approval and deterministic record metadata:

```bash
node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace /absolute/path/to/project --apply --approve-canonical-generation --actor <actor> --at <timestamp>
```

UX rules, interaction model, screen-state matrix, and visual anchor proposals require explicit platform selection in `autodesign/inputs`. Visual anchor proposals are generated with `approved: false`; selecting or approving an anchor belongs to a later stage.

## Visual Reference Gates

Plan prompt records from generated canonical visual anchor proposals:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace /absolute/path/to/project --action prompts --plan
```

Apply prompt records only with explicit approval:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace /absolute/path/to/project --action prompts --apply --approve-visual-prompts --actor <actor> --at <timestamp>
```

After the active agent creates a real image file, record it as a candidate. Candidate apply requires manual approval of `canonical.visual-anchor-selection`:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace /absolute/path/to/project --action candidates --prompt-id <prompt-id> --generated-output-path <path> --apply --approve-visual-candidates --actor <actor> --at <timestamp>
```

Select references only by explicit id and explicit approval:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace /absolute/path/to/project --action selection --reference-id <candidate-id> --apply --approve-visual-reference-selection --actor <actor> --at <timestamp>
```

## Stage 08 Records

Record Pencil, DS, prototype, and QA metadata only after selected visual references are approved:

```bash
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace /absolute/path/to/project --action live-check --pencil-live-check-source-path <path> --plan
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace /absolute/path/to/project --action wireframes --pencil-evidence-path <path> --canvas-export-path <path> --plan
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace /absolute/path/to/project --action primitives --plan
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace /absolute/path/to/project --action ds --plan
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace /absolute/path/to/project --action prototype --pencil-evidence-path <path> --canvas-export-path <path> --plan
node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace /absolute/path/to/project --action qa --refinement-attempt 0 --qa-status pass --plan
```

Apply requires the matching `--approve-*` flag, `--actor`, and `--at`. Pencil-derived actions must target `autodesign/outputs/pencil/*.pen`, validate real canvas export files, and cross-check evidence JSON against the virtual Pencil filePath plus export file bytes.

If code is running without direct MCP access, Stage 08 remains NOT READY until a live Pencil agent completes this handoff: target the owned virtual `.pen` filePath, run `get_editor_state`, run `batch_design` to create wireframe/prototype frames, run `export_nodes`, and write evidence JSON with tool calls, target filePath, per-screen frame node ids, export node bindings, and export path/hash records.

## Stage 09 Handoff And Reconcile

Plan handoff documentation after Stage 08 QA passes:

```bash
node autodesign-start/assets/payload/scripts/generate-handoff.mjs --workspace /absolute/path/to/project --action handoff --plan
```

Apply only with explicit approval:

```bash
node autodesign-start/assets/payload/scripts/generate-handoff.mjs --workspace /absolute/path/to/project --action handoff --apply --approve-handoff-generation --actor <actor> --at <timestamp>
```

Generate advisory reconcile reports from changed upstream artifact ids:

```bash
node autodesign-start/assets/payload/scripts/generate-handoff.mjs --workspace /absolute/path/to/project --action reconcile --changed canonical.requirements --apply --approve-reconcile-report --actor <actor> --at <timestamp>
```

Handoff outputs are limited to `autodesign/outputs/handoff/handoff-package.json` and `autodesign/outputs/handoff/README.md`. Reconcile output is limited to `autodesign/logs/reconcile-report.json`.

## Stage 11 SkillOpt

Plan SkillOpt after `autodesign/logs/eval-report.json` exists and reports E2E `PASS`:

```bash
node autodesign-start/assets/payload/scripts/generate-skillopt.mjs --workspace /absolute/path/to/project --plan
```

Apply only with explicit approval:

```bash
node autodesign-start/assets/payload/scripts/generate-skillopt.mjs --workspace /absolute/path/to/project --apply --approve-skillopt-hardening --actor <actor> --at <timestamp>
```

SkillOpt output is limited to `autodesign/logs/skillopt-report.json` and `autodesign/logs/skillopt-patch-proposals.json`, plus manifest/graph state metadata.
