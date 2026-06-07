# Stage 10 - Golden Case E2E Runs

## Objective

Run three approved real-only golden cases from project interview input through canonical artifacts, visual reference selection, live Pencil evidence, design-system records, prototype records, semantic QA, handoff docs, and reconcile reports.

## Approved Cases

- Stripe dispute operations dashboard: dense B2B operational workflow.
- Spotify mobile onboarding to playlist creation: consumer mobile onboarding and core action.
- ChatGPT Projects plus Canvas workflow: AI/chat and creator workflow.

## Scope

- Use real external product/source context in each input brief.
- Use real generated image files for visual reference candidates.
- Use live Pencil MCP `batch_design` and `export_nodes` evidence for canonical screens.
- Persist prompts, selected references, frame ids, export paths, hashes, QA status, handoff outputs, and reconcile alerts.
- Record only concise run reports in-repo; keep bulky generated images and Pencil exports in temp workspaces.

## Validation

- Each golden case must pass `validate-state`, `check-dependencies`, `can-run-subskill handoff`, and `can-run-subskill reconcile`.
- Each golden case must generate only JSON/Markdown handoff outputs and advisory reconcile logs.
- Independent validation must review the run report, changed files, and temp evidence paths before commit.

## Non-Goals

- No new package feature implementation unless a real golden run exposes a blocker.
- No mock images, fixture substitution, fake Pencil canvas, static HTML prototype, frontend source generation, or image-only prototype fallback.
