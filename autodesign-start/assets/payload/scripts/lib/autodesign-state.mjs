import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export const STAGE = "05-subskill-contracts";
export const DEFAULT_MANIFEST_REL = "autodesign/manifest.json";
export const DEFAULT_GRAPH_REL = "autodesign/artifact-graph.json";

const ARTIFACT_ID_PATTERN = /^[a-z0-9][a-z0-9.-]*$/;
const ISO_LIKE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
const VALID_ARTIFACT_KINDS = new Set([
  "input",
  "canonical",
  "visual-reference",
  "pencil",
  "design-system",
  "prototype",
  "handoff",
  "log"
]);
const VALID_GATE_STATUSES = new Set([
  "pending",
  "approved",
  "rejected",
  "blocked",
  "not-implemented"
]);
const VALID_RECONCILE_POLICIES = new Set([
  "preserve",
  "may-change"
]);
const DISABLED_BEHAVIOR_KEYS = [
  "canonicalGeneration",
  "imageGeneration",
  "pencilOperations",
  "visualReferenceGeneration",
  "designSystemGeneration",
  "prototypeGeneration",
  "handoff",
  "realSubskillPhaseBehavior"
];
const REFERENCE_ONLY_KINDS = new Set([
  "visual-reference",
  "pencil",
  "design-system",
  "prototype",
  "handoff"
]);
const VALID_SUBSKILL_STATUSES = new Set([
  "contract-only"
]);
const VALID_SUBSKILL_HARD_GATES = new Set([
  "state.valid",
  "graph.dependencies.valid",
  "upstream-artifacts.exist",
  "output-artifacts.declared",
  "disabled-behaviors.enforced",
  "no-real-phase-behavior"
]);

export function resolveStatePaths(options = {}) {
  const workspaceRoot = path.resolve(options.workspace || process.cwd());
  const manifestPath = resolveAgainst(workspaceRoot, options.manifest || DEFAULT_MANIFEST_REL);
  const graphPath = resolveAgainst(workspaceRoot, options.graph || DEFAULT_GRAPH_REL);

  return {
    workspaceRoot,
    manifestPath,
    graphPath
  };
}

export async function loadState(options = {}) {
  const paths = resolveStatePaths(options);
  const manifest = await readJsonFile(paths.manifestPath);
  const graph = await readJsonFile(paths.graphPath);

  return {
    ...paths,
    manifest,
    graph
  };
}

