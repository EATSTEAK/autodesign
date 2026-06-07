#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const hookMetadata = {
  schemaVersion: 1,
  stage: "09-handoff-and-hooks",
  hook: "autodesign-boundary-advisory",
  behavior: "observational",
  capabilities: [
    "overwrite-warnings",
    "reconcile-alerts"
  ],
  mutatesFiles: false
};

export async function handleAutodesignHook(options = {}) {
  const workspaceRoot = path.resolve(options.workspace || process.env.AUTODESIGN_WORKSPACE || process.cwd());
  const manifest = await readJsonIfPresent(path.join(workspaceRoot, "autodesign/manifest.json"));
  const graph = await readJsonIfPresent(path.join(workspaceRoot, "autodesign/artifact-graph.json"));
  const paths = uniqueStrings([
    ...arrayOfStrings(options.paths),
    ...splitCsv(process.env.AUTODESIGN_HOOK_PATHS || "")
  ]);
  const changedArtifacts = uniqueStrings([
    ...arrayOfStrings(options.changedArtifacts),
    ...splitCsv(process.env.AUTODESIGN_CHANGED_ARTIFACTS || "")
  ]);

  return {
    ...hookMetadata,
    workspaceRoot,
    event: options.event || process.env.AUTODESIGN_HOOK_EVENT || "boundary",
    overwriteWarnings: buildOverwriteWarnings(workspaceRoot, graph.value, paths),
    reconcileAlerts: await buildReconcileAlerts(workspaceRoot, graph.value, changedArtifacts),
    manifestStage: manifest.value?.stage || null
  };
}

function buildOverwriteWarnings(workspaceRoot, graph, paths) {
  const artifacts = Array.isArray(graph?.artifacts) ? graph.artifacts : [];
  const warnings = [];

  for (const targetPath of paths) {
    const normalizedPath = normalizePathForWorkspace(targetPath, workspaceRoot);
    for (const artifact of artifacts) {
      const artifactPath = normalizeRelativePath(artifact.path);
      const touchesArtifact = normalizedPath === artifactPath || normalizedPath.startsWith(`${artifactPath}/`);
      if (!touchesArtifact) {
        continue;
      }
      const policy = artifact.reconcile?.policy || "preserve";
      if (artifact.sourceOfTruth === true || policy === "preserve") {
        warnings.push({
          path: normalizedPath,
          artifactId: artifact.id,
          severity: artifact.sourceOfTruth === true ? "source-of-truth" : "preserve-policy",
          policy,
          preserve: arrayOfStrings(artifact.reconcile?.preserve),
          mayChange: arrayOfStrings(artifact.reconcile?.mayChange),
          message: "Review before overwriting this Autodesign artifact path."
        });
      }
    }
  }

  return warnings.sort(compareObjectsByKeys(["path", "artifactId"]));
}

async function buildReconcileAlerts(workspaceRoot, graph, changedArtifacts) {
  const reportPath = path.join(workspaceRoot, "autodesign/logs/reconcile-report.json");
  const report = await readJsonIfPresent(reportPath);
  if (report.value && Array.isArray(report.value.alerts)) {
    return report.value.alerts.map((alert) => ({
      source: "log.reconcile-report",
      ...alert
    }));
  }

  if (changedArtifacts.length === 0 || !Array.isArray(graph?.artifacts)) {
    return [];
  }

  const dirty = computeDirtyArtifacts(graph, changedArtifacts);
  return dirty.dirtyArtifacts.map((artifact) => ({
    source: "computed",
    id: `reconcile.${artifact.id}`,
    severity: artifact.reconcile.policy === "preserve" ? "review-required" : "advisory",
    artifactId: artifact.id,
    path: artifact.path,
    dirtyUpstreams: artifact.dirtyUpstreams,
    policy: artifact.reconcile.policy,
    preserve: artifact.reconcile.preserve,
    mayChange: artifact.reconcile.mayChange,
    message: artifact.reconcile.policy === "preserve"
      ? "Dirty propagation reached a preserve-policy artifact."
      : "Dirty propagation reached a may-change artifact."
  })).sort(compareObjectsByKeys(["artifactId", "id"]));
}

function computeDirtyArtifacts(graph, changedArtifactIds) {
  const byId = new Map((Array.isArray(graph.artifacts) ? graph.artifacts : []).map((artifact) => [artifact.id, artifact]));
  const changed = uniqueStrings(changedArtifactIds);
  const changedSet = new Set(changed);
  const downstream = new Map();

  for (const artifact of byId.values()) {
    downstream.set(artifact.id, []);
  }
  for (const artifact of byId.values()) {
    for (const upstreamId of Array.isArray(artifact.upstreamDependencies) ? artifact.upstreamDependencies : []) {
      if (!downstream.has(upstreamId)) {
        downstream.set(upstreamId, []);
      }
      downstream.get(upstreamId).push(artifact.id);
    }
  }
  for (const list of downstream.values()) {
    list.sort();
  }

  const dirty = new Map();
  const queue = [...changed];
  for (let index = 0; index < queue.length; index += 1) {
    const currentId = queue[index];
    for (const dependentId of downstream.get(currentId) || []) {
      if (changedSet.has(dependentId)) {
        continue;
      }
      const artifact = byId.get(dependentId);
      if (!artifact) {
        continue;
      }
      const entry = dirty.get(dependentId) || {
        id: dependentId,
        kind: artifact.kind,
        path: artifact.path,
        dirtyUpstreams: new Set(),
        reconcile: normalizeReconcile(artifact.reconcile)
      };
      entry.dirtyUpstreams.add(currentId);
      dirty.set(dependentId, entry);
      if (!queue.includes(dependentId)) {
        queue.push(dependentId);
      }
    }
  }

  return {
    dirtyArtifacts: [...dirty.values()].map((entry) => ({
      ...entry,
      dirtyUpstreams: [...entry.dirtyUpstreams].sort()
    })).sort(compareObjectsByKeys(["id"]))
  };
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

function normalizeReconcile(reconcile) {
  return {
    policy: reconcile?.policy || "preserve",
    preserve: arrayOfStrings(reconcile?.preserve),
    mayChange: arrayOfStrings(reconcile?.mayChange),
    notes: typeof reconcile?.notes === "string" ? reconcile.notes : ""
  };
}

function normalizePathForWorkspace(value, workspaceRoot) {
  const raw = String(value || "");
  if (raw.length === 0) {
    return "";
  }
  const absoluteWorkspace = path.resolve(workspaceRoot);
  const absoluteTarget = path.isAbsolute(raw) ? path.resolve(raw) : null;
  const relative = absoluteTarget && isInside(absoluteTarget, absoluteWorkspace)
    ? path.relative(absoluteWorkspace, absoluteTarget)
    : raw;
  return relative.split(path.sep).join("/");
}

function normalizeRelativePath(value) {
  return String(value || "").split(path.sep).join("/");
}

function isInside(targetPath, rootPath) {
  const relative = path.relative(rootPath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function splitCsv(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.length > 0) : [];
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))].sort();
}

function compareObjectsByKeys(keys) {
  return (left, right) => {
    for (const key of keys) {
      const comparison = String(left[key] || "").localeCompare(String(right[key] || ""));
      if (comparison !== 0) {
        return comparison;
      }
    }
    return 0;
  };
}

function parseArgs(argv) {
  const options = {
    workspace: null,
    event: null,
    paths: [],
    changedArtifacts: [],
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
    if (arg === "--path") {
      options.paths.push(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--changed") {
      options.changedArtifacts.push(...splitCsv(argv[index + 1]));
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
