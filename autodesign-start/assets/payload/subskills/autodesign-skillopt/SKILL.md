---
name: autodesign-skillopt
description: Private Stage 11 SkillOpt subskill. Generates deterministic hardening reports and review-only patch proposals after eval E2E PASS.
---

# Autodesign SkillOpt

This private payload subskill is not public. Enter it only through `autodesign-start` or a later orchestrator after running the deterministic readiness check.

## Required Upstream Artifacts

- `log.eval-report` at `autodesign/logs/eval-report.json`

The eval report must have `e2e.status: "PASS"` and schema-validated golden case comparisons for skill prompt/version outputs.

## Output Artifacts

- `log.skillopt-report` at `autodesign/logs/skillopt-report.json`
- `log.skillopt-patch-proposals` at `autodesign/logs/skillopt-patch-proposals.json`

These artifacts record accepted/rejected edit decisions and review-only patch proposals. They do not apply upstream edits.

## Hard Gates

- `scripts/can-run-subskill.mjs --workspace <workspace> --subskill skillopt` must pass.
- `autodesign/logs/eval-report.json` must validate and report E2E `PASS`.
- The artifact graph must contain every required upstream and output artifact id.

## Commands

Plan without writing:

```bash
node autodesign-start/assets/payload/scripts/generate-skillopt.mjs --workspace <workspace> --plan
```

Apply only with explicit approval:

```bash
node autodesign-start/assets/payload/scripts/generate-skillopt.mjs --workspace <workspace> --apply --approve-skillopt-hardening --actor <actor> --at <timestamp>
```

## Fail Fast

- Stop if state validation fails.
- Stop if graph dependencies are missing or cyclic.
- Stop if `log.eval-report` is missing at its graph path.
- Stop if eval `e2e.status` is not `PASS`.
- Stop if golden cases omit skill prompt/version output comparisons.
- Stop if accepted edits do not include a review-only patch proposal targeting `autodesign-start/SKILL.md` or a private subskill `SKILL.md`.
- Write only `autodesign/logs/skillopt-report.json`, `autodesign/logs/skillopt-patch-proposals.json`, and manifest/graph state metadata.
- Do not apply patch proposals, mutate upstream skill files, generate frontend code, call image generation, or call Pencil MCP.
