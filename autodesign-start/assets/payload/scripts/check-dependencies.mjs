#!/usr/bin/env node
import {
  checkDependencies,
  formatDependencyResult,
  formatJson,
  loadState,
  parseCommonOptions,
  readArgValue,
  validateState
} from "./lib/autodesign-state.mjs";

const USAGE = `Usage:
  node autodesign-start/assets/payload/scripts/check-dependencies.mjs --workspace <workspace>
  node autodesign-start/assets/payload/scripts/check-dependencies.mjs --workspace <workspace> --artifact <artifact-id>

Options:
  --workspace <workspace>  Workspace root containing autodesign/manifest.json.
  --manifest <path>        Optional manifest path, relative to workspace unless absolute.
  --graph <path>           Optional graph path, relative to workspace unless absolute.
  --artifact <artifact-id> Optional artifact id for upstream/downstream closure.
  --json                   Print machine-readable JSON.
  --help                   Print this help text.
`;

function parseOptions(argv) {
  const common = parseCommonOptions(argv);
  const options = {
    ...common,
    artifactId: null,
    rest: []
  };

  for (let index = 0; index < common.rest.length; index += 1) {
    const arg = common.rest[index];
    if (arg === "--artifact") {
      options.artifactId = readArgValue(common.rest, index, "--artifact");
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
    process.stdout.write(options.json ? formatJson(validation) : `State validation failed before dependency check.\n${validation.errors.map((error) => `  ${error.path}: ${error.message}`).join("\n")}\n`);
    process.exitCode = 1;
    return;
  }

  const result = checkDependencies(state.graph, options.artifactId);
  process.stdout.write(options.json ? formatJson(result) : formatDependencyResult(result));

  if (!result.valid) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`autodesign check-dependencies error: ${error.message}\n`);
  process.exitCode = 1;
});
