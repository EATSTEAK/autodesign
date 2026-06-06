#!/usr/bin/env node
import {
  STAGE,
  applyGateRecord,
  buildGateRecord,
  formatJson,
  formatRecordPlan,
  loadState,
  parseCommonOptions,
  readArgValue,
  validateState,
  writeJsonFile
} from "./lib/autodesign-state.mjs";

const USAGE = `Usage:
  node autodesign-start/assets/payload/scripts/record-gate.mjs --workspace <workspace> --gate <gate-id> --status <status> --actor <actor> --at <timestamp>
  node autodesign-start/assets/payload/scripts/record-gate.mjs --workspace <workspace> --gate <gate-id> --status <status> --actor <actor> --at <timestamp> --approve-record

Options:
  --workspace <workspace>  Workspace root containing autodesign/manifest.json.
  --manifest <path>        Optional manifest path, relative to workspace unless absolute.
  --graph <path>           Optional graph path, relative to workspace unless absolute.
  --gate <gate-id>         Existing approval gate id to update.
  --status <status>        pending, approved, rejected, blocked, or not-implemented.
  --actor <actor>          Explicit actor recorded in manifest.
  --at <timestamp>         Explicit ISO-like timestamp; no implicit current time is used.
  --note <text>            Optional note for the approval record.
  --approve-record         Write the manifest update. Without this flag, only prints the plan.
  --json                   Print machine-readable JSON.
  --help                   Print this help text.
`;

function parseOptions(argv) {
  const common = parseCommonOptions(argv);
  const options = {
    ...common,
    gateId: null,
    status: null,
    actor: null,
    at: null,
    note: "",
    approveRecord: false,
    rest: []
  };

  for (let index = 0; index < common.rest.length; index += 1) {
    const arg = common.rest[index];

    if (arg === "--gate") {
      options.gateId = readArgValue(common.rest, index, "--gate");
      index += 1;
      continue;
    }

    if (arg === "--status") {
      options.status = readArgValue(common.rest, index, "--status");
      index += 1;
      continue;
    }

    if (arg === "--actor") {
      options.actor = readArgValue(common.rest, index, "--actor");
      index += 1;
      continue;
    }

    if (arg === "--at") {
      options.at = readArgValue(common.rest, index, "--at");
      index += 1;
      continue;
    }

    if (arg === "--note") {
      options.note = readArgValue(common.rest, index, "--note");
      index += 1;
      continue;
    }

    if (arg === "--approve-record") {
      options.approveRecord = true;
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
    process.stdout.write(options.json ? formatJson(validation) : `State validation failed before gate recording.\n${validation.errors.map((error) => `  ${error.path}: ${error.message}`).join("\n")}\n`);
    process.exitCode = 1;
    return;
  }

  const record = buildGateRecord(state.manifest, options);
  const nextManifest = applyGateRecord(state.manifest, record);
  const nextValidation = validateState({
    ...state,
    manifest: nextManifest
  });

  if (!nextValidation.valid) {
    process.stdout.write(options.json ? formatJson(nextValidation) : `Gate record would make manifest invalid.\n${nextValidation.errors.map((error) => `  ${error.path}: ${error.message}`).join("\n")}\n`);
    process.exitCode = 1;
    return;
  }

  const plan = {
    schemaVersion: 1,
    stage: STAGE,
    manifestPath: state.manifestPath,
    writesFiles: options.approveRecord,
    record
  };

  if (!options.approveRecord) {
    process.stdout.write(options.json ? formatJson(plan) : formatRecordPlan(plan));
    return;
  }

  await writeJsonFile(state.manifestPath, nextManifest);
  process.stdout.write(options.json ? formatJson(plan) : formatRecordPlan(plan));
}

main().catch((error) => {
  process.stderr.write(`autodesign record-gate error: ${error.message}\n`);
  process.exitCode = 1;
});
