#!/usr/bin/env node
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  checkDependencies,
  checkSubskillCanRun,
  computeDirtyArtifacts,
  formatJson,
  loadState,
  parseCommonOptions,
  readArgValue,
  readJsonFile,
  validateState
} from "./lib/autodesign-state.mjs";

const STAGE = "09-handoff-and-hooks";
const SCRIPT_ID = "scripts/generate-handoff.mjs";
const ISO_LIKE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
const VALID_ACTIONS = new Set(["handoff", "reconcile"]);
const ACTION_APPROVALS = {
  handoff: "--approve-handoff-generation",
  reconcile: "--approve-reconcile-report"
};

const CANONICAL_ARTIFACTS = [
  "canonical.project-brief",
  "canonical.requirements",
  "canonical.brand-direction",
  "canonical.ux-rules",
  "canonical.screen-model",
  "canonical.navigation",
  "canonical.interaction-model",
  "canonical.screen-state-matrix",
  "canonical.coverage-matrix",
  "canonical.visual-anchor-proposals",
  "log.decision-log"
];

const HANDOFF_SOURCE_ARTIFACTS = [
  ...CANONICAL_ARTIFACTS,
  "visual.reference-selection",
  "visual.reference-set",
  "pencil.live-check",
  "pencil.wireframe-set",
  "pencil.canvas-exports",
  "design-system.primitives",
  "design-system.tokens",
  "design-system.contracts",
  "prototype.package",
  "prototype.canvas-exports",
  "prototype.visual-qa-report",
  "prototype.refinement-log"
];

const REQUIRED_HANDOFF_GENERATED_ARTIFACTS = [
  "canonical.project-brief",
  "canonical.requirements",
  "canonical.brand-direction",
  "canonical.ux-rules",
  "canonical.screen-model",
  "canonical.navigation",
  "canonical.interaction-model",
  "canonical.screen-state-matrix",
  "canonical.coverage-matrix",
  "canonical.visual-anchor-proposals",
  "visual.reference-selection",
  "visual.reference-set",
  "pencil.live-check",
  "pencil.wireframe-set",
  "pencil.canvas-exports",
  "design-system.primitives",
  "design-system.tokens",
  "design-system.contracts",
  "prototype.package",
  "prototype.canvas-exports",
  "prototype.visual-qa-report",
  "prototype.refinement-log"
];

const USAGE = `Usage:
  node autodesign-start/assets/payload/scripts/generate-handoff.mjs --workspace <workspace> --action handoff --plan
  node autodesign-start/assets/payload/scripts/generate-handoff.mjs --workspace <workspace> --action handoff --apply --approve-handoff-generation --actor <actor> --at <timestamp>
  node autodesign-start/assets/payload/scripts/generate-handoff.mjs --workspace <workspace> --action reconcile --changed <artifact-id> --plan
  node autodesign-start/assets/payload/scripts/generate-handoff.mjs --workspace <workspace> --action reconcile --changed <artifact-id> --apply --approve-reconcile-report --actor <actor> --at <timestamp>

Options:
  --workspace <workspace>              Workspace root containing autodesign/manifest.json.
  --manifest <path>                    Optional manifest path, relative to workspace unless absolute.
  --graph <path>                       Optional graph path, relative to workspace unless absolute.
  --action <name>                      handoff or reconcile. Default: handoff.
  --changed <artifact-id>              Changed artifact id for reconcile dirty propagation. May repeat or comma-separate.
  --plan                               Print planned writes without mutating files. This is the default mode.
  --apply                              Write handoff docs or reconcile report plus manifest/graph state.
  --approve-handoff-generation         Required with --apply --action handoff.
  --approve-reconcile-report           Required with --apply --action reconcile.
  --actor <actor>                      Required with --apply; records who authorized writes.
  --at <timestamp>                     Required with --apply; explicit ISO-like timestamp for deterministic records.
  --json                               Print machine-readable JSON.
  --help                               Print this help text.
`;

