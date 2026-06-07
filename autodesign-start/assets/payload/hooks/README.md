# Payload Hooks

Stage 09 includes read-only advisory hook adapters.

- `autodesign-status-advisory.mjs` reads `autodesign/manifest.json` and `autodesign/artifact-graph.json` to emit status injection, lightweight schema validation, and turn-summary JSON.
- `autodesign-boundary-advisory.mjs` reads manifest, graph, and optional reconcile reports to emit overwrite warnings and reconcile alerts.

The hooks do not generate artifacts, call image generation, call Pencil MCP, mutate design files, update manifest/graph state, or produce frontend code. They print JSON only when run with `--json` or `AUTODESIGN_HOOK_DEBUG=1`.
