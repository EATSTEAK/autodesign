# Autodesign

Installable Codex skill package for `eatsteak/autodesign`.

## Public Skill Surface

`autodesign-start/` is the only public skill exposed at install time. Runtime assets, private expanded subskill contracts, scripts, hooks, and workspace files are bundled under `autodesign-start/assets/payload/`.

Stage 05 implements bootstrap workspace materialization, deterministic manifest and artifact graph state management, private subskill contract documentation, and subskill readiness checks. It does not implement canonical generation, image generation, Pencil operations, visual reference generation, design-system work, prototype generation, handoff, report generation, skill optimization, or real subskill phase behavior.

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

Stage 05 materializes:

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
