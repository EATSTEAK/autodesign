# Stage 10 Golden Case E2E Runs

## Summary

Stage 10 ran three approved real-only golden cases through interview input, canonical generation, visual reference selection, live Pencil MCP frame creation, Pencil exports, design-system generation, prototype metadata, semantic QA, handoff docs, and reconcile reports.

No mock images, fixture substitution, fake Pencil canvas, static HTML prototype, frontend code, or image-only fallback was used. Bulky generated images, Pencil exports, and full run workspaces are intentionally kept in `/private/tmp`; this document records stable paths and hashes for review.

## Common Pipeline

- Bootstrapped each temp workspace with `scripts/bootstrap.mjs --apply --approve-bootstrap`.
- Wrote a real product brief under `autodesign/inputs/product-brief.txt`.
- Ran `scripts/generate-canonical.mjs --apply --approve-canonical-generation`.
- Approved `canonical.visual-anchor-selection` with `scripts/record-gate.mjs`.
- Ran `scripts/generate-visual-references.mjs` for `prompts`, `candidates`, and `selection`.
- Used real generated PNGs copied into each workspace as `autodesign/outputs/visual-references/generated/visual.prompt.001.png`.
- Called live Pencil MCP `get_editor_state`, `batch_design`, and `export_nodes`.
- Persisted Pencil evidence under `autodesign/logs/pencil-evidence/`.
- Ran `scripts/generate-pencil-prototype.mjs` actions: `live-check`, `wireframes`, `primitives`, `ds`, `prototype`, and `qa`.
- Ran `scripts/generate-handoff.mjs` actions: `handoff` and `reconcile`.
- Verified `validate-state`, `check-dependencies`, `can-run-subskill handoff`, and `can-run-subskill reconcile`.

## Stripe Dispute Operations Dashboard

- Coverage: dense B2B operational workflow.
- Workspace: `/private/tmp/autodesign-golden-stripe-oD0xMB`
- Source context:
  - `https://docs.stripe.com/dashboard/basics`
  - `https://docs.stripe.com/disputes/responding`
- Generated image source: `/Users/koohyomin/.codex/generated_images/019e9d28-a33c-7172-9778-b7185f0b1da9/ig_0e061ca30d501f7e016a24f5dda66c8191a194bede9f6b3f48.png`
- Workspace visual reference: `autodesign/outputs/visual-references/generated/visual.prompt.001.png`
- Image bytes: `1355564`
- Image sha256: `50e4e2a83695ad7590d3f78a5463fa6ea7aeed4bbc5c2f50793e821ea9bb5186`
- Selected reference id: `visual.candidate.0338c76d75402d46`
- Pencil target: `autodesign/outputs/pencil/autodesign-prototype.pen`
- Live-check evidence hash: `24e005792756e5c17c48c6a29d71acb20af56890130b5a2c71756dde0229dcb0`

| Screen | Pencil frame | Wireframe export sha256 | Prototype export sha256 |
| --- | --- | --- | --- |
| `screen.start` | `ewVcf` | `30dd22e30ba58099a6c302bf495c066adc4058ba7b1cd595539cba94f3852d80` | `30dd22e30ba58099a6c302bf495c066adc4058ba7b1cd595539cba94f3852d80` |
| `screen.workspace` | `vZbTc` | `2228c3a9200e8be98faeee8e2b9a63e59b53adc61089302cbf23af9c41584b15` | `2228c3a9200e8be98faeee8e2b9a63e59b53adc61089302cbf23af9c41584b15` |
| `screen.settings` | `l4XU2g` | `8721c033c8eb5b19f02ffafaec0fd357a307781e99502f0ab38cc05db17ea473` | `8721c033c8eb5b19f02ffafaec0fd357a307781e99502f0ab38cc05db17ea473` |

- QA status: `pass`
- QA checks: `qa.selected-references`, `qa.wireframe-pencil-evidence`, `qa.prototype-pencil-evidence`, `qa.wireframe-screen-coverage`, `qa.prototype-screen-coverage`, `qa.design-token-bindings`, `qa.component-contracts`, `qa.canvas-export-records` all passed.
- `validate-state`: valid, 0 errors, 0 warnings.
- `check-dependencies`: valid.
- `can-run-subskill handoff`: true.
- `can-run-subskill reconcile`: true.
- Handoff source artifacts: 23.
- Reconcile changed artifact: `canonical.requirements`.
- Reconcile dirty artifacts: 27.
- Reconcile alerts: 28.

## Spotify Mobile Onboarding To Playlist Creation

- Coverage: consumer mobile onboarding and core action.
- Workspace: `/private/tmp/autodesign-golden-spotify-oxTvbU`
- Source context:
  - `https://support.spotify.com/us/article/getting-started/`
  - `https://support.spotify.com/us/article/create-playlists/`
- Generated image source: `/Users/koohyomin/.codex/generated_images/019e9d28-a33c-7172-9778-b7185f0b1da9/ig_0e061ca30d501f7e016a24f6563bd48191b612741f30e70b9a.png`
- Workspace visual reference: `autodesign/outputs/visual-references/generated/visual.prompt.001.png`
- Image bytes: `1351942`
- Image sha256: `b86dbe836d89583c56829bf2646291bde0ad0fc7c01e23423009b28574664fc1`
- Selected reference id: `visual.candidate.0338c76d75402d46`
- Pencil target: `autodesign/outputs/pencil/autodesign-prototype.pen`
- Live-check evidence hash: `dc49cd5a2bfff07f5eda45e452edc1bee21dc6c432126c3256148ec2028dd4cb`

