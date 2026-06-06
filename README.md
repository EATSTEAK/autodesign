# Autodesign

Installable Codex skill package for `eatsteak/autodesign`.

## Public Skill Surface

`autodesign-start/` is the only public skill exposed at install time. Runtime assets, private expanded subskill contracts, scripts, hooks, and workspace files are bundled under `autodesign-start/assets/payload/`.

Stage 06 implements bootstrap workspace materialization, deterministic manifest and artifact graph state management, private subskill readiness checks, and canonical pipeline generation from real project input files. It generates canonical planning artifacts only: project brief/interview intent, requirements/stories, brand direction, UX rules, screen model, interaction model, coverage matrix, decision log, navigation, screen-state matrix, and unapproved primary visual anchor proposals.

Stage 06 does not implement image generation, Pencil operations, visual reference generation, design-system work, prototype generation, handoff, report generation, skill optimization, or downstream phase behavior.

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

Stage 06 materializes:

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
