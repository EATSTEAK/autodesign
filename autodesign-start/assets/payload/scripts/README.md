# Payload Scripts

Stage 05 includes deterministic bootstrap, state-management, and subskill contract readiness scripts.

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

The script only copies files from `workspace-template/`. It does not generate canonical artifacts, images, Pencil files, visual references, design-system outputs, prototypes, handoffs, reports, or real subskill phase behavior.

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

These scripts validate and record state only. They do not create canonical, visual, Pencil, design-system, prototype, handoff, report, optimization, or phase artifacts.
