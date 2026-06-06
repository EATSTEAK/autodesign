# Payload Scripts

Stage 07 includes deterministic bootstrap, state-management, subskill readiness, canonical generation, and visual reference gate scripts.

## Bootstrap

Plan without writing:

```bash
node autodesign-start/assets/payload/scripts/bootstrap.mjs --target /absolute/path/to/project --plan
```

Apply after explicit bootstrap approval:

```bash
node autodesign-start/assets/payload/scripts/bootstrap.mjs --target /absolute/path/to/project --apply --approve-bootstrap
```

If the plan reports `overwrite`, apply only after separate overwrite approval:

```bash
node autodesign-start/assets/payload/scripts/bootstrap.mjs --target /absolute/path/to/project --apply --approve-bootstrap --approve-overwrite
```

The script only copies files from `workspace-template/`. It does not generate canonical artifacts, images, Pencil files, visual references, design-system outputs, prototypes, handoffs, reports, or downstream phase behavior.

## Manifest And Graph State

Validate `autodesign/manifest.json` and `autodesign/artifact-graph.json`:

```bash
node autodesign-start/assets/payload/scripts/validate-state.mjs --workspace /absolute/path/to/project
```

Check upstream dependency references and cycles:

```bash
node autodesign-start/assets/payload/scripts/check-dependencies.mjs --workspace /absolute/path/to/project
```

Check whether a named private subskill contract can be entered:

```bash
node autodesign-start/assets/payload/scripts/can-run-subskill.mjs --workspace /absolute/path/to/project --subskill interview
```

Compute dirty downstream artifacts from changed upstream artifact ids:

```bash
node autodesign-start/assets/payload/scripts/dirty-artifacts.mjs --workspace /absolute/path/to/project --changed canonical.requirements
```

Record approval gates with explicit data and write approval:

```bash
node autodesign-start/assets/payload/scripts/record-gate.mjs --workspace /absolute/path/to/project --gate state.record-gate --status approved --actor <actor> --at <timestamp> --approve-record
```

## Canonical Generation

Plan canonical generation without writing:

```bash
node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace /absolute/path/to/project --plan
```

Apply canonical generation only with explicit approval and deterministic record metadata:

```bash
node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace /absolute/path/to/project --apply --approve-canonical-generation --actor <actor> --at <timestamp>
```

Use `--subskill interview`, `stories`, `brand`, `views`, `ux`, or `visual-anchors` to generate a bounded canonical subset. UX and visual-anchor generation require explicit platform selection in project inputs.

Canonical generation creates canonical artifacts and updates manifest/graph state only. It does not create images, Pencil files, design-system outputs, prototypes, handoffs, reports, optimization artifacts, or downstream phase artifacts.

## Visual Reference Gates

Plan visual prompt records from generated canonical visual anchor proposals:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace /absolute/path/to/project --action prompts --plan
```

Apply visual prompt records only with explicit approval:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace /absolute/path/to/project --action prompts --apply --approve-visual-prompts --actor <actor> --at <timestamp>
```

Prompt records include prompt text, an active-agent image-generation instruction, generated output path fields initialized as empty, and review metadata. The script does not create images or name an image model.

After the active agent generates a real image file, record candidates by referencing the applied prompt and the existing generated output path:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace /absolute/path/to/project --action candidates --prompt-id <prompt-id> --generated-output-path autodesign/outputs/visual-references/generated/<file>.png --apply --approve-visual-candidates --actor <actor> --at <timestamp>
```

Candidate recording requires `canonical.visual-anchor-selection` to be manually approved and validates that every generated output path exists as an image file inside the workspace. It records paths and metadata only; it does not fake image generation.

Select references only by explicit candidate id and explicit approval:

```bash
node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace /absolute/path/to/project --action selection --reference-id <candidate-id> --apply --approve-visual-reference-selection --actor <actor> --at <timestamp>
```

The selection action never auto-selects references.
