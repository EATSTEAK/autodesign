#!/usr/bin/env node
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STAGE = "03-bootstrap-runtime";

const USAGE = `Usage:
  node autodesign-start/assets/payload/scripts/bootstrap.mjs --target <workspace> --plan
  node autodesign-start/assets/payload/scripts/bootstrap.mjs --target <workspace> --apply --approve-bootstrap
  node autodesign-start/assets/payload/scripts/bootstrap.mjs --target <workspace> --apply --approve-bootstrap --approve-overwrite

Options:
  --target <workspace>     Target project workspace to materialize into.
  --plan                   Print create/overwrite/preserve actions without writing. This is the default mode.
  --apply                  Write planned create actions, and overwrite actions only with --approve-overwrite.
  --approve-bootstrap      Required with --apply before any file writes are allowed.
  --approve-overwrite      Required with --apply when the plan contains overwrite actions.
  --json                   Print machine-readable JSON.
  --help                   Print this help text.
`;

function parseArgs(argv) {
  const args = {
    target: null,
    mode: "plan",
    modeWasSet: false,
    approveBootstrap: false,
    approveOverwrite: false,
    json: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--target") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--target requires a workspace path.");
      }
      args.target = value;
      index += 1;
      continue;
    }

    if (arg === "--plan" || arg === "--apply") {
      const mode = arg.slice(2);
      if (args.modeWasSet && args.mode !== mode) {
        throw new Error("Use only one of --plan or --apply.");
      }
      args.mode = mode;
      args.modeWasSet = true;
      continue;
    }

    if (arg === "--approve-bootstrap") {
      args.approveBootstrap = true;
      continue;
    }

    if (arg === "--approve-overwrite") {
      args.approveOverwrite = true;
      continue;
    }

    if (arg === "--json") {
      args.json = true;
      continue;
    }

    if (arg === "--help") {
      args.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

async function listTemplateFiles(templateRoot) {
  const results = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (entry.isFile()) {
        results.push(path.relative(templateRoot, absolutePath));
      }
    }
  }

  await walk(templateRoot);
  return results.sort();
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function classifyTarget(destPath, sourceBytes) {
  try {
    const existingBytes = await fs.readFile(destPath);
    if (Buffer.compare(existingBytes, sourceBytes) === 0) {
      return "preserve";
    }
    return "overwrite";
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return "create";
    }
    throw error;
  }
}

async function buildPlan(templateRoot, targetRoot) {
  const relPaths = await listTemplateFiles(templateRoot);
  const actions = [];

  for (const relPath of relPaths) {
    const sourcePath = path.join(templateRoot, relPath);
    const targetPath = path.join(targetRoot, relPath);
    const sourceBytes = await fs.readFile(sourcePath);
    const action = await classifyTarget(targetPath, sourceBytes);

    actions.push({
      action,
      path: relPath.split(path.sep).join("/"),
      bytes: sourceBytes.length,
      sha256: sha256(sourceBytes)
    });
  }

  const counts = { create: 0, overwrite: 0, preserve: 0 };
  for (const action of actions) {
    counts[action.action] += 1;
  }

  return {
    schemaVersion: 1,
    stage: STAGE,
    targetRoot,
    templateRoot,
    counts,
    approvalGates: {
      applyRequires: ["--approve-bootstrap"],
      overwriteRequires: counts.overwrite > 0 ? ["--approve-overwrite"] : []
    },
    actions
  };
}

function formatPlan(plan) {
  const lines = [
    "Autodesign bootstrap plan",
    `stage: ${plan.stage}`,
    `target: ${plan.targetRoot}`,
    `template: ${plan.templateRoot}`,
    `create: ${plan.counts.create}`,
    `overwrite: ${plan.counts.overwrite}`,
    `preserve: ${plan.counts.preserve}`,
    "approval gates:",
    "  apply: --approve-bootstrap",
    `  overwrite: ${plan.counts.overwrite > 0 ? "--approve-overwrite" : "not required"}`,
    "actions:"
  ];

  for (const action of plan.actions) {
    lines.push(`  ${action.action} ${action.path} (${action.bytes} bytes, sha256 ${action.sha256})`);
  }

  return `${lines.join("\n")}\n`;
}

async function applyPlan(plan, templateRoot, targetRoot) {
  const written = [];

  for (const action of plan.actions) {
    if (action.action === "preserve") {
      continue;
    }

    const relPath = action.path.split("/").join(path.sep);
    const sourcePath = path.join(templateRoot, relPath);
    const targetPath = path.join(targetRoot, relPath);

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
    written.push(action.path);
  }

  return {
    schemaVersion: 1,
    stage: STAGE,
    targetRoot,
    written
  };
}

function formatApplyResult(result) {
  const lines = [
    "Autodesign bootstrap apply complete",
    `stage: ${result.stage}`,
    `target: ${result.targetRoot}`,
    `written: ${result.written.length}`
  ];

  for (const relPath of result.written) {
    lines.push(`  ${relPath}`);
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(USAGE);
    return;
  }

  if (!args.target) {
    throw new Error("--target is required.");
  }

  const scriptPath = fileURLToPath(import.meta.url);
  const scriptDir = path.dirname(scriptPath);
  const payloadRoot = path.resolve(scriptDir, "..");
  const templateRoot = path.join(payloadRoot, "workspace-template");
  const targetRoot = path.resolve(args.target);
  const plan = await buildPlan(templateRoot, targetRoot);

  if (args.mode === "plan") {
    process.stdout.write(args.json ? `${JSON.stringify(plan, null, 2)}\n` : formatPlan(plan));
    return;
  }

  if (!args.approveBootstrap) {
    process.stdout.write(args.json ? `${JSON.stringify(plan, null, 2)}\n` : formatPlan(plan));
    throw new Error("Refusing to apply without --approve-bootstrap.");
  }

  if (plan.counts.overwrite > 0 && !args.approveOverwrite) {
    process.stdout.write(args.json ? `${JSON.stringify(plan, null, 2)}\n` : formatPlan(plan));
    throw new Error("Refusing to overwrite existing files without --approve-overwrite.");
  }

  const result = await applyPlan(plan, templateRoot, targetRoot);
  process.stdout.write(args.json ? `${JSON.stringify({ plan, result }, null, 2)}\n` : formatApplyResult(result));
}

main().catch((error) => {
  process.stderr.write(`autodesign bootstrap error: ${error.message}\n`);
  process.exitCode = 1;
});
