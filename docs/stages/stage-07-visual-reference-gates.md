# Stage 07: Visual Reference Gates

## Objective

Implement the visual reference workflow after canonical visual anchor proposals: prompt creation, real image-generation instructions, candidate persistence, user-gated anchor approval, and user-selected visual references.

## Success Criteria

- Visual reference scripts require generated canonical visual anchor proposals.
- Anchor proposals must be manually approved before candidate generation can apply.
- Candidate records persist prompts, requested image-generation instructions, generated output paths, and review metadata.
- Selected references require explicit user approval and are recorded without auto-selection.
- Manifest/graph state tracks visual reference records and gates.
- No Pencil operations, DS generation, prototype generation, or handoff generation is implemented in this stage.

## Implementation Notes

- Do not hardcode an image model name; instruct the active agent to generate images.
- The scripts may plan prompt packages and record externally generated image paths, but must not fake image generation.
- Candidate recording must validate that generated output paths exist as image files before apply.
