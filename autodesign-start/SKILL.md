---
name: autodesign-start
description: Start Autodesign setup from the eatsteak/autodesign skill package. Use when the user asks to initialize, start, install-check, or run Autodesign. In the Stage 02 scaffold, report that runtime generation is not implemented yet and inspect only the bundled payload placeholders.
---

# Autodesign Start

This is the only public skill exposed by the `eatsteak/autodesign` package at install time.

## Current Stage

Stage 02 provides package structure only. Do not generate projects, create Pencil files, call image generation, scaffold workspaces, run hooks, or execute bootstrap behavior from this skill yet.

Bootstrap runtime behavior belongs to Stage 03. Detailed generators and expanded subskill behavior belong to later stages.

## Bundled Payload

Future runtime assets will live under `assets/payload/`:

- `subskills/` for expanded private Autodesign subskills.
- `scripts/` for deterministic helper scripts.
- `hooks/` for lifecycle hook definitions or adapters.
- `workspace-template/` for files materialized by the bootstrap runtime.

Read `assets/payload/payload-manifest.json` for the current placeholder inventory.

## When Invoked Now

1. Confirm that `autodesign-start` is installed and visible.
2. Explain that this package is currently a Stage 02 scaffold.
3. Do not execute runtime actions until Stage 03 adds an explicit bootstrap entrypoint.