export async function readJsonFile(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${filePath}: invalid JSON: ${error.message}`);
  }
}

export async function writeJsonFile(filePath, value) {
  await fs.writeFile(filePath, formatJson(value), "utf8");
}

export function validateState(state) {
  const result = {
    schemaVersion: 1,
    stage: STAGE,
    manifestPath: state.manifestPath,
    graphPath: state.graphPath,
    valid: false,
    counts: {
      approvalGates: 0,
      approvalRecords: 0,
      artifacts: 0,
      dependencies: 0
    },
    errors: [],
    warnings: []
  };

  validateManifest(state.manifest, state.graph, result);
  validateGraph(state.graph, result);
  validateManifestGraphLinks(state.manifest, state.graph, result);

  result.valid = result.errors.length === 0;
  return result;
}

export function checkDependencies(graph, artifactId = null) {
  const artifacts = Array.isArray(graph.artifacts) ? graph.artifacts : [];
  const byId = buildArtifactIndex(graph);
  const downstream = buildDownstreamIndex(graph);
  const missingDependencies = [];

  for (const artifact of artifacts) {
    const dependencies = Array.isArray(artifact.upstreamDependencies) ? artifact.upstreamDependencies : [];
    for (const upstreamId of dependencies) {
      if (!byId.has(upstreamId)) {
        missingDependencies.push({
          artifactId: artifact.id,
          missingUpstreamId: upstreamId
        });
      }
    }
  }

  missingDependencies.sort(compareObjectsByKeys(["artifactId", "missingUpstreamId"]));

  const cycles = findDependencyCycles(graph).map((cycle) => ({
    path: cycle
  }));

  const roots = artifacts
    .filter((artifact) => Array.isArray(artifact.upstreamDependencies) && artifact.upstreamDependencies.length === 0)
    .map((artifact) => artifact.id)
    .sort(compareArtifactIds(graph));

  const leaves = artifacts
    .filter((artifact) => (downstream.get(artifact.id) || []).length === 0)
    .map((artifact) => artifact.id)
    .sort(compareArtifactIds(graph));

  const result = {
    schemaVersion: 1,
    stage: STAGE,
    graphId: graph.graphId || null,
    artifactCount: artifacts.length,
    dependencyCount: artifacts.reduce((count, artifact) => {
      return count + (Array.isArray(artifact.upstreamDependencies) ? artifact.upstreamDependencies.length : 0);
    }, 0),
    missingDependencies,
    cycles,
    roots,
    leaves
  };

  if (artifactId) {
    if (!byId.has(artifactId)) {
      throw new Error(`Unknown artifact id: ${artifactId}`);
    }

    result.artifactId = artifactId;
    result.upstreamClosure = collectUpstreamClosure(graph, artifactId);
    result.downstreamClosure = collectDownstreamClosure(graph, artifactId);
  }

  result.valid = result.missingDependencies.length === 0 && result.cycles.length === 0;
  return result;
}

export async function checkSubskillCanRun(state, subskillName) {
  const normalizedName = normalizeSubskillName(subskillName);
  const validation = validateState(state);
  const dependencyResult = validation.valid ? checkDependencies(state.graph) : null;
  const contract = findSubskillContract(state.manifest, normalizedName);
  const result = {
    schemaVersion: 1,
    stage: STAGE,
    subskill: normalizedName,
    contractPath: contract ? contract.path : null,
    contractOnly: contract ? contract.contractOnly === true : null,
    implemented: contract ? contract.implemented === true : null,
    phaseBehaviorAllowed: false,
    canRun: false,
    checks: {
      stateValid: validation.valid,
      dependencyGraphValid: dependencyResult ? dependencyResult.valid : false,
      upstreamArtifactsExist: false,
      outputArtifactsDeclared: false,
      disabledBehaviorsEnforced: false,
      noRealPhaseBehavior: false
    },
    hardGates: [],
    upstreamArtifacts: [],
    outputArtifacts: [],
    outputFiles: [],
    disabledBehaviors: [],
    errors: [],
    warnings: [],
    failFast: contract && Array.isArray(contract.failFast) ? [...contract.failFast] : []
  };

  if (!validation.valid) {
    for (const error of validation.errors) {
      result.errors.push({
        check: "state.valid",
        path: error.path,
        message: error.message
      });
    }
  }

  if (dependencyResult && !dependencyResult.valid) {
    for (const missing of dependencyResult.missingDependencies) {
      result.errors.push({
        check: "graph.dependencies.valid",
        path: missing.artifactId,
        message: `missing upstream dependency ${missing.missingUpstreamId}`
      });
    }
    for (const cycle of dependencyResult.cycles) {
      result.errors.push({
        check: "graph.dependencies.valid",
        path: "graph.artifacts",
        message: `dependency cycle ${cycle.path.join(" -> ")}`
      });
    }
  }

  if (!contract) {
    result.errors.push({
      check: "subskill.contract",
      path: "manifest.subskillContracts",
      message: `unknown subskill ${normalizedName}`
    });
    return result;
  }

  const artifactIndex = buildArtifactIndex(state.graph);
  const upstreamArtifacts = Array.isArray(contract.requiredUpstreamArtifacts) ? contract.requiredUpstreamArtifacts : [];
  for (const artifactId of upstreamArtifacts) {
    const artifact = artifactIndex.get(artifactId);
    const entry = {
      id: artifactId,
      declared: Boolean(artifact),
      path: artifact ? artifact.path : null,
      exists: false
    };

    if (artifact) {
      entry.exists = await pathExists(resolveAgainst(state.workspaceRoot, artifact.path));
    }

    result.upstreamArtifacts.push(entry);

    if (!entry.declared) {
      result.errors.push({
        check: "upstream-artifacts.exist",
        path: artifactId,
        message: "required upstream artifact is not declared in artifact graph"
      });
      continue;
    }

    if (!entry.exists) {
      result.errors.push({
        check: "upstream-artifacts.exist",
        path: artifact.path,
        message: `required upstream artifact ${artifactId} is missing`
      });
    }
  }

  const outputArtifacts = Array.isArray(contract.outputArtifacts) ? contract.outputArtifacts : [];
  for (const artifactId of outputArtifacts) {
    const artifact = artifactIndex.get(artifactId);
    const entry = {
      id: artifactId,
      declared: Boolean(artifact),
      path: artifact ? artifact.path : null
    };
    result.outputArtifacts.push(entry);

    if (!entry.declared) {
      result.errors.push({
        check: "output-artifacts.declared",
        path: artifactId,
        message: "output artifact is not declared in artifact graph"
      });
    }
  }

  const outputFiles = Array.isArray(contract.outputFiles) ? contract.outputFiles : [];
  for (const outputFile of outputFiles) {
    result.outputFiles.push({
      path: outputFile
    });
  }

  const disabledBehaviors = Array.isArray(contract.disabledBehaviors) ? contract.disabledBehaviors : [];
  for (const key of disabledBehaviors) {
    const enforced = state.manifest.disabledBehaviors && state.manifest.disabledBehaviors[key] === true;
    result.disabledBehaviors.push({
      key,
      enforced
    });
    if (!enforced) {
      result.errors.push({
        check: "disabled-behaviors.enforced",
        path: `manifest.disabledBehaviors.${key}`,
        message: "required disabled behavior guard is not enabled"
      });
    }
  }

  const upstreamOk = result.upstreamArtifacts.every((artifact) => artifact.declared && artifact.exists);
  const outputOk = result.outputArtifacts.every((artifact) => artifact.declared);
  const disabledOk = result.disabledBehaviors.every((behavior) => behavior.enforced);
  const noRealPhaseBehavior = contract.contractOnly === true
    && contract.implemented === false
    && state.manifest.disabledBehaviors
    && state.manifest.disabledBehaviors.realSubskillPhaseBehavior === true;

  result.checks.upstreamArtifactsExist = upstreamOk;
  result.checks.outputArtifactsDeclared = outputOk;
  result.checks.disabledBehaviorsEnforced = disabledOk;
  result.checks.noRealPhaseBehavior = noRealPhaseBehavior;

  if (!noRealPhaseBehavior) {
    result.errors.push({
      check: "no-real-phase-behavior",
      path: "manifest.subskillContracts",
      message: "Stage 05 subskill contracts must remain contract-only with real behavior disabled"
    });
  }

  const hardGateStatus = {
    "state.valid": result.checks.stateValid,
    "graph.dependencies.valid": result.checks.dependencyGraphValid,
    "upstream-artifacts.exist": result.checks.upstreamArtifactsExist,
    "output-artifacts.declared": result.checks.outputArtifactsDeclared,
    "disabled-behaviors.enforced": result.checks.disabledBehaviorsEnforced,
    "no-real-phase-behavior": result.checks.noRealPhaseBehavior
  };

  for (const hardGate of Array.isArray(contract.hardGates) ? contract.hardGates : []) {
    if (!VALID_SUBSKILL_HARD_GATES.has(hardGate)) {
      result.errors.push({
        check: "hard-gates.declared",
        path: hardGate,
        message: "unknown hard gate"
      });
      result.hardGates.push({
        id: hardGate,
        passed: false
      });
      continue;
    }

    result.hardGates.push({
      id: hardGate,
      passed: hardGateStatus[hardGate] === true
    });
  }

  result.canRun = result.errors.length === 0;

  if (result.canRun && contract.contractOnly === true) {
    result.warnings.push({
      check: "contract-only",
      path: contract.path,
      message: "Contract boundary can be entered, but real subskill behavior must not run in Stage 05."
    });
  }

  return result;
}

export function computeDirtyArtifacts(graph, changedArtifactIds) {
  const artifacts = Array.isArray(graph.artifacts) ? graph.artifacts : [];
  const byId = buildArtifactIndex(graph);
  const order = topologicalArtifactIds(graph);
  const compareIds = compareArtifactIds(graph, order);
  const downstream = buildDownstreamIndex(graph, order);
  const changedArtifacts = uniqueStrings(changedArtifactIds).sort(compareIds);
  const changedSet = new Set(changedArtifacts);

  if (changedArtifacts.length === 0) {
    throw new Error("At least one --changed artifact id is required.");
  }

  for (const artifactId of changedArtifacts) {
    if (!byId.has(artifactId)) {
      throw new Error(`Unknown changed artifact id: ${artifactId}`);
    }
  }

  const dirty = new Map();
  const depths = new Map();
  const queue = [...changedArtifacts];

  for (const artifactId of changedArtifacts) {
    depths.set(artifactId, 0);
  }

  for (let index = 0; index < queue.length; index += 1) {
    const currentId = queue[index];
    const currentDepth = depths.get(currentId) || 0;
    const dependents = downstream.get(currentId) || [];

    for (const dependentId of dependents) {
      if (changedSet.has(dependentId)) {
        continue;
      }

      const currentInfo = dirty.get(dependentId) || {
        id: dependentId,
        dirtyUpstreams: new Set(),
        depth: currentDepth + 1
      };

      currentInfo.dirtyUpstreams.add(currentId);
      currentInfo.depth = Math.min(currentInfo.depth, currentDepth + 1);
      dirty.set(dependentId, currentInfo);

      if (!depths.has(dependentId)) {
        depths.set(dependentId, currentDepth + 1);
        queue.push(dependentId);
      }
    }
  }

  const dirtyArtifacts = [...dirty.values()]
    .sort((left, right) => compareIds(left.id, right.id))
    .map((entry) => {
      const artifact = byId.get(entry.id);
      return {
        id: artifact.id,
        kind: artifact.kind,
        path: artifact.path,
        depth: entry.depth,
        dirtyUpstreams: [...entry.dirtyUpstreams].sort(compareIds),
        reconcile: normalizeReconcile(artifact.reconcile)
      };
    });

  return {
    schemaVersion: 1,
    stage: STAGE,
    graphId: graph.graphId || null,
    changedArtifacts,
    dirtyArtifacts,
    counts: {
      changed: changedArtifacts.length,
      dirty: dirtyArtifacts.length,
      totalArtifacts: artifacts.length
    }
  };
}

export function buildGateRecord(manifest, options) {
  const gateId = requiredOption(options.gateId, "--gate");
  const status = requiredOption(options.status, "--status");
  const actor = requiredOption(options.actor, "--actor");
  const at = requiredOption(options.at, "--at");
  const note = options.note || "";

  if (!VALID_GATE_STATUSES.has(status)) {
    throw new Error(`Invalid --status: ${status}`);
  }

  if (!ISO_LIKE_PATTERN.test(at)) {
    throw new Error("--at must be an explicit ISO-like timestamp such as 2026-06-06T00:00:00Z.");
  }

  const gates = Array.isArray(manifest.approvalGates) ? manifest.approvalGates : [];
  if (!gates.some((gate) => gate && gate.id === gateId)) {
    throw new Error(`Unknown approval gate: ${gateId}`);
  }

  const recordSeed = {
    actor,
    at,
    gateId,
    note,
    status
  };
  const id = `approval.${sha256(formatJson(recordSeed)).slice(0, 16)}`;

  return {
    id,
    gateId,
    status,
    actor,
    at,
    note
  };
}

export function applyGateRecord(manifest, record) {
  const nextManifest = JSON.parse(JSON.stringify(manifest));
  const gate = nextManifest.approvalGates.find((candidate) => candidate.id === record.gateId);

  gate.status = record.status;
  gate.updatedAt = record.at;
  gate.actor = record.actor;
  gate.note = record.note;
  gate.history = uniqueStrings([...(Array.isArray(gate.history) ? gate.history : []), record.id]).sort();

  const records = Array.isArray(nextManifest.approvalRecords) ? nextManifest.approvalRecords : [];
  const deduped = records.filter((candidate) => candidate.id !== record.id);
  deduped.push(record);
  deduped.sort((left, right) => {
    const atCompare = left.at.localeCompare(right.at);
    if (atCompare !== 0) {
      return atCompare;
    }
    return left.id.localeCompare(right.id);
  });
  nextManifest.approvalRecords = deduped;

  return nextManifest;
}

export function formatValidationResult(result) {
  const lines = [
    "Autodesign state validation",
    `stage: ${result.stage}`,
    `manifest: ${result.manifestPath}`,
    `graph: ${result.graphPath}`,
    `artifacts: ${result.counts.artifacts}`,
    `dependencies: ${result.counts.dependencies}`,
    `approval gates: ${result.counts.approvalGates}`,
    `approval records: ${result.counts.approvalRecords}`,
    `errors: ${result.errors.length}`,
    `warnings: ${result.warnings.length}`
  ];

  for (const error of result.errors) {
    lines.push(`  error ${error.path}: ${error.message}`);
  }

  for (const warning of result.warnings) {
    lines.push(`  warning ${warning.path}: ${warning.message}`);
  }

  return `${lines.join("\n")}\n`;
}

export function formatDependencyResult(result) {
  const lines = [
    "Autodesign dependency check",
    `stage: ${result.stage}`,
    `graph: ${result.graphId}`,
    `artifacts: ${result.artifactCount}`,
    `dependencies: ${result.dependencyCount}`,
    `missing dependencies: ${result.missingDependencies.length}`,
    `cycles: ${result.cycles.length}`,
    `roots: ${result.roots.join(", ")}`,
    `leaves: ${result.leaves.join(", ")}`
  ];

  if (result.artifactId) {
    lines.push(`artifact: ${result.artifactId}`);
    lines.push(`upstream closure: ${result.upstreamClosure.join(", ") || "none"}`);
    lines.push(`downstream closure: ${result.downstreamClosure.join(", ") || "none"}`);
  }

  for (const missing of result.missingDependencies) {
    lines.push(`  missing ${missing.artifactId} -> ${missing.missingUpstreamId}`);
  }

  for (const cycle of result.cycles) {
    lines.push(`  cycle ${cycle.path.join(" -> ")}`);
  }

  return `${lines.join("\n")}\n`;
}

export function formatSubskillRunCheck(result) {
  const lines = [
    "Autodesign subskill run check",
    `stage: ${result.stage}`,
    `subskill: ${result.subskill}`,
    `contract: ${result.contractPath || "unknown"}`,
    `can run contract: ${result.canRun ? "yes" : "no"}`,
    `contract only: ${result.contractOnly === true ? "yes" : "no"}`,
    `phase behavior allowed: ${result.phaseBehaviorAllowed ? "yes" : "no"}`,
    `errors: ${result.errors.length}`,
    `warnings: ${result.warnings.length}`
  ];

  if (result.upstreamArtifacts.length > 0) {
    lines.push("required upstream artifacts:");
    for (const artifact of result.upstreamArtifacts) {
      lines.push(`  ${artifact.id}: ${artifact.declared ? "declared" : "missing-declaration"}, ${artifact.exists ? "present" : "missing"}${artifact.path ? ` (${artifact.path})` : ""}`);
    }
  } else {
    lines.push("required upstream artifacts: none");
  }

  if (result.outputArtifacts.length > 0) {
    lines.push("output artifacts:");
    for (const artifact of result.outputArtifacts) {
      lines.push(`  ${artifact.id}: ${artifact.declared ? "declared" : "missing-declaration"}${artifact.path ? ` (${artifact.path})` : ""}`);
    }
  } else {
    lines.push("output artifacts: none");
  }

  if (result.outputFiles.length > 0) {
    lines.push("output files:");
    for (const outputFile of result.outputFiles) {
      lines.push(`  ${outputFile.path}`);
    }
  }

  if (result.disabledBehaviors.length > 0) {
    lines.push("disabled behavior guards:");
    for (const behavior of result.disabledBehaviors) {
      lines.push(`  ${behavior.key}: ${behavior.enforced ? "enforced" : "not-enforced"}`);
    }
  }

  if (result.hardGates.length > 0) {
    lines.push("hard gates:");
    for (const gate of result.hardGates) {
      lines.push(`  ${gate.id}: ${gate.passed ? "pass" : "fail"}`);
    }
  }

  for (const error of result.errors) {
    lines.push(`  error ${error.check} ${error.path}: ${error.message}`);
  }

  for (const warning of result.warnings) {
    lines.push(`  warning ${warning.check} ${warning.path}: ${warning.message}`);
  }

  return `${lines.join("\n")}\n`;
}

export function formatDirtyResult(result) {
  const lines = [
    "Autodesign dirty artifact report",
    `stage: ${result.stage}`,
    `graph: ${result.graphId}`,
    `changed: ${result.changedArtifacts.join(", ")}`,
    `dirty: ${result.counts.dirty}`
  ];

  for (const artifact of result.dirtyArtifacts) {
    lines.push(`  ${artifact.id} (${artifact.kind})`);
    lines.push(`    path: ${artifact.path}`);
    lines.push(`    dirty upstreams: ${artifact.dirtyUpstreams.join(", ")}`);
    lines.push(`    reconcile: ${artifact.reconcile.policy}`);
    lines.push(`    preserve: ${artifact.reconcile.preserve.join(", ") || "none"}`);
    lines.push(`    may-change: ${artifact.reconcile.mayChange.join(", ") || "none"}`);
  }

  return `${lines.join("\n")}\n`;
}

export function formatRecordPlan(plan) {
  const lines = [
    "Autodesign approval record plan",
    `stage: ${plan.stage}`,
    `manifest: ${plan.manifestPath}`,
    `gate: ${plan.record.gateId}`,
    `status: ${plan.record.status}`,
    `actor: ${plan.record.actor}`,
    `at: ${plan.record.at}`,
    `record id: ${plan.record.id}`,
    `writes files: ${plan.writesFiles ? "yes" : "no"}`
  ];

  if (!plan.writesFiles) {
    lines.push("apply: rerun with --approve-record to write the manifest update");
  }

  return `${lines.join("\n")}\n`;
}

export function formatJson(value) {
  return `${JSON.stringify(sortJsonValue(value), null, 2)}\n`;
}

export function parseCommonOptions(argv) {
  const options = {
    workspace: process.cwd(),
    manifest: null,
    graph: null,
    json: false,
    help: false,
    rest: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--workspace") {
      options.workspace = readArgValue(argv, index, "--workspace");
      index += 1;
      continue;
    }

    if (arg === "--manifest") {
      options.manifest = readArgValue(argv, index, "--manifest");
      index += 1;
      continue;
    }

    if (arg === "--graph") {
      options.graph = readArgValue(argv, index, "--graph");
      index += 1;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--help") {
      options.help = true;
      continue;
    }

    options.rest.push(arg);
  }

  return options;
}

export function readArgValue(argv, index, name) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function validateManifest(manifest, graph, result) {
  if (!isObject(manifest)) {
    addError(result, "manifest", "manifest must be an object");
    return;
  }

  if (manifest.schemaVersion !== 1) {
    addError(result, "manifest.schemaVersion", "schemaVersion must be 1");
  }

  requireString(result, manifest.stage, "manifest.stage");
  requireString(result, manifest.package, "manifest.package");
  requireString(result, manifest.publicSkill, "manifest.publicSkill");

  if (!isObject(manifest.workspace)) {
    addError(result, "manifest.workspace", "workspace must be an object");
  } else {
    requireString(result, manifest.workspace.root, "manifest.workspace.root");
    requireString(result, manifest.workspace.manifestPath, "manifest.workspace.manifestPath");
    requireString(result, manifest.workspace.artifactGraphPath, "manifest.workspace.artifactGraphPath");
  }

  if (!isObject(manifest.artifactGraph)) {
    addError(result, "manifest.artifactGraph", "artifactGraph must be an object");
  } else {
    requireString(result, manifest.artifactGraph.path, "manifest.artifactGraph.path");
    requireString(result, manifest.artifactGraph.schema, "manifest.artifactGraph.schema");
    requireStringArray(result, manifest.artifactGraph.sourceOfTruth, "manifest.artifactGraph.sourceOfTruth");
    requireStringArray(result, manifest.artifactGraph.referencesOnly, "manifest.artifactGraph.referencesOnly");
  }

  validateApprovalGates(manifest, result);
  validateDisabledBehaviors(manifest, result);
  validateSubskillContracts(manifest, graph, result);

  if (!Array.isArray(manifest.notes)) {
    addError(result, "manifest.notes", "notes must be an array");
  }

  if (graph && graph.stage && manifest.stage !== graph.stage) {
    addWarning(result, "manifest.stage", "manifest stage differs from artifact graph stage");
  }
}

function validateApprovalGates(manifest, result) {
  const gates = manifest.approvalGates;
  if (!Array.isArray(gates)) {
    addError(result, "manifest.approvalGates", "approvalGates must be an array");
    return;
  }

  result.counts.approvalGates = gates.length;
  const gateIds = new Set();

  gates.forEach((gate, index) => {
    const basePath = `manifest.approvalGates[${index}]`;
    if (!isObject(gate)) {
      addError(result, basePath, "approval gate must be an object");
      return;
    }

    validateId(result, gate.id, `${basePath}.id`);
    if (gateIds.has(gate.id)) {
      addError(result, `${basePath}.id`, "approval gate id must be unique");
    }
    gateIds.add(gate.id);

    if (!VALID_GATE_STATUSES.has(gate.status)) {
      addError(result, `${basePath}.status`, "status is not valid");
    }

    requireBoolean(result, gate.required, `${basePath}.required`);
    requireBoolean(result, gate.implemented, `${basePath}.implemented`);
    requireStringArray(result, gate.scope, `${basePath}.scope`);
    requireStringArray(result, gate.requires, `${basePath}.requires`);
    requireNullableString(result, gate.updatedAt, `${basePath}.updatedAt`);
    requireNullableString(result, gate.actor, `${basePath}.actor`);
    requireStringValue(result, gate.note, `${basePath}.note`);
    requireStringArray(result, gate.history, `${basePath}.history`);

    if (gate.implemented === false && gate.status !== "not-implemented") {
      addWarning(result, `${basePath}.status`, "unimplemented gates should usually use not-implemented status");
    }
  });

  const records = manifest.approvalRecords;
  if (!Array.isArray(records)) {
    addError(result, "manifest.approvalRecords", "approvalRecords must be an array");
    return;
  }

  result.counts.approvalRecords = records.length;
  const recordIds = new Set();

  records.forEach((record, index) => {
    const basePath = `manifest.approvalRecords[${index}]`;
    if (!isObject(record)) {
      addError(result, basePath, "approval record must be an object");
      return;
    }

    requireString(result, record.id, `${basePath}.id`);
    if (recordIds.has(record.id)) {
      addError(result, `${basePath}.id`, "approval record id must be unique");
    }
    recordIds.add(record.id);

    requireString(result, record.gateId, `${basePath}.gateId`);
    if (!gateIds.has(record.gateId)) {
      addError(result, `${basePath}.gateId`, "approval record references an unknown gate");
    }

    if (!VALID_GATE_STATUSES.has(record.status)) {
      addError(result, `${basePath}.status`, "status is not valid");
    }
    requireString(result, record.actor, `${basePath}.actor`);
    requireString(result, record.at, `${basePath}.at`);
    requireStringValue(result, record.note, `${basePath}.note`);
  });
}

function validateDisabledBehaviors(manifest, result) {
  if (!isObject(manifest.disabledBehaviors)) {
    addError(result, "manifest.disabledBehaviors", "disabledBehaviors must be an object");
    return;
  }

  for (const key of DISABLED_BEHAVIOR_KEYS) {
    if (manifest.disabledBehaviors[key] !== true) {
      addError(result, `manifest.disabledBehaviors.${key}`, "Stage 05 must keep this behavior disabled");
    }
  }
}

function validateSubskillContracts(manifest, graph, result) {
  const contracts = manifest.subskillContracts;
  if (!Array.isArray(contracts)) {
    addError(result, "manifest.subskillContracts", "subskillContracts must be an array");
    return;
  }

  const names = new Set();
  const artifactIndex = graph && Array.isArray(graph.artifacts) ? buildArtifactIndex(graph) : new Map();

  contracts.forEach((contract, index) => {
    const basePath = `manifest.subskillContracts[${index}]`;
    if (!isObject(contract)) {
      addError(result, basePath, "subskill contract must be an object");
      return;
    }

    validateId(result, contract.name, `${basePath}.name`);
    if (names.has(contract.name)) {
      addError(result, `${basePath}.name`, "subskill name must be unique");
    }
    names.add(contract.name);

    requireString(result, contract.path, `${basePath}.path`);

    if (!VALID_SUBSKILL_STATUSES.has(contract.status)) {
      addError(result, `${basePath}.status`, "status must be contract-only");
    }

    requireBoolean(result, contract.contractOnly, `${basePath}.contractOnly`);
    requireBoolean(result, contract.implemented, `${basePath}.implemented`);

    if (contract.contractOnly !== true) {
      addError(result, `${basePath}.contractOnly`, "Stage 05 subskills must be contract-only");
    }

    if (contract.implemented !== false) {
      addError(result, `${basePath}.implemented`, "Stage 05 subskills must not implement real behavior");
    }

    requireStringArray(result, contract.requiredUpstreamArtifacts, `${basePath}.requiredUpstreamArtifacts`);
    requireStringArray(result, contract.outputArtifacts, `${basePath}.outputArtifacts`);
    requireStringArray(result, contract.outputFiles, `${basePath}.outputFiles`);
    requireStringArray(result, contract.hardGates, `${basePath}.hardGates`);
    requireStringArray(result, contract.disabledBehaviors, `${basePath}.disabledBehaviors`);
    requireStringArray(result, contract.failFast, `${basePath}.failFast`);

    for (const artifactId of Array.isArray(contract.requiredUpstreamArtifacts) ? contract.requiredUpstreamArtifacts : []) {
      if (!artifactIndex.has(artifactId)) {
        addError(result, `${basePath}.requiredUpstreamArtifacts`, `unknown upstream artifact: ${artifactId}`);
      }
    }

    for (const artifactId of Array.isArray(contract.outputArtifacts) ? contract.outputArtifacts : []) {
      if (!artifactIndex.has(artifactId)) {
        addError(result, `${basePath}.outputArtifacts`, `unknown output artifact: ${artifactId}`);
      }
    }

    for (const hardGate of Array.isArray(contract.hardGates) ? contract.hardGates : []) {
      if (!VALID_SUBSKILL_HARD_GATES.has(hardGate)) {
        addError(result, `${basePath}.hardGates`, `unknown hard gate: ${hardGate}`);
      }
    }

    for (const key of Array.isArray(contract.disabledBehaviors) ? contract.disabledBehaviors : []) {
      if (!Object.prototype.hasOwnProperty.call(manifest.disabledBehaviors || {}, key)) {
        addError(result, `${basePath}.disabledBehaviors`, `unknown disabled behavior guard: ${key}`);
      }
    }
  });
}

function validateGraph(graph, result) {
  if (!isObject(graph)) {
    addError(result, "graph", "artifact graph must be an object");
    return;
  }

  if (graph.schemaVersion !== 1) {
    addError(result, "graph.schemaVersion", "schemaVersion must be 1");
  }

  requireString(result, graph.stage, "graph.stage");
  requireString(result, graph.graphId, "graph.graphId");

  if (!Array.isArray(graph.artifacts)) {
    addError(result, "graph.artifacts", "artifacts must be an array");
    return;
  }

  result.counts.artifacts = graph.artifacts.length;
  const byId = new Map();

  graph.artifacts.forEach((artifact, index) => {
    const basePath = `graph.artifacts[${index}]`;
    if (!isObject(artifact)) {
      addError(result, basePath, "artifact must be an object");
      return;
    }

    validateId(result, artifact.id, `${basePath}.id`);
    if (byId.has(artifact.id)) {
      addError(result, `${basePath}.id`, "artifact id must be unique");
    }
    byId.set(artifact.id, artifact);

    if (!VALID_ARTIFACT_KINDS.has(artifact.kind)) {
      addError(result, `${basePath}.kind`, "artifact kind is not valid");
    }

    requireString(result, artifact.path, `${basePath}.path`);
    requireBoolean(result, artifact.sourceOfTruth, `${basePath}.sourceOfTruth`);
    requireBoolean(result, artifact.generated, `${basePath}.generated`);
    requireBoolean(result, artifact.referenceOnly, `${basePath}.referenceOnly`);
    requireBoolean(result, artifact.required, `${basePath}.required`);
    requireStringArray(result, artifact.upstreamDependencies, `${basePath}.upstreamDependencies`);
    validateReconcile(result, artifact.reconcile, `${basePath}.reconcile`);

    if (artifact.generated !== false) {
      addError(result, `${basePath}.generated`, "Stage 05 graph entries must not mark artifacts as generated");
    }

    if (artifact.kind === "canonical" && artifact.sourceOfTruth !== true) {
      addError(result, `${basePath}.sourceOfTruth`, "canonical artifacts must be source of truth");
    }

    if (REFERENCE_ONLY_KINDS.has(artifact.kind) && artifact.referenceOnly !== true) {
      addError(result, `${basePath}.referenceOnly`, "downstream visual/Pencil/DS/prototype/handoff artifacts must be reference-only in Stage 05");
    }

    result.counts.dependencies += Array.isArray(artifact.upstreamDependencies) ? artifact.upstreamDependencies.length : 0;
  });

  graph.artifacts.forEach((artifact, index) => {
    const basePath = `graph.artifacts[${index}].upstreamDependencies`;
    if (!Array.isArray(artifact.upstreamDependencies)) {
      return;
    }

    artifact.upstreamDependencies.forEach((upstreamId) => {
      if (!byId.has(upstreamId)) {
        addError(result, basePath, `unknown upstream dependency: ${upstreamId}`);
      }
    });
  });

  for (const cycle of findDependencyCycles(graph)) {
    addError(result, "graph.artifacts", `dependency cycle: ${cycle.join(" -> ")}`);
  }
}

function validateReconcile(result, reconcile, basePath) {
  if (!isObject(reconcile)) {
    addError(result, basePath, "reconcile must be an object");
    return;
  }

  if (!VALID_RECONCILE_POLICIES.has(reconcile.policy)) {
    addError(result, `${basePath}.policy`, "reconcile policy must be preserve or may-change");
  }
  requireStringArray(result, reconcile.preserve, `${basePath}.preserve`);
  requireStringArray(result, reconcile.mayChange, `${basePath}.mayChange`);
    requireStringValue(result, reconcile.notes, `${basePath}.notes`);
}

function validateManifestGraphLinks(manifest, graph, result) {
  if (!isObject(manifest) || !isObject(manifest.artifactGraph) || !Array.isArray(graph.artifacts)) {
    return;
  }

  const byId = buildArtifactIndex(graph);
  const sourceOfTruth = Array.isArray(manifest.artifactGraph.sourceOfTruth) ? manifest.artifactGraph.sourceOfTruth : [];
  const referencesOnly = Array.isArray(manifest.artifactGraph.referencesOnly) ? manifest.artifactGraph.referencesOnly : [];

  for (const artifactId of sourceOfTruth) {
    const artifact = byId.get(artifactId);
    if (!artifact) {
      addError(result, "manifest.artifactGraph.sourceOfTruth", `unknown source-of-truth artifact: ${artifactId}`);
      continue;
    }
    if (artifact.sourceOfTruth !== true) {
      addError(result, "manifest.artifactGraph.sourceOfTruth", `${artifactId} is not marked sourceOfTruth in graph`);
    }
  }

  for (const artifactId of referencesOnly) {
    const artifact = byId.get(artifactId);
    if (!artifact) {
      addError(result, "manifest.artifactGraph.referencesOnly", `unknown reference-only artifact: ${artifactId}`);
      continue;
    }
    if (artifact.referenceOnly !== true) {
      addError(result, "manifest.artifactGraph.referencesOnly", `${artifactId} is not marked referenceOnly in graph`);
    }
  }
}

function normalizeSubskillName(name) {
  if (typeof name !== "string" || name.length === 0) {
    throw new Error("--subskill requires a non-empty value.");
  }

  return name.startsWith("autodesign-") ? name.slice("autodesign-".length) : name;
}

function findSubskillContract(manifest, name) {
  const normalizedName = normalizeSubskillName(name);
  return (Array.isArray(manifest.subskillContracts) ? manifest.subskillContracts : [])
    .find((contract) => contract && contract.name === normalizedName) || null;
}

function findDependencyCycles(graph) {
  const byId = buildArtifactIndex(graph);
  const visited = new Set();
  const visiting = new Set();
  const cycles = [];

  function visit(artifactId, stack) {
    if (visited.has(artifactId)) {
      return;
    }

    visiting.add(artifactId);
    const artifact = byId.get(artifactId);
    const dependencies = artifact && Array.isArray(artifact.upstreamDependencies) ? artifact.upstreamDependencies : [];

    for (const upstreamId of dependencies) {
      if (!byId.has(upstreamId)) {
        continue;
      }

      if (visiting.has(upstreamId)) {
        const start = stack.indexOf(upstreamId);
        cycles.push([...stack.slice(start), upstreamId]);
        continue;
      }

      visit(upstreamId, [...stack, upstreamId]);
    }

    visiting.delete(artifactId);
    visited.add(artifactId);
  }

  for (const artifactId of byId.keys()) {
    visit(artifactId, [artifactId]);
  }

  return cycles.sort((left, right) => left.join(">").localeCompare(right.join(">")));
}

function topologicalArtifactIds(graph) {
  const cycles = findDependencyCycles(graph);
  if (cycles.length > 0) {
    throw new Error(`Cannot compute topological order with dependency cycle: ${cycles[0].join(" -> ")}`);
  }

  const byId = buildArtifactIndex(graph);
  const visited = new Set();
  const order = [];

  function visit(artifactId) {
    if (visited.has(artifactId)) {
      return;
    }

    visited.add(artifactId);
    const artifact = byId.get(artifactId);
    const dependencies = artifact && Array.isArray(artifact.upstreamDependencies) ? artifact.upstreamDependencies : [];
    for (const upstreamId of [...dependencies].sort(compareArtifactIds(graph))) {
      if (byId.has(upstreamId)) {
        visit(upstreamId);
      }
    }
    order.push(artifactId);
  }

  for (const artifact of Array.isArray(graph.artifacts) ? graph.artifacts : []) {
    visit(artifact.id);
  }

  return order;
}

function buildArtifactIndex(graph) {
  const byId = new Map();
  for (const artifact of Array.isArray(graph.artifacts) ? graph.artifacts : []) {
    if (artifact && typeof artifact.id === "string" && !byId.has(artifact.id)) {
      byId.set(artifact.id, artifact);
    }
  }
  return byId;
}

function buildDownstreamIndex(graph, order = null) {
  const byId = buildArtifactIndex(graph);
  const downstream = new Map();
  const compareIds = compareArtifactIds(graph, order);

  for (const artifactId of byId.keys()) {
    downstream.set(artifactId, []);
  }

  for (const artifact of byId.values()) {
    const dependencies = Array.isArray(artifact.upstreamDependencies) ? artifact.upstreamDependencies : [];
    for (const upstreamId of dependencies) {
      if (!downstream.has(upstreamId)) {
        downstream.set(upstreamId, []);
      }
      downstream.get(upstreamId).push(artifact.id);
    }
  }

  for (const dependents of downstream.values()) {
    dependents.sort(compareIds);
  }

  return downstream;
}

function collectUpstreamClosure(graph, artifactId) {
  const byId = buildArtifactIndex(graph);
  const order = topologicalArtifactIds(graph);
  const seen = new Set();

  function walk(currentId) {
    const artifact = byId.get(currentId);
    const dependencies = artifact && Array.isArray(artifact.upstreamDependencies) ? artifact.upstreamDependencies : [];
    for (const upstreamId of dependencies) {
      if (!seen.has(upstreamId)) {
        seen.add(upstreamId);
        walk(upstreamId);
      }
    }
  }

  walk(artifactId);
  return [...seen].sort(compareArtifactIds(graph, order));
}

function collectDownstreamClosure(graph, artifactId) {
  const order = topologicalArtifactIds(graph);
  const downstream = buildDownstreamIndex(graph, order);
  const seen = new Set();

  function walk(currentId) {
    for (const dependentId of downstream.get(currentId) || []) {
      if (!seen.has(dependentId)) {
        seen.add(dependentId);
        walk(dependentId);
      }
    }
  }

  walk(artifactId);
  return [...seen].sort(compareArtifactIds(graph, order));
}

function compareArtifactIds(graph, order = null) {
  const artifactOrder = order || (Array.isArray(graph.artifacts) ? graph.artifacts.map((artifact) => artifact.id) : []);
  const indexById = new Map(artifactOrder.map((id, index) => [id, index]));

  return (left, right) => {
    const leftIndex = indexById.has(left) ? indexById.get(left) : Number.MAX_SAFE_INTEGER;
    const rightIndex = indexById.has(right) ? indexById.get(right) : Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return String(left).localeCompare(String(right));
  };
}

function normalizeReconcile(reconcile) {
  const safe = isObject(reconcile) ? reconcile : {};
  return {
    policy: safe.policy || "preserve",
    preserve: Array.isArray(safe.preserve) ? [...safe.preserve].sort() : [],
    mayChange: Array.isArray(safe.mayChange) ? [...safe.mayChange].sort() : [],
    notes: typeof safe.notes === "string" ? safe.notes : ""
  };
}

function sortJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (isObject(value)) {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortJsonValue(value[key]);
    }
    return sorted;
  }

  return value;
}

function compareObjectsByKeys(keys) {
  return (left, right) => {
    for (const key of keys) {
      const compare = String(left[key]).localeCompare(String(right[key]));
      if (compare !== 0) {
        return compare;
      }
    }
    return 0;
  };
}

async function pathExists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function resolveAgainst(root, maybeRelativePath) {
  return path.isAbsolute(maybeRelativePath) ? maybeRelativePath : path.resolve(root, maybeRelativePath);
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function requiredOption(value, name) {
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateId(result, value, jsonPath) {
  requireString(result, value, jsonPath);
  if (typeof value === "string" && !ARTIFACT_ID_PATTERN.test(value)) {
    addError(result, jsonPath, "id must contain lowercase letters, numbers, dots, or hyphens");
  }
}

function requireString(result, value, jsonPath) {
  if (typeof value !== "string" || value.length === 0) {
    addError(result, jsonPath, "must be a non-empty string");
  }
}

function requireStringValue(result, value, jsonPath) {
  if (typeof value !== "string") {
    addError(result, jsonPath, "must be a string");
  }
}

function requireNullableString(result, value, jsonPath) {
  if (value !== null && typeof value !== "string") {
    addError(result, jsonPath, "must be a string or null");
  }
}

function requireBoolean(result, value, jsonPath) {
  if (typeof value !== "boolean") {
    addError(result, jsonPath, "must be a boolean");
  }
}

function requireStringArray(result, value, jsonPath) {
  if (!Array.isArray(value)) {
    addError(result, jsonPath, "must be an array");
    return;
  }

  const seen = new Set();
  value.forEach((item, index) => {
    if (typeof item !== "string" || item.length === 0) {
      addError(result, `${jsonPath}[${index}]`, "must be a non-empty string");
    }
    if (seen.has(item)) {
      addError(result, `${jsonPath}[${index}]`, "must not contain duplicate values");
    }
    seen.add(item);
  });
}

function addError(result, jsonPath, message) {
  result.errors.push({
    path: jsonPath,
    message
  });
}

function addWarning(result, jsonPath, message) {
  result.warnings.push({
    path: jsonPath,
    message
  });
}
