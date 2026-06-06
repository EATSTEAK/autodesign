# Autodesign

Installable Codex skill package scaffold for `eatsteak/autodesign`.

## Public Skill Surface

`autodesign-start/` is the only public skill exposed at install time. Future runtime assets, private expanded subskills, scripts, hooks, and workspace files are bundled under `autodesign-start/assets/payload/`.

Stage 02 is structural only. It does not implement bootstrap runtime behavior, generators, hook execution, image generation, Pencil operations, or workspace materialization.

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

This scaffold is ready for Stage 03 to add an explicit bootstrap runtime entrypoint while keeping `autodesign-start` as the public install-time skill.
