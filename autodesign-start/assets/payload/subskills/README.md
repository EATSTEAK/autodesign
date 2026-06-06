# Payload Subskills

Stage 05 includes concrete private contract subskills.

These subskills are not public install-time skills. `autodesign-start` remains the only public router.

Each direct contract documents:

- required upstream artifacts
- declared output artifacts
- hard gates
- fail-fast behavior

Before entering any private contract, run:

```bash
node autodesign-start/assets/payload/scripts/can-run-subskill.mjs --workspace /absolute/path/to/project --subskill <name>
```

The readiness check validates manifest state, graph dependencies, required upstream artifact paths, declared output artifact ids, and disabled behavior guards.

No contract implements canonical generation, image generation, Pencil operations, visual reference generation, design-system work, prototype generation, handoff, report generation, skill optimization, or real phase behavior.