function parseOptions(argv) {
  const common = parseCommonOptions(argv);
  const options = {
    ...common,
    action: "handoff",
    changedArtifactIds: [],
    mode: "plan",
    modeWasSet: false,
    approvals: new Set(),
    actor: null,
    at: null,
    rest: []
  };

  for (let index = 0; index < common.rest.length; index += 1) {
    const arg = common.rest[index];

    if (arg === "--action") {
      options.action = readArgValue(common.rest, index, "--action");
      index += 1;
      continue;
    }

    if (arg === "--changed") {
      const value = readArgValue(common.rest, index, "--changed");
      options.changedArtifactIds.push(...value.split(",").map((item) => item.trim()).filter(Boolean));
      index += 1;
      continue;
    }

    if (arg === "--plan" || arg === "--apply") {
      const mode = arg.slice(2);
      if (options.modeWasSet && options.mode !== mode) {
        throw new Error("Use only one of --plan or --apply.");
      }
      options.mode = mode;
      options.modeWasSet = true;
      continue;
    }

    if (arg.startsWith("--approve-")) {
      options.approvals.add(arg);
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

    options.rest.push(arg);
  }

  if (!VALID_ACTIONS.has(options.action)) {
    throw new Error(`Unknown --action: ${options.action}`);
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

  if (options.mode === "apply") {
    assertApplyAllowed(options);
  }

  const state = await loadState(options);
  const plan = await buildStage09Plan(state, options);

  if (options.mode === "plan") {
    process.stdout.write(options.json ? formatJson(plan) : formatPlan(plan));
    return;
  }

  const result = await applyPlan(plan);
  process.stdout.write(options.json ? formatJson(result) : formatApplyResult(result));
}

function assertApplyAllowed(options) {
  const requiredApproval = ACTION_APPROVALS[options.action];
  if (!options.approvals.has(requiredApproval)) {
    throw new Error(`${requiredApproval} is required with --apply --action ${options.action}.`);
  }
  if (!options.actor) {
    throw new Error("--actor is required with --apply.");
  }
  if (!options.at) {
    throw new Error("--at is required with --apply.");
  }
  if (!ISO_LIKE_PATTERN.test(options.at)) {
    throw new Error("--at must be an explicit ISO-like timestamp such as 2026-06-07T00:00:00Z.");
  }
}

async function buildStage09Plan(state, options) {
  await assertBaseStateReady(state);
  await assertSubskillCanRun(state, options.action);

  if (options.action === "handoff") {
    return buildHandoffPlan(state, options);
  }

  return buildReconcilePlan(state, options);
}

async function assertBaseStateReady(state) {
  const validation = validateState(state);
  if (!validation.valid) {
    throw new Error(`State validation failed before Stage 09 generation: ${validation.errors[0].path}: ${validation.errors[0].message}`);
  }

  const dependencyResult = checkDependencies(state.graph);
  if (!dependencyResult.valid) {
    throw new Error("Artifact graph dependencies must be valid before Stage 09 generation.");
  }

  if (state.manifest.disabledBehaviors.handoff !== false) {
    throw new Error("manifest.disabledBehaviors.handoff must be false for Stage 09 handoff documentation.");
  }
}

async function assertSubskillCanRun(state, subskill) {
  const result = await checkSubskillCanRun(state, subskill);
  if (result.canRun) {
    return;
  }

  const details = result.errors
    .map((error) => `${error.check} ${error.path}: ${error.message}`)
    .join("; ");
  throw new Error(`Subskill ${subskill} cannot run: ${details}`);
}

async function buildHandoffPlan(state, options) {
  const artifactIndex = buildArtifactIndex(state.graph);
  assertGeneratedArtifacts(state, artifactIndex, REQUIRED_HANDOFF_GENERATED_ARTIFACTS);
  assertGateApproved(state.manifest, "prototype.visual-qa");

  const artifacts = await readArtifacts(state, artifactIndex, HANDOFF_SOURCE_ARTIFACTS);
  const sourceInventory = await buildSourceInventory(state, artifactIndex, HANDOFF_SOURCE_ARTIFACTS);
  const handoffPackage = buildHandoffPackage(options, artifacts, sourceInventory);
  const readme = buildHandoffReadme(handoffPackage);
  const inputHash = sha256([
    formatJson(sourceInventory),
    formatJson(handoffPackage.summary),
    formatJson(handoffPackage.screens),
    formatJson(handoffPackage.designSystem),
    formatJson(handoffPackage.quality)
  ].join("\n"));
  const nextState = buildNextState(state, options, ["handoff.package"], ["handoff.export"], inputHash, [
    "Frontend handoff documentation was generated from canonical, visual reference, Pencil, design-system, prototype, QA, and refinement metadata.",
    "Only JSON and Markdown handoff documentation were written; no frontend source files or executable prototype code were generated."
  ]);
  const handoffRoot = resolveAgainst(state.workspaceRoot, "autodesign/outputs/handoff");
  const writes = [
    await buildWriteAction("handoff.package.json", path.join(handoffRoot, "handoff-package.json"), "autodesign/outputs/handoff/handoff-package.json", formatJson(handoffPackage)),
    await buildWriteAction("handoff.readme", path.join(handoffRoot, "README.md"), "autodesign/outputs/handoff/README.md", readme),
    ...await buildStateWrite(state, nextState)
  ];
  assertAllowedWriteSet(options.action, writes);

  return buildPlanObject(state, options, inputHash, writes, handoffPackage.screens.length);
}

async function buildReconcilePlan(state, options) {
  if (options.changedArtifactIds.length === 0) {
    throw new Error("--changed is required for --action reconcile.");
  }

  const artifactIndex = buildArtifactIndex(state.graph);
  assertGeneratedArtifacts(state, artifactIndex, ["handoff.package"]);

  const dirty = computeDirtyArtifacts(state.graph, options.changedArtifactIds);
  const sourceInventory = await buildSourceInventory(state, artifactIndex, dirty.dirtyArtifacts.map((artifact) => artifact.id), {
    allowMissing: true
  });
  const report = buildReconcileReport(options, state, dirty, sourceInventory);
  const inputHash = sha256([
    formatJson(dirty),
    formatJson(sourceInventory),
    formatJson(report.alerts)
  ].join("\n"));
  const nextState = buildNextState(state, options, ["log.reconcile-report"], ["reconcile.report"], inputHash, [
    "Reconcile report was generated from artifact graph dirty propagation and reconcile policies.",
    "No upstream artifacts, design files, Pencil canvas state, or frontend code were mutated."
  ]);
  const writes = [
    await buildWriteAction("log.reconcile-report", resolveAgainst(state.workspaceRoot, "autodesign/logs/reconcile-report.json"), "autodesign/logs/reconcile-report.json", formatJson(report)),
    ...await buildStateWrite(state, nextState)
  ];
  assertAllowedWriteSet(options.action, writes);

  return buildPlanObject(state, options, inputHash, writes, report.alerts.length);
}

function buildHandoffPackage(options, artifacts, sourceInventory) {
  const screenModel = artifacts.get("canonical.screen-model") || {};
  const requirements = artifacts.get("canonical.requirements") || {};
  const brandDirection = artifacts.get("canonical.brand-direction") || {};
  const uxRules = artifacts.get("canonical.ux-rules") || {};
  const navigation = artifacts.get("canonical.navigation") || {};
  const interactionModel = artifacts.get("canonical.interaction-model") || {};
  const stateMatrix = artifacts.get("canonical.screen-state-matrix") || {};
  const coverage = artifacts.get("canonical.coverage-matrix") || {};
  const visualSelection = artifacts.get("visual.reference-selection") || {};
  const wireframes = artifacts.get("pencil.wireframe-set") || {};
  const pencilExports = artifacts.get("pencil.canvas-exports") || {};
  const primitives = artifacts.get("design-system.primitives") || {};
  const tokens = artifacts.get("design-system.tokens") || {};
  const contracts = artifacts.get("design-system.contracts") || {};
  const prototype = artifacts.get("prototype.package") || {};
  const prototypeExports = artifacts.get("prototype.canvas-exports") || {};
  const qaReport = artifacts.get("prototype.visual-qa-report") || {};
  const refinementLog = artifacts.get("prototype.refinement-log") || {};

  const screens = normalizeScreens(screenModel, wireframes, prototype, stateMatrix, interactionModel, coverage);
  const visualReferences = normalizeVisualReferences(visualSelection);
  const componentContracts = Array.isArray(contracts.components) ? contracts.components : [];
  const qaChecks = Array.isArray(qaReport.checks) ? qaReport.checks : [];

  return {
    schemaVersion: 1,
    stage: STAGE,
    artifactId: "handoff.package",
    generatedBy: buildRecordMeta(options),
    sourceArtifacts: sourceInventory,
    handoffScope: {
      type: "frontend-handoff-docs",
      outputs: [
        "autodesign/outputs/handoff/handoff-package.json",
        "autodesign/outputs/handoff/README.md"
      ],
      allowedFileTypes: ["json", "markdown"],
      exclusions: [
        "frontend source files",
        "executable prototype code",
        "image generation",
        "Pencil MCP mutation"
      ]
    },
    summary: {
      projectName: firstString(artifacts.get("canonical.project-brief")?.project?.name, artifacts.get("canonical.project-brief")?.name, "Autodesign project"),
      requirementCount: countArray(requirements.stories, requirements.functionalRequirements, requirements.requirements, requirements.rows),
      screenCount: screens.length,
      selectedReferenceCount: visualReferences.length,
      componentContractCount: componentContracts.length,
      qaStatus: qaReport.qaStatus || "unknown",
      refinementAttempts: Array.isArray(refinementLog.attempts) ? refinementLog.attempts.length : 0
    },
    canonical: {
      brandAttributes: arrayOfStrings(brandDirection.brand?.attributes || brandDirection.attributes),
      uxRuleCount: countArray(uxRules.rules),
      navigationItems: normalizeNavigation(navigation),
      interactionCount: countArray(interactionModel.transitions),
      coverageRows: countArray(coverage.rows, coverage.matrix)
    },
    visualReferences,
    pencil: {
      targetPenPath: prototype.pencilTarget?.path || wireframes.pencilTarget?.path || null,
      wireframeFrameCount: countArray(wireframes.screens),
      wireframeExportCount: countArray(pencilExports.records),
      prototypeExportCount: countArray(prototypeExports.records),
      evidenceTypes: uniqueStrings([
        wireframes.pencilEvidence?.evidenceType,
        prototype.pencilEvidence?.evidenceType
      ])
    },
    designSystem: {
      semanticTokens: tokens.semanticTokens || {},
      primitiveCounts: primitives.primitiveCounts || {},
      componentContracts: componentContracts.map((component) => ({
        id: component.id || null,
        role: component.role || null,
        screenId: component.screenId || null,
        requiredTokens: arrayOfStrings(component.requiredTokens),
        requiredStates: arrayOfStrings(component.requiredStates)
      })).sort(compareObjectsByKeys(["id", "screenId"]))
    },
    screens,
    quality: {
      qaStatus: qaReport.qaStatus || "unknown",
      visualQaGate: qaReport.gate || null,
      checks: qaChecks.map((check) => ({
        id: check.id || null,
        status: check.status || "unknown",
        message: check.message || ""
      })).sort(compareObjectsByKeys(["id"])),
      refinementGate: refinementLog.refinementGate || null
    },
    deliveryChecklist: buildDeliveryChecklist(qaReport, screens, componentContracts),
    constraints: [
      "Use this package as documentation only.",
      "Do not treat the package as generated frontend source.",
      "Regenerate only through scripts/generate-handoff.mjs with explicit approval."
    ]
  };
}

function normalizeScreens(screenModel, wireframes, prototype, stateMatrix, interactionModel, coverage) {
  const screens = Array.isArray(screenModel.screens) ? screenModel.screens : [];
  const wireframeScreens = Array.isArray(wireframes.screens) ? wireframes.screens : [];
  const prototypeScreens = Array.isArray(prototype.screens) ? prototype.screens : [];
  const states = Array.isArray(stateMatrix.matrix) ? stateMatrix.matrix : [];
  const transitions = Array.isArray(interactionModel.transitions) ? interactionModel.transitions : [];
  const coverageRows = Array.isArray(coverage.rows) ? coverage.rows : Array.isArray(coverage.matrix) ? coverage.matrix : [];

  return screens.map((screen) => {
    const wireframe = wireframeScreens.find((entry) => entry.screenId === screen.id) || {};
    const prototypeScreen = prototypeScreens.find((entry) => entry.screenId === screen.id) || {};
    const stateRow = states.find((entry) => entry.screenId === screen.id) || {};
    return {
      screenId: screen.id || null,
      screenName: screen.name || null,
      route: screen.route || null,
      priority: screen.priority || null,
      states: arrayOfStrings(stateRow.states?.map((state) => state.name) || prototypeScreen.stateNames || wireframe.stateNames),
      transitionIds: arrayOfStrings(transitions
        .filter((transition) => transition.from === screen.id || transition.to === screen.id)
        .map((transition) => transition.id)),
      requirementIds: arrayOfStrings(coverageRows
        .filter((row) => row.screenId === screen.id || arrayOfStrings(row.screenIds).includes(screen.id))
        .map((row) => row.requirementId || row.storyId || row.id)),
      pencilFrameIds: uniqueStrings([wireframe.pencilFrameId, prototypeScreen.pencilFrameId]),
      canvasExportPaths: uniqueStrings([
        ...arrayOfStrings(wireframe.canvasExportPaths),
        ...arrayOfStrings(prototypeScreen.canvasExportPaths)
      ]),
      tokenBindings: arrayOfStrings(prototypeScreen.tokenBindings)
    };
  }).sort(compareObjectsByKeys(["screenId"]));
}

function normalizeVisualReferences(selection) {
  const records = Array.isArray(selection.records) ? selection.records : [];
  return records
    .filter((record) => record && record.selected === true)
    .map((record) => ({
      referenceId: record.id || null,
      screenId: record.screenId || null,
      screenName: record.screenName || null,
      imagePaths: arrayOfStrings(record.generatedOutputPaths || [record.generatedOutputPath]),
      approved: record.selectionApproval?.approved === true
    }))
    .sort(compareObjectsByKeys(["screenId", "referenceId"]));
}

function normalizeNavigation(navigation) {
  const items = Array.isArray(navigation.items) ? navigation.items : Array.isArray(navigation.navigationItems) ? navigation.navigationItems : [];
  return items.map((item) => ({
    id: item.id || null,
    label: item.label || item.name || null,
    target: item.target || item.route || item.screenId || null
  })).sort(compareObjectsByKeys(["id", "label"]));
}

function buildDeliveryChecklist(qaReport, screens, componentContracts) {
  return [
    {
      id: "handoff.no-frontend-code",
      status: "pass",
      evidence: "Generated files are JSON and Markdown documentation only."
    },
    {
      id: "handoff.screen-coverage",
      status: screens.length > 0 ? "pass" : "blocked",
      evidence: `${screens.length} screen handoff records.`
    },
    {
      id: "handoff.component-contracts",
      status: componentContracts.length > 0 ? "pass" : "blocked",
      evidence: `${componentContracts.length} component contract records.`
    },
    {
      id: "handoff.prototype-qa",
      status: qaReport.qaStatus === "pass" ? "pass" : "review",
      evidence: `Prototype QA status is ${qaReport.qaStatus || "unknown"}.`
    }
  ];
}

function buildHandoffReadme(handoffPackage) {
  const lines = [
    "# Autodesign Frontend Handoff",
    "",
    `Stage: ${handoffPackage.stage}`,
    `Generated by: ${handoffPackage.generatedBy.actor} at ${handoffPackage.generatedBy.at}`,
    "",
    "## Scope",
    "",
    "This directory contains frontend handoff documentation only. It does not contain frontend source files, executable prototype code, generated images, or Pencil canvas mutations.",
    "",
    "## Summary",
    "",
    `- Project: ${handoffPackage.summary.projectName}`,
    `- Screens: ${handoffPackage.summary.screenCount}`,
    `- Selected visual references: ${handoffPackage.summary.selectedReferenceCount}`,
    `- Component contracts: ${handoffPackage.summary.componentContractCount}`,
    `- Prototype QA: ${handoffPackage.summary.qaStatus}`,
    "",
    "## Files",
    "",
    "- `handoff-package.json`: deterministic handoff package with source artifact hashes, screen mappings, DS tokens, component contracts, Pencil evidence references, QA status, and delivery checklist.",
    "- `README.md`: this human-readable summary.",
    "",
    "## Delivery Checklist",
    ""
  ];

  for (const item of handoffPackage.deliveryChecklist) {
    lines.push(`- ${item.id}: ${item.status} - ${item.evidence}`);
  }

  lines.push("");
  lines.push("## Source Artifacts");
  lines.push("");
  for (const artifact of handoffPackage.sourceArtifacts) {
    lines.push(`- ${artifact.id}: ${artifact.path} (${artifact.sha256 || "directory"})`);
  }

  return `${lines.join("\n")}\n`;
}

function buildReconcileReport(options, state, dirty, sourceInventory) {
  const artifactIndex = buildArtifactIndex(state.graph);
  const policyMatrix = (Array.isArray(state.graph.artifacts) ? state.graph.artifacts : [])
    .map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      path: artifact.path,
      generated: artifact.generated,
      sourceOfTruth: artifact.sourceOfTruth,
      referenceOnly: artifact.referenceOnly,
      reconcile: normalizeReconcile(artifact.reconcile)
    }))
    .sort(compareObjectsByKeys(["id"]));
  const alerts = buildReconcileAlerts(dirty, artifactIndex);

  return {
    schemaVersion: 1,
    stage: STAGE,
    artifactId: "log.reconcile-report",
    generatedBy: buildRecordMeta(options),
    sourceArtifacts: sourceInventory,
    changedArtifacts: dirty.changedArtifacts,
    dirtyPropagation: dirty,
    alerts,
    policyMatrix,
    constraints: [
      "This report is advisory and does not mutate upstream artifacts.",
      "Preserve and may-change policies come from autodesign/artifact-graph.json.",
      "Regenerate or repair dirty artifacts only through their stage-specific scripts and approval gates."
    ]
  };
}

