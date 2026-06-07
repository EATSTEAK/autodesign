---
name: autodesign-visuals
description: Private visual reference subskill for prompt records, candidate records, and explicitly approved selected references. Does not create or fake images.
---

# Autodesign Visuals Contract

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running the deterministic readiness check.

## Required Upstream Artifacts

- `canonical.brand-direction` at `autodesign/outputs/canonical/brand-direction.json`
- `canonical.screen-model` at `autodesign/outputs/canonical/screen-model.json`
- `canonical.interaction-model` at `autodesign/outputs/canonical/interaction-model.json`
- generated `canonical.visual-anchor-proposals` at `autodesign/outputs/canonical/visual-anchor-proposals.json`

## Output Artifacts

- `visual.reference-prompts` at `autodesign/outputs/visual-references/prompt-records.json`
- `visual.reference-candidates` at `autodesign/outputs/visual-references/candidate-records.json`
- `visual.reference-selection` at `autodesign/outputs/visual-references/selected-references.json`
- `visual.reference-set` at `autodesign/outputs/visual-references`

## Commands

Plan prompt records:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace <workspace> --action prompts --plan
```

Apply prompt records only after explicit approval:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace <workspace> --action prompts --apply --approve-visual-prompts --actor <actor> --at <timestamp>
```

Record candidates only after the active agent has generated real image files and `canonical.visual-anchor-selection` is manually approved:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace <workspace> --action candidates --prompt-id <prompt-id> --generated-output-path <path> --apply --approve-visual-candidates --actor <actor> --at <timestamp>
```

Select references only by explicit candidate id and explicit approval:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace <workspace> --action selection --reference-id <candidate-id> --apply --approve-visual-reference-selection --actor <actor> --at <timestamp>
```

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill visuals` must pass.
- `canonical.visual-anchor-proposals` must exist, be marked generated in the artifact graph, and have a manifest generation record.
- Prompt records must include prompt text, an active-agent image-generation instruction, generated output path fields, and review metadata.
- Candidate recording must stop unless `canonical.visual-anchor-selection` is approved by a manual gate record.
- Candidate recording must validate existing generated image output paths inside the workspace.
- Selected references must be supplied by `--reference-id` and `--approve-visual-reference-selection`; the script must never auto-select.

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if any required upstream artifact path is absent.
- Stop if canonical visual anchor proposals are not generated.
- Stop if candidate recording lacks manual anchor approval.
- Stop if a generated output path does not exist or is not an image file.
- Stop if selection lacks explicit reference ids and selected-reference approval.

The visuals subskill records prompts, candidate metadata, output paths, review metadata, and selected references. It must not create or fake images, perform Pencil operations, generate design-system artifacts, generate prototypes, or generate handoff material.
