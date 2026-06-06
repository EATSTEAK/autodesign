# Payload Scripts

Stage 03 includes only a deterministic bootstrap materialization script.

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

The script only copies files from `workspace-template/`. It does not generate canonical artifacts, images, Pencil files, visual references, design-system outputs, handoffs, or real subskill phase behavior.