function buildReconcileAlerts(dirty, artifactIndex) {
  const alerts = [];
  for (const artifact of dirty.dirtyArtifacts) {
    const graphArtifact = artifactIndex.get(artifact.id) || {};
    const reconcile = normalizeReconcile(graphArtifact.reconcile);
    const severity = reconcile.policy === "preserve" ? "review-required" : "advisory";
    alerts.push({
      id: `reconcile.${artifact.id}`,
      severity,
      artifactId: artifact.id,
      path: artifact.path,
      dirtyUpstreams: artifact.dirtyUpstreams,
      policy: reconcile.policy,
      preserve: reconcile.preserve,
      mayChange: reconcile.mayChange,
      message: reconcile.policy === "preserve"
        ? "Dirty propagation reached a preserve-policy artifact. Review before changing."
        : "Dirty propagation reached a may-change artifact. Regenerate only with explicit approval."
    });

    if (artifact.id === "handoff.package") {
      alerts.push({
        id: "reconcile.handoff.impacted",
        severity: "review-required",
        artifactId: artifact.id,
        path: artifact.path,
        dirtyUpstreams: artifact.dirtyUpstreams,
        policy: reconcile.policy,
        preserve: reconcile.preserve,
        mayChange: reconcile.mayChange,
        message: "Frontend handoff docs may be stale and should be regenerated after approved upstream changes."
      });
    }
  }

  return alerts.sort(compareObjectsByKeys(["artifactId", "id"]));
}

