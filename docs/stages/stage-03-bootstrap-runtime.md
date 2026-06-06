# Stage 03: Bootstrap Runtime

## Objective

Implement the one-shot bootstrap runtime that expands the bundled Autodesign payload into a target project workspace.

## Success Criteria

- `autodesign-start` documents the explicit bootstrap command and approval gates.
- Payload contains concrete subskill placeholders, hooks, workspace template files, and deterministic bootstrap scripts.
- Bootstrap detects create/overwrite/preserve paths before writing and requires explicit overwrite approval.
- Bootstrap records `.system/install-state.json`.
- Bootstrap materializes `AGENTS.md`, `.codex/config.toml`, `.codex/hooks/*.mjs`, and `autodesign/` workspace files.
- No canonical generation, image generation, Pencil operations, or subskill phase behavior is implemented in this stage.

## Implementation Notes

- Existing local Codex config was observed at `/Users/koohyomin/.codex/config.toml`; no local project hook examples were found.
- Use `.codex/config.toml` plus `.codex/hooks/*.mjs` in the payload, matching the product spec.
- Scripts should be deterministic and safe: first plan, then apply only when explicitly approved.
