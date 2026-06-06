#!/usr/bin/env node
import {
  checkSubskillCanRun,
  formatJson,
  formatSubskillRunCheck,
  loadState,
  parseCommonOptions,
  readArgValue
} from "./lib/autodesign-state.mjs";

const USAGE = `Usage:
  node autodesign-start/assets/payload/scripts/can-run-subskill.mjs --workspace <workspace> --subskill <name>

Options:
  --workspace <workspace>  Workspace root containing autodesign/manifest.json.
  --manifest <path>        Optional manifest path, relative to workspace unless absolute.
  --graph <path>           Optional graph path, relative to workspace unless absolute.
  --subskill <name>        Subskill name, such as interview or autodesign-interview.
  --json                   Print machine-readable JSON.
  --help                   Print this help text.
`;

function parseOptions(argv) {
  const common = parseCommonOptions(argv);
  const options = {
    ...common,
    subskill: null,
    rest: []
  };

  for (let index = 0; index < common.rest.length; index += 1) {
    const arg = common.rest[index];
    if (arg === "--subskill") {
      options.subskill = readArgValue(common.rest, index, "--subskill");
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

  if (!options.subskill) {
    throw new Error("--subskill is required.");
  }

  const state = await loadState(options);
  const result = await checkSubskillCanRun(state, options.subskill);
  process.stdout.write(options.json ? formatJson(result) : formatSubskillRunCheck(result));

  if (!result.canRun) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`autodesign can-run-subskill error: ${error.message}\n`);
  process.exitCode = 1;
});