async function readArtifacts(state, artifactIndex, artifactIds) {
  const artifacts = new Map();
  for (const artifactId of artifactIds) {
    const artifact = artifactIndex.get(artifactId);
    if (!artifact) {
      throw new Error(`Artifact graph is missing ${artifactId}.`);
    }
    if (artifact.path.endsWith("/outputs/visual-references") || artifactId === "visual.reference-set") {
      continue;
    }
    artifacts.set(artifactId, await readJsonFile(resolveAgainst(state.workspaceRoot, artifact.path)));
  }
  return artifacts;
}

async function buildSourceInventory(state, artifactIndex, artifactIds, options = {}) {
  const uniqueIds = uniqueStrings(artifactIds);
  const inventory = [];
  for (const artifactId of uniqueIds) {
    const artifact = artifactIndex.get(artifactId);
    if (!artifact) {
      throw new Error(`Artifact graph is missing ${artifactId}.`);
    }
    const absolutePath = resolveAgainst(state.workspaceRoot, artifact.path);
    const record = {
      id: artifact.id,
      kind: artifact.kind,
      path: artifact.path,
      generated: artifact.generated,
      referenceOnly: artifact.referenceOnly,
      sourceOfTruth: artifact.sourceOfTruth,
      reconcile: normalizeReconcile(artifact.reconcile)
    };
    let stat;
    try {
      stat = await fs.stat(absolutePath);
    } catch (error) {
      if (options.allowMissing && error && error.code === "ENOENT") {
        record.exists = false;
        inventory.push(record);
        continue;
      }
      throw error;
    }
    record.exists = true;
    if (stat.isFile()) {
      const bytes = await fs.readFile(absolutePath);
      record.bytes = bytes.length;
      record.sha256 = sha256(bytes);
    } else if (stat.isDirectory()) {
      record.directory = true;
    } else {
      throw new Error(`Artifact path is neither file nor directory: ${artifact.path}`);
    }
    inventory.push(record);
  }
  return inventory.sort(compareObjectsByKeys(["id"]));
}

