# Stage 12 - Release Readiness

## Objective

Validate the installable Autodesign package as release-ready after Stage 11.

## Scope

- Validate package metadata and git-reviewable diffs.
- Verify fresh bootstrap and first-run expansion into a clean workspace.
- Verify direct subskill fail-fast behavior.
- Verify user-gated visual flow still requires explicit approval before candidates and selected references.
- Verify live Pencil output, semantic QA, handoff, reconcile, and SkillOpt readiness on existing golden evidence.
- Verify SkillOpt remains manual-review-only and never applies upstream patch proposals automatically.

## Acceptance Checks

- `node --check` passes for all payload scripts.
- `validate-state` and `check-dependencies` pass for the workspace template.
- Fresh bootstrap plan/apply works.
- `can-run-subskill skillopt` fails before `eval-report.json` and passes after an E2E PASS eval report.
- Visual candidate recording fails before `canonical.visual-anchor-selection` approval.
- Pencil/QA/handoff/reconcile evidence from Stage 10 remains valid.
- SkillOpt plan/apply writes only report/proposal JSON plus manifest/graph state.
- Independent validation returns `PASS` before commit.

## Non-Goals

- No new runtime behavior unless a release blocker is found.
- No package publication or remote push.
- No automatic upstream application of SkillOpt proposals.

## Evidence

- GitHub repo: `https://github.com/EATSTEAK/autodesign`
- GitHub visibility and permission: public repo, current user has `ADMIN`.
- `pnpx skills add eatsteak/autodesign --yes`: passed after remote repo creation.
- Installed public skill count: 1, `autodesign-start`.
- Installed first-run workspace: `/private/tmp/autodesign-stage12-installed-first-run-JqG4Fi`
- Installed first-run bootstrap plan: 11 creates, 0 overwrites, 0 preserves.
- Installed first-run `validate-state`: valid, 31 artifacts, 20 gates, 0 errors, 0 warnings.
- Installed first-run `check-dependencies`: valid, 31 artifacts, 117 dependencies, 0 cycles.
- Release workspace: `/private/tmp/autodesign-stage12-release-r3dLtd`
- Payload script syntax checks: 12 `.mjs` files passed `node --check`.
- Template `validate-state`: valid, 31 artifacts, 20 gates, 0 errors, 0 warnings.
- Template `check-dependencies`: valid, 31 artifacts, 117 dependencies, 0 cycles.
- Visual candidate recording before `canonical.visual-anchor-selection` approval: failed as expected.
- Visual candidate recording after `canonical.visual-anchor-selection` approval: passed.
- Direct subskill fail-fast before prerequisites in release workspace:
  - `wireframe`: failed as expected.
  - `handoff`: failed as expected.
  - `reconcile`: failed as expected.
  - `eval`: failed as expected.
  - `skillopt`: failed as expected before `eval-report.json`.
- SkillOpt after E2E PASS eval report: `can-run-subskill skillopt` passed.
- SkillOpt plan write boundary: `autodesign/logs/skillopt-report.json`, `autodesign/logs/skillopt-patch-proposals.json`, `autodesign/manifest.json`, `autodesign/artifact-graph.json`.
- Stage 10 golden workspaces revalidated:
  - `/private/tmp/autodesign-golden-stripe-oD0xMB`: valid, 0 errors, 0 warnings.
  - `/private/tmp/autodesign-golden-spotify-oxTvbU`: valid, 0 errors, 0 warnings.
  - `/private/tmp/autodesign-golden-chatgpt-Wi7SOu`: valid, 0 errors, 0 warnings.
