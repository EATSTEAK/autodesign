# Stage 02: Package Scaffold

## Objective

Create the installable GitHub skill package scaffold for `eatsteak/autodesign`, with only `autodesign-start` exposed initially and all later runtime assets bundled as payload.

## Success Criteria

- The repository contains a public `autodesign-start/SKILL.md`.
- `autodesign-start/assets/payload/` contains placeholder structure for expanded subskills, scripts, hooks, and workspace template.
- The scaffold documents that `autodesign-start` is the only public skill at install time.
- No runtime generation behavior is implemented in this stage.
- The scaffold is reviewable and ready for Stage 03 bootstrap runtime implementation.

## Implementation Notes

- Local installed skills on this machine use the `skill-name/SKILL.md` layout; no local `openai.yaml` examples were found.
- Keep this stage structural. Detailed subskill behavior belongs to Stage 05 and later.