| Screen | Pencil frame | Wireframe export sha256 | Prototype export sha256 |
| --- | --- | --- | --- |
| `screen.start` | `x3o5lj` | `f0901c17c4d7cfa16347010d1a96508972cefd82d76c71934c49ddc52c6efcf1` | `f0901c17c4d7cfa16347010d1a96508972cefd82d76c71934c49ddc52c6efcf1` |
| `screen.workspace` | `xFwCV` | `33c76530f40e6c5490a2734ff5f84d9a973c7c3a206984d7e606e5a205bdb27b` | `33c76530f40e6c5490a2734ff5f84d9a973c7c3a206984d7e606e5a205bdb27b` |
| `screen.settings` | `igH17` | `625865e666773d7a36a515114d5c0d2589b7ced542bb34c3260ccb6d7b144717` | `625865e666773d7a36a515114d5c0d2589b7ced542bb34c3260ccb6d7b144717` |

- QA status: `pass`
- QA checks: `qa.selected-references`, `qa.wireframe-pencil-evidence`, `qa.prototype-pencil-evidence`, `qa.wireframe-screen-coverage`, `qa.prototype-screen-coverage`, `qa.design-token-bindings`, `qa.component-contracts`, `qa.canvas-export-records` all passed.
- `validate-state`: valid, 0 errors, 0 warnings.
- `check-dependencies`: valid.
- `can-run-subskill handoff`: true.
- `can-run-subskill reconcile`: true.
- Handoff source artifacts: 23.
- Reconcile changed artifact: `canonical.requirements`.
- Reconcile dirty artifacts: 27.
- Reconcile alerts: 28.

## ChatGPT Projects Plus Canvas Workflow

- Coverage: AI/chat and creator workflow.
- Workspace: `/private/tmp/autodesign-golden-chatgpt-Wi7SOu`
- Source context:
  - `https://help.openai.com/en/articles/10169521-using-projects-in-chatgpt`
  - `https://help.openai.com/en/articles/9930697-using-canvas-in-chatgpt`
- Generated image source: `/Users/koohyomin/.codex/generated_images/019e9d28-a33c-7172-9778-b7185f0b1da9/ig_0e061ca30d501f7e016a24f697b428819189d74023d4b0429e.png`
- Workspace visual reference: `autodesign/outputs/visual-references/generated/visual.prompt.001.png`
- Image bytes: `1339404`
- Image sha256: `78ae4b14b30db58a00013c702201f0ff3dffcea5db9263f81a50ea60fd1380ab`
- Selected reference id: `visual.candidate.0338c76d75402d46`
- Pencil target: `autodesign/outputs/pencil/autodesign-prototype.pen`
- Live-check evidence hash: `50b484712d96871e3d4c722d2f5823c854bf625de95869b464b03d0b8824e843`
- Pencil note: `snapshot_layout` initially detected one clipped toolbar item in `screen.workspace`; the item widths and toolbar gap were corrected before final export and re-check returned no layout problems.

| Screen | Pencil frame | Wireframe export sha256 | Prototype export sha256 |
| --- | --- | --- | --- |
| `screen.start` | `mZ7lX` | `8bc4728f2d13be5b0f4890f9aa39843e9c2ba65e5320dd59a6f37e4bce7ae40d` | `8bc4728f2d13be5b0f4890f9aa39843e9c2ba65e5320dd59a6f37e4bce7ae40d` |
| `screen.workspace` | `S7nZJ` | `1acf1e0dc62433b5779ec88cdefe094f5bd08276631bdb6f6e75391c973dc723` | `1acf1e0dc62433b5779ec88cdefe094f5bd08276631bdb6f6e75391c973dc723` |
| `screen.settings` | `qEyt8` | `30ed77fb7fd86dc5f853f017aea6238f66539f5a15b65f7f4a67071293692e41` | `30ed77fb7fd86dc5f853f017aea6238f66539f5a15b65f7f4a67071293692e41` |

- QA status: `pass`
- QA checks: `qa.selected-references`, `qa.wireframe-pencil-evidence`, `qa.prototype-pencil-evidence`, `qa.wireframe-screen-coverage`, `qa.prototype-screen-coverage`, `qa.design-token-bindings`, `qa.component-contracts`, `qa.canvas-export-records` all passed.
- `validate-state`: valid, 0 errors, 0 warnings.
- `check-dependencies`: valid.
- `can-run-subskill handoff`: true.
- `can-run-subskill reconcile`: true.
- Handoff source artifacts: 23.
- Reconcile changed artifact: `canonical.requirements`.
- Reconcile dirty artifacts: 27.
- Reconcile alerts: 28.

## INFO Follow-Ups

- Reconcile emits 28 advisory alerts per case when `canonical.requirements` changes. This is expected Stage 09 behavior and was not modified in Stage 10.
- The deterministic visual candidate id is currently identical across the three runs (`visual.candidate.0338c76d75402d46`) even though the selected image hashes differ. This is an INFO-level traceability improvement candidate for a later hardening stage, not a Stage 10 blocker because the candidate records include the per-run generated output path and image hash.