function assertGeneratedArtifacts(state, artifactIndex, artifactIds) {
  const records = Array.isArray(state.manifest.generationRecords) ? state.manifest.generationRecords : [];
  for (const artifactId of artifactIds) {
    const artifact = artifactIndex.get(artifactId);
    if (!artifact) {
      throw new Error(`Artifact graph is missing ${artifactId}.`);
    }
    if (artifact.generated !== true) {
      throw new Error(`${artifactId} must be marked generated before Stage 09 ${artifactId === "handoff.package" ? "reconcile" : "handoff"} generation.`);
    }
    const generatedRecordExists = records.some((record) => record && Array.isArray(record.artifacts) && record.artifacts.includes(artifactId));
    if (!generatedRecordExists) {
      throw new Error(`${artifactId} must have a generation record before Stage 09 generation.`);
    }
  }
}

function assertGateApproved(manifest, gateId) {
  const gate = (Array.isArray(manifest.approvalGates) ? manifest.approvalGates : [])
    .find((candidate) => candidate.id === gateId);
  if (!gate || gate.status !== "approved") {
    throw new Error(`${gateId} gate must be approved before handoff generation.`);
  }
}

function buildNextState(state, options, artifactIds, gateIds, inputHash, notes) {
  const manifest = JSON.parse(JSON.stringify(state.manifest));
  const graph = JSON.parse(JSON.stringify(state.graph));
  const recordSeed = {
    action: options.action,
    actor: options.actor || "plan",
    at: options.at || "plan",
    artifacts: artifactIds,
    inputHash,
    script: SCRIPT_ID
  };
  const recordId = `generation.${sha256(formatJson(recordSeed)).slice(0, 16)}`;

  for (const artifact of graph.artifacts) {
    if (artifactIds.includes(artifact.id)) {
      artifact.generated = true;
    }
  }

  for (const gateId of gateIds) {
    updateGate(manifest, gateId, {
      actor: options.actor || null,
      at: options.at || null,
      historyId: recordId,
      note: gateNote(options.action, gateId),
      status: "approved"
    });
  }

  const record = {
    id: recordId,
    actor: options.actor || "plan",
    at: options.at || "plan",
    script: SCRIPT_ID,
    inputHash,
    artifacts: artifactIds,
    gates: gateIds,
    notes
  };
  const existing = Array.isArray(manifest.generationRecords) ? manifest.generationRecords : [];
  manifest.generationRecords = [...existing.filter((entry) => entry.id !== record.id), record]
    .sort((left, right) => {
      const atCompare = left.at.localeCompare(right.at);
      if (atCompare !== 0) {
        return atCompare;
      }
      return left.id.localeCompare(right.id);
    });

  return {
    manifest,
    graph
  };
}

