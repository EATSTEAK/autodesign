#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const hookMetadata = {
  schemaVersion: 1,
  stage: "09-handoff-and-hooks",
  hook: "autodesign-status-advisory",
  behavior: "observational",
  capabilities: [
    "status-injection",
    "schema-validation",
    "turn-summary"
  ],
  mutatesFiles: false
};

export async function handleAutodesignHook(options = {}) {
  const workspaceRoot = path.resolve(options.workspace || process.env.AUTODESIGN_WORKSPACE || process.cwd());
  const manifestPath = path.join(workspaceRoot, "autodesign/manifest.json");
  const graphPath = path.join(workspaceRoot, "autodesign/artifact-graph.json");
  const manifest = await readJsonIfPresent(manifestPath);
  const graph = await readJsonIfPresent(graphPath);
  const validation = validateStateShape(manifest.value, graph.value);

  return {
    ...hookMetadata,
    workspaceRoot,
    event: options.event || process.env.AUTODESIGN_HOOK_EVENT || "status",
    status: buildStatus(manifest.value, graph.value),
    validation: {
      manifestPath,
      graphPath,
      manifestReadable: manifest.readable,
      graphReadable: graph.readable,
      valid: validation.errors.length === 0,
      errors: validation.errors,
      warnings: validation.warnings
    },
    turnSummary: buildTurnSummary(manifest.value)
  };
}

function buildStatus(manifest, graph) {
  const gates = Array.isArray(manifest?.approvalGates) ? manifest.approvalGates : [];
  const records = Array.isArray(manifest?.generationRecords) ? manifest.generationRecords : [];
  const artifacts = Array.isArray(graph?.artifacts) ? graph.artifacts : [];

  return {
    stage: manifest?.stage || graph?.stage || null,
    disabledBehaviors: manifest?.disabledBehaviors || {},
    approvalGateCounts: countBy(gates.map((gate) => gate.status || "unknown")),
    generatedArtifactCount: artifacts.filter((artifact) => artifact.generated === true).length,
    artifactCount: artifacts.length,
    generationRecordCount: records.length
  };
}

function buildTurnSummary(manifest) {
  const gates = Array.isArray(manifest?.approvalGates) ? manifest.approvalGates : [];
  const records = Array.isArray(manifest?.generationRecords) ? manifest.generationRecords : [];
  return {
    pendingGates: gates
      .filter((gate) => gate.status === "pending")
      .map((gate) => gate.id)
      .sort(),
    latestGenerationRecords: records
      .slice()
      .sort((left, right) => String(right.at || "").localeCompare(String(left.at || "")) || String(right.id || "").localeCompare(String(left.id || "")))
      .slice(0, 5)
      .map((record) => ({
        id: record.id,
        at: record.at,
        script: record.script,
        artifacts: Array.isArray(record.artifacts) ? record.artifacts : []
      }))
  };
}

function validateStateShape(manifest, graph) {
  const errors = [];
  const warnings = [];

  if (!manifest || typeof manifest !== "object") {
    errors.push({ path: "autodesign/manifest.json", message: "manifest JSON is missing or unreadable" });
  }
  if (!graph || typeof graph !== "object") {
    errors.push({ path: "autodesign/artifact-graph.json", message: "artifact graph JSON is missing or unreadable" });
  }
  if (errors.length > 0) {
    return { errors, warnings };
  }

  if (manifest.schemaVersion !== 1) {
    errors.push({ path: "manifest.schemaVersion", message: "schemaVersion must be 1" });
  }
  if (graph.schemaVersion !== 1) {
    errors.push({ path: "graph.schemaVersion", message: "schemaVersion must be 1" });
  }
  if (manifest.stage !== graph.stage) {
    warnings.push({ path: "stage", message: "manifest and graph stages differ" });
  }
  if (manifest.disabledBehaviors?.handoff !== false) {
    warnings.push({ path: "manifest.disabledBehaviors.handoff", message: "Stage 09 handoff is not enabled" });
  }
  if (!Array.isArray(manifest.approvalGates)) {
    errors.push({ path: "manifest.approvalGates", message: "approvalGates must be an array" });
  }
  if (!Array.isArray(manifest.generationRecords)) {
    errors.push({ path: "manifest.generationRecords", message: "generationRecords must be an array" });
  }
  if (!Array.isArray(graph.artifacts)) {
    errors.push({ path: "graph.artifacts", message: "artifacts must be an array" });
    return { errors, warnings };
  }

  const artifactIds = new Set(graph.artifacts.map((artifact) => artifact.id));
  for (const artifact of graph.artifacts) {
    for (const upstreamId of Array.isArray(artifact.upstreamDependencies) ? artifact.upstreamDependencies : []) {
      if (!artifactIds.has(upstreamId)) {
        errors.push({ path: artifact.id, message: `missing upstream dependency ${upstreamId}` });
      }
    }
  }

  return { errors, warnings };
}

async function readJsonIfPresent(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return {
      readable: true,
      value: JSON.parse(text)
    };
  } catch (error) {
    return {
      readable: false,
      value: null,
      error: error.message
    };
  }
}

function countBy(values) {
  const counts = {};
  for (const value of values) {
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function parseArgs(argv) {
  const options = {
    workspace: null,
    event: null,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workspace") {
      options.workspace = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--event") {
      options.event = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
    }
  }

  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2));
  if (options.json || process.env.AUTODESIGN_HOOK_DEBUG === "1") {
    const result = await handleAutodesignHook(options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
}

export default handleAutodesignHook;
