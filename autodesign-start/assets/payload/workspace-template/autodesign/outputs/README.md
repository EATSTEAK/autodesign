# Autodesign Outputs

Canonical source-of-truth artifacts are created under `outputs/canonical/` when `generate-canonical.mjs` is applied with explicit approval.

Visual reference prompt, candidate, and selected-reference records are created under `outputs/visual-references/` when `generate-visual-references.mjs` is applied with explicit approval. The script records active-agent image-generation instructions and real generated output paths; it does not create or fake image files.

Stage 08 records Pencil live-checks, wireframe metadata, and canvas export path records under `outputs/pencil/`; primitive inventory and DS tokens/contracts under `outputs/design-system/`; and prototype metadata, canvas export path records, visual QA, and refinement logs under `outputs/prototype/`.

Frontend handoff packages are not generated in Stage 08.
