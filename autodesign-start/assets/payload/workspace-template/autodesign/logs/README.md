# Autodesign Logs

Canonical generation creates `decision-log.json`.

Prototype visual QA and refinement logs are stored under `outputs/prototype/`.

Stage 09 creates `reconcile-report.json` as an advisory JSON report from artifact graph dirty propagation and preserve/may-change policies. It does not mutate upstream artifacts. Eval report generation remains a later-stage upstream output.

Stage 11 SkillOpt reads an E2E PASS `eval-report.json` and writes `skillopt-report.json` plus `skillopt-patch-proposals.json`. Patch proposals are review-only artifacts and are not applied automatically.
