#!/usr/bin/env node
import {
  formatJson,
  formatValidationResult,
  loadState,
  parseCommonOptions,
  validateState
} from "./lib/autodesign-state.mjs";

const USAGE = `Usage:
  node autodesign-start/assets/payload/scripts/validate-state.mjs --workspace <workspace>

Options:
  --workspace <workspace>  Workspace root containing autodesign/manifest.json.
  --manifest <path>        Optional manifest path, relative to workspace unless absolute.
  --graph <path>           Optional graph path, relative to workspace unless absolute.
  --json                   Print machine-readable JSON.
  --help                   Print this help text.
`;

async function main() {
  const options = parseCommonOptions(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(USAGE);
    return;
  }

  if (options.rest.length > 0) {
    throw new Error(`Unknown argument: ${options.rest[0]}`);
  }

  const state = await loadState(options);
  const result = validateState(state);
  process.stdout.write(options.json ? formatJson(result) : formatValidationResult(result));

  if (!result.valid) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`autodesign validate-state error: ${error.message}\n`);
  process.exitCode = 1;
});