function updateGate(manifest, gateId, update) {
  const gate = (Array.isArray(manifest.approvalGates) ? manifest.approvalGates : [])
    .find((candidate) => candidate.id === gateId);
  if (!gate) {
    throw new Error(`Unknown approval gate: ${gateId}`);
  }

  gate.status = update.status;
  gate.updatedAt = update.at || null;
  gate.actor = update.actor || null;
  gate.note = update.note;
  gate.history = uniqueStrings([...(Array.isArray(gate.history) ? gate.history : []), update.historyId]);
}

function gateNote(action, gateId) {
  if (gateId === "handoff.export") {
    return "Frontend handoff documentation generated as JSON/Markdown only.";
  }
  if (gateId === "reconcile.report") {
    return "Reconcile report generated from dirty propagation and preserve/may-change policies.";
  }
  return `Stage 09 ${action} gate updated.`;
}

function buildPlanObject(state, options, inputHash, writes, recordCount) {
  return {
    schemaVersion: 1,
    stage: STAGE,
    mode: options.mode,
    action: options.action,
    workspaceRoot: state.workspaceRoot,
    inputHash,
    recordCount,
    approvalGates: {
      applyRequires: [ACTION_APPROVALS[options.action]],
      actorRequires: ["--actor"],
      timestampRequires: ["--at"]
    },
    counts: countActions(writes),
    writes
  };
}

