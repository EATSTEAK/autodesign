# Stage 11 - SkillOpt Hardening

## Objective

Implement the deterministic SkillOpt hardening loop after golden-case E2E `PASS`.

## Scope

- Add `scripts/generate-skillopt.mjs` with plan/apply modes and explicit `--approve-skillopt-hardening`, `--actor`, and `--at` apply gates.
- Require `can-run-subskill skillopt` to pass before SkillOpt generation.
- Require `autodesign/logs/eval-report.json` to exist and report E2E `PASS`.
- Schema-validate eval input expectations in the script: `schemaVersion: 1`, `artifactId: "log.eval-report"`, `e2e.status: "PASS"`, and `goldenCases[].skillComparisons[]`.
- Compare skill prompt/version output hashes on golden cases.
- Record accepted and rejected edits in `autodesign/logs/skillopt-report.json`.
- Emit review-only patch proposals in `autodesign/logs/skillopt-patch-proposals.json`.
- Update manifest, artifact graph, payload manifest, and SkillOpt private subskill contract so the report/proposal files are declared artifacts.

## Output Boundary

SkillOpt may write only:

- `autodesign/logs/skillopt-report.json`
- `autodesign/logs/skillopt-patch-proposals.json`
- `autodesign/manifest.json`
- `autodesign/artifact-graph.json`

Patch proposals are manual-review artifacts. SkillOpt must not apply them automatically.

## Validation

- `node --check autodesign-start/assets/payload/scripts/generate-skillopt.mjs`
- `node --check autodesign-start/assets/payload/scripts/lib/autodesign-state.mjs`
- `node autodesign-start/assets/payload/scripts/validate-state.mjs --workspace autodesign-start/assets/payload/workspace-template`
- `node autodesign-start/assets/payload/scripts/check-dependencies.mjs --workspace autodesign-start/assets/payload/workspace-template`
- `node autodesign-start/assets/payload/scripts/can-run-subskill.mjs --workspace <temp-workspace> --subskill skillopt`
- `node autodesign-start/assets/payload/scripts/generate-skillopt.mjs --workspace <temp-workspace> --plan`
- `node autodesign-start/assets/payload/scripts/generate-skillopt.mjs --workspace <temp-workspace> --apply --approve-skillopt-hardening --actor <actor> --at <timestamp>`
- `git diff --check`

## Non-Goals

- No automatic upstream skill updates.
- No frontend source code.
- No Pencil MCP calls.
- No image generation.
- No generated design assets.
- No weakening of direct subskill fail-fast readiness checks.
