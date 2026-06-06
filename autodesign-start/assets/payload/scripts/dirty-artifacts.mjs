#!/usr/bin/env node
import {
  computeDirtyArtifacts,
  formatDirtyResult,
  formatJson,
  loadState,
  parseCommonOptions,
  readArgValue,
  validateState
} from "./lib/autodesign-state.mjs";

const USAGE = `Usage:
  node autodesign-start/assets/payload/scripts/dirty-artifacts.mjs --workspace <workspace> --changed <artifact-id>

Options:
  --workspace <workspace>  Workspace root containing autodesign/manifest.json.
  --manifest <path>        Optional manifest path, relative to workspace unless absolute.
  --graph <path>           Optional graph path, relative to workspace unless absolute.
  --changed <artifact-id>  Changed upstream artifact id. May be repeated or comma-separated.
  --json                   Print machine-readable JSON.
  --help                   Print this help text.
`;

function parseOptions(argv) {
  const common = parseCommonOptions(argv);
  const options = {
    ...common,
    changedArtifactIds: [],
    rest: []
  };

  for (let index = 0; index < common.rest.length; index += 1) {
    const arg = common.rest[index];
    if (arg === "--changed") {
      const value = readArgValue(common.rest, index, "--changed");
      options.changedArtifactIds.push(...value.split(",").map((item) => item.trim()).filter(Boolean));
      index += 1;
      continue;
    }
    options.rest.push(arg);
  }

  return options;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(USAGE);
    return;
  }

  if (options.rest.length > 0) {
    throw new Error(`Unknown argument: ${options.rest[0]}`);
  }

  const state = await loadState(options);
  const validation = validateState(state);
  if (!validation.valid) {
    process.stdout.write(options.json ? formatJson(validation) : `State validation failed before dirty artifact computation.\n${validation.errors.map((error) => `  ${error.path}: ${error.message}`).join("\n")}\n`);
    process.exitCode = 1;
    return;
  }

  const result = computeDirtyArtifacts(state.graph, options.changedArtifactIds);
  process.stdout.write(options.json ? formatJson(result) : formatDirtyResult(result));
}

main().catch((error) => {
  process.stderr.write(`autodesign dirty-artifacts error: ${error.message}\n`);
  process.exitCode = 1;
});