async function buildStateWrite(state, nextState) {
  return [
    await buildWriteAction("state.manifest", state.manifestPath, relativeToWorkspace(state.workspaceRoot, state.manifestPath), formatJson(nextState.manifest)),
    await buildWriteAction("state.artifact-graph", state.graphPath, relativeToWorkspace(state.workspaceRoot, state.graphPath), formatJson(nextState.graph))
  ];
}

async function buildWriteAction(id, absolutePath, relPath, text) {
  const existing = await readMaybeText(absolutePath);
  const action = existing === null ? "create" : existing === text ? "preserve" : "overwrite";
  return {
    id,
    action,
    path: relPath,
    absolutePath,
    bytes: Buffer.byteLength(text),
    sha256: sha256(text),
    text
  };
}

function assertAllowedWriteSet(action, writes) {
  for (const write of writes) {
    const isStateWrite = write.path === "autodesign/manifest.json" || write.path === "autodesign/artifact-graph.json";
    if (isStateWrite) {
      continue;
    }
    if (action === "handoff") {
      if (!write.path.startsWith("autodesign/outputs/handoff/")) {
        throw new Error(`Handoff writes must stay under autodesign/outputs/handoff/: ${write.path}`);
      }
      if (!write.path.endsWith(".json") && !write.path.endsWith(".md")) {
        throw new Error(`Handoff writes may only be JSON or Markdown: ${write.path}`);
      }
      continue;
    }
    if (write.path !== "autodesign/logs/reconcile-report.json") {
      throw new Error(`Reconcile writes may only target autodesign/logs/reconcile-report.json: ${write.path}`);
    }
  }
}

