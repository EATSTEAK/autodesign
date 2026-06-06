# Autodesign

Installable Codex skill package for `eatsteak/autodesign`.

## Public Skill Surface

`autodesign-start/` is the only public skill exposed at install time. Runtime assets, private expanded subskill placeholders, scripts, hooks, and workspace files are bundled under `autodesign-start/assets/payload/`.

Stage 03 implements only the bootstrap runtime. It does not implement canonical generation, image generation, Pencil operations, visual reference generation, design-system work, handoff, or real subskill phase behavior.

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
      subskills/
      scripts/
      hooks/
      workspace-template/
```

The bootstrap script materializes `AGENTS.md`, `.codex/config.toml`, `.codex/hooks/*.mjs`, and the `autodesign/` workspace files from the bundled template.
