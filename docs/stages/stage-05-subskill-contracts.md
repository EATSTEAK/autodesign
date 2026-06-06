# Stage 05: Subskill Contracts

## Objective

Define all expanded Autodesign subskills as contract-only runtime boundaries with explicit inputs, outputs, gates, and fail-fast dependency checks.

## Success Criteria

- Payload includes one `SKILL.md` for each planned expanded subskill.
- Each direct subskill documents required upstream artifacts and fails fast when prerequisites are missing.
- `autodesign-start` remains the only public dependency-completing router.
- Scripts provide deterministic dependency checks for subskill invocation.
- No phase artifact generation, image generation, Pencil operations, DS generation, or handoff generation is implemented in this stage.

## Implementation Notes

- Use the Stage 04 manifest/graph scripts as the source for dependency checks.
- Subskills should be private payload assets until bootstrap expands them into a project.
- Keep all subskills as contracts; later stages add generation behavior.