async function applyPlan(plan) {
  const written = [];
  for (const write of plan.writes) {
    if (write.action === "preserve") {
      continue;
    }
    await fs.mkdir(path.dirname(write.absolutePath), { recursive: true });
    await fs.writeFile(write.absolutePath, write.text, "utf8");
    written.push(write.path);
  }

  return {
    schemaVersion: 1,
    stage: plan.stage,
    action: plan.action,
    workspaceRoot: plan.workspaceRoot,
    inputHash: plan.inputHash,
    recordCount: plan.recordCount,
    written
  };
}

function formatPlan(plan) {
  const lines = [
    "Autodesign Stage 09 plan",
    `stage: ${plan.stage}`,
    `workspace: ${plan.workspaceRoot}`,
    `action: ${plan.action}`,
    `input hash: ${plan.inputHash}`,
    `records: ${plan.recordCount}`,
    `create: ${plan.counts.create}`,
    `overwrite: ${plan.counts.overwrite}`,
    `preserve: ${plan.counts.preserve}`,
    "approval gates:"
  ];

  for (const [key, values] of Object.entries(plan.approvalGates)) {
    lines.push(`  ${key}: ${values.join(", ")}`);
  }

  lines.push("writes:");
  for (const write of plan.writes) {
    lines.push(`  ${write.action} ${write.path} (${write.bytes} bytes, sha256 ${write.sha256})`);
  }

  return `${lines.join("\n")}\n`;
}

function formatApplyResult(result) {
  const lines = [
    "Autodesign Stage 09 apply complete",
    `stage: ${result.stage}`,
    `workspace: ${result.workspaceRoot}`,
    `action: ${result.action}`,
    `input hash: ${result.inputHash}`,
    `records: ${result.recordCount}`,
    `written: ${result.written.length}`
  ];

  for (const relPath of result.written) {
    lines.push(`  ${relPath}`);
  }

  return `${lines.join("\n")}\n`;
}

function buildRecordMeta(options) {
  return {
    script: SCRIPT_ID,
    action: options.action,
    actor: options.actor || "plan",
    at: options.at || "plan"
  };
}

function normalizeReconcile(reconcile) {
  return {
    policy: reconcile?.policy || "preserve",
    preserve: arrayOfStrings(reconcile?.preserve),
    mayChange: arrayOfStrings(reconcile?.mayChange),
    notes: typeof reconcile?.notes === "string" ? reconcile.notes : ""
  };
}

function countActions(writes) {
  return writes.reduce((counts, write) => {
    counts[write.action] += 1;
    return counts;
  }, { create: 0, overwrite: 0, preserve: 0 });
}

async function readMaybeText(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function buildArtifactIndex(graph) {
  const byId = new Map();
  for (const artifact of Array.isArray(graph.artifacts) ? graph.artifacts : []) {
    byId.set(artifact.id, artifact);
  }
  return byId;
}

function countArray(...values) {
  return values.find((value) => Array.isArray(value))?.length || 0;
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) || null;
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
      const leftValue = left[key] || "";
      const rightValue = right[key] || "";
      const comparison = String(leftValue).localeCompare(String(rightValue));
      if (comparison !== 0) {
        return comparison;
      }
    }
    return 0;
  };
}

function resolveAgainst(root, maybeRelativePath) {
  return path.isAbsolute(maybeRelativePath) ? maybeRelativePath : path.resolve(root, maybeRelativePath);
}

function relativeToWorkspace(workspaceRoot, absolutePath) {
  return path.relative(workspaceRoot, absolutePath).split(path.sep).join("/");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

main().catch((error) => {
  process.stderr.write(`autodesign generate-handoff error: ${error.message}\n`);
  process.exitCode = 1;
});
