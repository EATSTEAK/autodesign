#!/usr/bin/env node
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  checkDependencies,
  checkSubskillCanRun,
  formatJson,
  loadState,
  parseCommonOptions,
  readArgValue,
  readJsonFile,
  validateState
} from "./lib/autodesign-state.mjs";

const STAGE = "08-pencil-prototype-and-design-system";
const SCRIPT_ID = "scripts/generate-pencil-prototype.mjs";
const ISO_LIKE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
const VALID_ACTIONS = new Set(["live-check", "wireframes", "primitives", "ds", "prototype", "qa"]);
const VALID_QA_STATUSES = new Set(["pass", "needs-refinement", "blocked"]);
const DEFAULT_PEN_PATH = "autodesign/outputs/pencil/autodesign-prototype.pen";
const MAX_REFINEMENT_ATTEMPTS = 2;

const ACTION_APPROVALS = {
  "live-check": "--approve-pencil-live-check",
  wireframes: "--approve-pencil-wireframes",
  primitives: "--approve-design-system-primitives",
  ds: "--approve-design-system-generation",
  prototype: "--approve-prototype-generation",
  qa: "--approve-prototype-qa"
};

const ACTION_SUBSKILLS = {
  wireframes: "wireframe",
  primitives: "primitives",
  ds: "ds",
  prototype: "prototype",
  qa: "qa"
};

const USAGE = `Usage:
  node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace <workspace> --action live-check --pencil-live-check-source-path <path> --plan
  node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace <workspace> --action wireframes --pencil-evidence-path <path> --canvas-export-path <path> --plan
  node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace <workspace> --action primitives --plan
  node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace <workspace> --action ds --plan
  node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace <workspace> --action prototype --pencil-evidence-path <path> --canvas-export-path <path> --plan
  node autodesign-start/assets/payload/scripts/generate-pencil-prototype.mjs --workspace <workspace> --action qa --refinement-attempt <0|1|2> --qa-status <status> --plan

Options:
  --workspace <workspace>                  Workspace root containing autodesign/manifest.json.
  --manifest <path>                        Optional manifest path, relative to workspace unless absolute.
  --graph <path>                           Optional graph path, relative to workspace unless absolute.
  --action <name>                          live-check, wireframes, primitives, ds, prototype, or qa.
  --plan                                   Print planned writes without mutating files. This is the default mode.
  --apply                                  Write artifact records and update manifest/graph state.
  --approve-pencil-live-check              Required with --apply --action live-check.
  --approve-pencil-wireframes              Required with --apply --action wireframes.
  --approve-design-system-primitives       Required with --apply --action primitives.
  --approve-design-system-generation       Required with --apply --action ds.
  --approve-prototype-generation           Required with --apply --action prototype.
  --approve-prototype-qa                   Required with --apply --action qa.
  --actor <actor>                          Required with --apply; records who authorized writes.
  --at <timestamp>                         Required with --apply; explicit ISO-like timestamp for deterministic records.
  --pencil-document-path <path>            Autodesign-owned virtual Pencil filePath. Default: ${DEFAULT_PEN_PATH}.
  --pencil-live-check-source-path <path>   Existing JSON evidence from a real Pencil get_editor_state check and validated Autodesign target filePath.
  --pencil-evidence-path <path>            Existing JSON evidence from real Pencil batch_design/export_nodes actions. Required for wireframes/prototype.
  --canvas-export-path <path>              Existing PNG/JPEG/WebP/PDF canvas export path. May repeat.
  --pencil-frame-id <screen-id=frame-id>   Optional real Pencil frame id mapping. May repeat.
  --qa-status <status>                     pass, needs-refinement, or blocked. Default: pass.
  --qa-note <text>                         Optional QA note. May repeat.
  --refinement-attempt <number>            QA/refinement attempt, from 0 to 2. Default: 0.
  --json                                   Print machine-readable JSON.
  --help                                   Print this help text.
`;

function parseOptions(argv) {
  const common = parseCommonOptions(argv);
  const options = {
    ...common,
    action: "live-check",
    mode: "plan",
    modeWasSet: false,
    actor: null,
    at: null,
    approvals: new Set(),
    pencilDocumentPath: DEFAULT_PEN_PATH,
    pencilLiveCheckSourcePath: null,
    pencilEvidencePath: null,
    canvasExportPaths: [],
    pencilFrameIds: [],
    qaStatus: "pass",
    qaNotes: [],
    refinementAttempt: 0,
    rest: []
  };

  for (let index = 0; index < common.rest.length; index += 1) {
    const arg = common.rest[index];

    if (arg === "--action") {
      options.action = readArgValue(common.rest, index, "--action");
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

    if (arg === "--pencil-document-path") {
      options.pencilDocumentPath = readArgValue(common.rest, index, "--pencil-document-path");
      index += 1;
      continue;
    }

    if (arg === "--pencil-live-check-source-path") {
      options.pencilLiveCheckSourcePath = readArgValue(common.rest, index, "--pencil-live-check-source-path");
      index += 1;
      continue;
    }

    if (arg === "--pencil-evidence-path") {
      options.pencilEvidencePath = readArgValue(common.rest, index, "--pencil-evidence-path");
      index += 1;
      continue;
    }

    if (arg === "--canvas-export-path") {
      options.canvasExportPaths.push(readArgValue(common.rest, index, "--canvas-export-path"));
      index += 1;
      continue;
    }

    if (arg === "--pencil-frame-id") {
      options.pencilFrameIds.push(readArgValue(common.rest, index, "--pencil-frame-id"));
      index += 1;
      continue;
    }

    if (arg === "--qa-status") {
      options.qaStatus = readArgValue(common.rest, index, "--qa-status");
      index += 1;
      continue;
    }

    if (arg === "--qa-note") {
      options.qaNotes.push(readArgValue(common.rest, index, "--qa-note"));
      index += 1;
      continue;
    }

    if (arg === "--refinement-attempt") {
      const raw = readArgValue(common.rest, index, "--refinement-attempt");
      options.refinementAttempt = Number(raw);
      index += 1;
      continue;
    }

    options.rest.push(arg);
  }

  if (!VALID_ACTIONS.has(options.action)) {
    throw new Error(`Unknown --action: ${options.action}`);
  }

  if (!VALID_QA_STATUSES.has(options.qaStatus)) {
    throw new Error(`Invalid --qa-status: ${options.qaStatus}`);
  }

  if (!Number.isInteger(options.refinementAttempt) || options.refinementAttempt < 0 || options.refinementAttempt > MAX_REFINEMENT_ATTEMPTS) {
    throw new Error(`--refinement-attempt must be an integer from 0 to ${MAX_REFINEMENT_ATTEMPTS}.`);
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
  const plan = await buildStage08Plan(state, options);

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
    throw new Error("--at must be an explicit ISO-like timestamp such as 2026-06-06T00:00:00Z.");
  }
}

async function buildStage08Plan(state, options) {
  await assertBaseStateReady(state);
  const artifactIndex = buildArtifactIndex(state.graph);
  const pencilTarget = validateAutodesignPenPath(state.workspaceRoot, options.pencilDocumentPath);
  const selectedReferences = await readSelectedReferences(state, artifactIndex);
  const context = {
    artifactIndex,
    pencilTarget,
    selectedReferences
  };

  if (ACTION_SUBSKILLS[options.action]) {
    await assertSubskillCanRun(state, ACTION_SUBSKILLS[options.action]);
  }

  if (options.action === "live-check") {
    return buildLiveCheckPlan(state, context, options);
  }
  if (options.action === "wireframes") {
    return buildWireframesPlan(state, context, options);
  }
  if (options.action === "primitives") {
    return buildPrimitivesPlan(state, context, options);
  }
  if (options.action === "ds") {
    return buildDesignSystemPlan(state, context, options);
  }
  if (options.action === "prototype") {
    return buildPrototypePlan(state, context, options);
  }
  return buildQaPlan(state, context, options);
}

async function assertBaseStateReady(state) {
  const validation = validateState(state);
  if (!validation.valid) {
    throw new Error(`State validation failed before Stage 08 generation: ${validation.errors[0].path}: ${validation.errors[0].message}`);
  }

  const dependencyResult = checkDependencies(state.graph);
  if (!dependencyResult.valid) {
    throw new Error("Artifact graph dependencies must be valid before Stage 08 generation.");
  }

  if (state.manifest.disabledBehaviors.pencilOperations !== false) {
    throw new Error("manifest.disabledBehaviors.pencilOperations must be false for Stage 08 Pencil records.");
  }
  if (state.manifest.disabledBehaviors.designSystemGeneration !== false) {
    throw new Error("manifest.disabledBehaviors.designSystemGeneration must be false for Stage 08 DS records.");
  }
  if (state.manifest.disabledBehaviors.prototypeGeneration !== false) {
    throw new Error("manifest.disabledBehaviors.prototypeGeneration must be false for Stage 08 prototype records.");
  }
  if (state.manifest.disabledBehaviors.handoff !== true) {
    throw new Error("manifest.disabledBehaviors.handoff must remain true; Stage 08 does not implement frontend handoff.");
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

async function buildLiveCheckPlan(state, context, options) {
  if (!options.pencilLiveCheckSourcePath) {
    throw new Error("--pencil-live-check-source-path is required for --action live-check.");
  }

  const sourcePath = resolveWorkspacePath(state.workspaceRoot, options.pencilLiveCheckSourcePath, "Pencil live-check source path");
  const source = await readJsonFile(sourcePath.absolutePath);
  const penFile = context.pencilTarget;
  const liveCheck = normalizeLiveCheckSource(source, penFile);
  const output = {
    schemaVersion: 1,
    stage: STAGE,
    artifactId: "pencil.live-check",
    generatedBy: buildRecordMeta(options),
    selectedReferenceGate: selectedReferenceGateRecord(context.selectedReferences),
    pencilTarget: penFile,
    sourcePath: sourcePath.path,
    liveCheck
  };
  const inputHash = sha256([
    formatJson(context.selectedReferences.summary),
    formatJson(liveCheck),
    penFile.path
  ].join("\n"));
  const nextState = buildNextState(state, options, ["pencil.live-check"], ["pencil.live-check"], inputHash, [
    "Pencil availability and the Autodesign-owned virtual Pencil filePath were recorded from supplied live Pencil evidence.",
    "The script did not create or mutate a Pencil canvas."
  ]);
  const writes = [
    await buildArtifactWrite(state, context.artifactIndex, "pencil.live-check", formatJson(output)),
    await buildStateWrite(state, nextState)
  ].flat();

  return buildPlanObject(state, options, inputHash, writes, 1);
}

async function buildWireframesPlan(state, context, options) {
  const liveCheck = await readRecordedLiveCheck(state, context, true);
  const penFile = context.pencilTarget;
  const exportRecords = await resolveCanvasExportRecords(state.workspaceRoot, options.canvasExportPaths, "wireframe");
  const frameMap = parseFrameIds(options.pencilFrameIds);
  const pencilEvidence = await readPencilActionEvidence(state, context, options, "wireframe", penFile, liveCheck, exportRecords);
  const screenModel = await readArtifactJson(state, context.artifactIndex, "canonical.screen-model");
  const interactionModel = await readArtifactJson(state, context.artifactIndex, "canonical.interaction-model");
  const stateMatrix = await readArtifactJson(state, context.artifactIndex, "canonical.screen-state-matrix");
  const evidenceBindings = normalizeCanvasEvidence(pencilEvidence, "wireframe", screenModel, penFile, liveCheck, exportRecords);
  const output = buildWireframeMetadata({
    options,
    selectedReferences: context.selectedReferences,
    liveCheck,
    penFile,
    exportRecords,
    frameMap,
    evidenceBindings,
    screenModel,
    interactionModel,
    stateMatrix
  });
  const exportOutput = buildCanvasExportArtifact("pencil.canvas-exports", options, context, exportRecords, liveCheck, evidenceBindings);
  const inputHash = sha256([
    formatJson(context.selectedReferences.summary),
    formatJson(liveCheck),
    formatJson(evidenceBindings.summary),
    formatJson(exportRecords),
    formatJson(screenModel),
    formatJson(interactionModel),
    formatJson(stateMatrix),
    context.pencilTarget.path
  ].join("\n"));
  const nextState = buildNextState(state, options, ["pencil.wireframe-set", "pencil.canvas-exports"], ["pencil.operations"], inputHash, [
    "Wireframe metadata and canvas export records were persisted from real Pencil MCP canvas evidence.",
    "The script did not create or fake Pencil canvas content; active Pencil MCP batch_design/export_nodes evidence was required."
  ]);
  const writes = [
    await buildArtifactWrite(state, context.artifactIndex, "pencil.wireframe-set", formatJson(output)),
    await buildArtifactWrite(state, context.artifactIndex, "pencil.canvas-exports", formatJson(exportOutput)),
    await buildStateWrite(state, nextState)
  ].flat();

  return buildPlanObject(state, options, inputHash, writes, output.screens.length);
}

async function buildPrimitivesPlan(state, context, options) {
  const brandDirection = await readArtifactJson(state, context.artifactIndex, "canonical.brand-direction");
  const output = buildPrimitiveInventory(options, context.selectedReferences, brandDirection);
  const inputHash = sha256([
    formatJson(context.selectedReferences.summary),
    formatJson(brandDirection)
  ].join("\n"));
  const nextState = buildNextState(state, options, ["design-system.primitives"], ["design-system.primitives"], inputHash, [
    "Primitive inventory was derived deterministically from selected references and canonical brand direction.",
    "No image pixels were sampled and no canvas output was faked."
  ]);
  const writes = [
    await buildArtifactWrite(state, context.artifactIndex, "design-system.primitives", formatJson(output)),
    await buildStateWrite(state, nextState)
  ].flat();

  return buildPlanObject(state, options, inputHash, writes, output.primitiveCounts.total);
}

async function buildDesignSystemPlan(state, context, options) {
  const primitives = await readArtifactJson(state, context.artifactIndex, "design-system.primitives");
  const screenModel = await readArtifactJson(state, context.artifactIndex, "canonical.screen-model");
  const wireframes = await readArtifactJson(state, context.artifactIndex, "pencil.wireframe-set");
  const { tokens, contracts } = buildDesignSystemArtifacts(options, primitives, screenModel, wireframes, context.selectedReferences);
  const inputHash = sha256([
    formatJson(primitives),
    formatJson(screenModel),
    formatJson(wireframes),
    formatJson(context.selectedReferences.summary)
  ].join("\n"));
  const nextState = buildNextState(state, options, ["design-system.tokens", "design-system.contracts"], ["design-system.generation"], inputHash, [
    "Design-system tokens and component contracts were derived deterministically from primitives, wireframes, and canonical screens.",
    "No frontend handoff or implementation files were generated."
  ]);
  const writes = [
    await buildArtifactWrite(state, context.artifactIndex, "design-system.tokens", formatJson(tokens)),
    await buildArtifactWrite(state, context.artifactIndex, "design-system.contracts", formatJson(contracts)),
    await buildStateWrite(state, nextState)
  ].flat();

  return buildPlanObject(state, options, inputHash, writes, contracts.components.length);
}

async function buildPrototypePlan(state, context, options) {
  const liveCheck = await readRecordedLiveCheck(state, context, true);
  const penFile = context.pencilTarget;
  const exportRecords = await resolveCanvasExportRecords(state.workspaceRoot, options.canvasExportPaths, "prototype");
  const pencilEvidence = await readPencilActionEvidence(state, context, options, "prototype", penFile, liveCheck, exportRecords);
  const screenModel = await readArtifactJson(state, context.artifactIndex, "canonical.screen-model");
  const interactionModel = await readArtifactJson(state, context.artifactIndex, "canonical.interaction-model");
  const stateMatrix = await readArtifactJson(state, context.artifactIndex, "canonical.screen-state-matrix");
  const wireframes = await readArtifactJson(state, context.artifactIndex, "pencil.wireframe-set");
  const tokens = await readArtifactJson(state, context.artifactIndex, "design-system.tokens");
  const contracts = await readArtifactJson(state, context.artifactIndex, "design-system.contracts");
  const evidenceBindings = normalizeCanvasEvidence(pencilEvidence, "prototype", screenModel, penFile, liveCheck, exportRecords);
  const output = buildPrototypeMetadata({
    options,
    selectedReferences: context.selectedReferences,
    liveCheck,
    penFile,
    exportRecords,
    evidenceBindings,
    screenModel,
    interactionModel,
    stateMatrix,
    wireframes,
    tokens,
    contracts
  });
  const exportOutput = buildCanvasExportArtifact("prototype.canvas-exports", options, context, exportRecords, liveCheck, evidenceBindings);
  const inputHash = sha256([
    formatJson(context.selectedReferences.summary),
    formatJson(liveCheck),
    formatJson(evidenceBindings.summary),
    formatJson(exportRecords),
    formatJson(screenModel),
    formatJson(interactionModel),
    formatJson(stateMatrix),
    formatJson(wireframes),
    formatJson(tokens),
    formatJson(contracts)
  ].join("\n"));
  const nextState = buildNextState(state, options, ["prototype.package", "prototype.canvas-exports"], ["prototype.generation"], inputHash, [
    "Prototype metadata and canvas export path records were persisted from real Pencil MCP canvas evidence.",
    "No frontend handoff or implementation files were generated."
  ]);
  const writes = [
    await buildArtifactWrite(state, context.artifactIndex, "prototype.package", formatJson(output)),
    await buildArtifactWrite(state, context.artifactIndex, "prototype.canvas-exports", formatJson(exportOutput)),
    await buildStateWrite(state, nextState)
  ].flat();

  return buildPlanObject(state, options, inputHash, writes, output.screens.length);
}

async function buildQaPlan(state, context, options) {
  const screenModel = await readArtifactJson(state, context.artifactIndex, "canonical.screen-model");
  const wireframes = await readArtifactJson(state, context.artifactIndex, "pencil.wireframe-set");
  const tokens = await readArtifactJson(state, context.artifactIndex, "design-system.tokens");
  const contracts = await readArtifactJson(state, context.artifactIndex, "design-system.contracts");
  const prototype = await readArtifactJson(state, context.artifactIndex, "prototype.package");
  const prototypeExports = await readArtifactJson(state, context.artifactIndex, "prototype.canvas-exports");
  const previousLog = await readOptionalArtifactJson(state, context.artifactIndex, "prototype.refinement-log");
  assertRefinementAttemptAllowed(previousLog, options.refinementAttempt);
  const qaReport = buildQaReport({
    options,
    selectedReferences: context.selectedReferences,
    screenModel,
    wireframes,
    tokens,
    contracts,
    prototype,
    prototypeExports
  });
  const refinementLog = buildRefinementLog(options, previousLog, qaReport);
  const inputHash = sha256([
    formatJson(context.selectedReferences.summary),
    formatJson(screenModel),
    formatJson(wireframes),
    formatJson(tokens),
    formatJson(contracts),
    formatJson(prototype),
    formatJson(prototypeExports),
    formatJson(previousLog || {})
  ].join("\n"));
  const gateOverrides = qaGateOverrides(options.qaStatus, options.refinementAttempt);
  const nextState = buildNextState(state, options, ["prototype.visual-qa-report", "prototype.refinement-log"], ["prototype.visual-qa", "prototype.refinement"], inputHash, [
    "Semantic visual QA and the max-two-refinement gate were persisted.",
    "QA records compare selected-reference, Pencil, design-system, and prototype metadata; they do not fake canvas output."
  ], gateOverrides);
  const writes = [
    await buildArtifactWrite(state, context.artifactIndex, "prototype.visual-qa-report", formatJson(qaReport)),
    await buildArtifactWrite(state, context.artifactIndex, "prototype.refinement-log", formatJson(refinementLog)),
    await buildStateWrite(state, nextState)
  ].flat();

  return buildPlanObject(state, options, inputHash, writes, qaReport.checks.length);
}

async function readSelectedReferences(state, artifactIndex) {
  const gate = findGate(state.manifest, "visual.reference-selection");
  if (!gate || gate.status !== "approved") {
    throw new Error("visual.reference-selection must be approved before Stage 08 can run.");
  }

  const selection = await readArtifactJson(state, artifactIndex, "visual.reference-selection");
  if (!Array.isArray(selection.selectedReferenceIds) || selection.selectedReferenceIds.length === 0) {
    throw new Error("visual.reference-selection must contain selectedReferenceIds.");
  }
  if (!Array.isArray(selection.records) || selection.records.length === 0) {
    throw new Error("visual.reference-selection must contain selected records.");
  }

  const records = [];
  const imageRecords = [];
  for (const record of selection.records) {
    if (!record || record.selected !== true || !record.selectionApproval || record.selectionApproval.approved !== true) {
      throw new Error("Every selected visual reference record must have selected=true and selectionApproval.approved=true.");
    }
    records.push(record);
    const paths = Array.isArray(record.generatedOutputPaths)
      ? record.generatedOutputPaths
      : record.generatedOutputPath ? [record.generatedOutputPath] : [];
    for (const outputPath of paths) {
      imageRecords.push(await validateExistingOutputFile(state.workspaceRoot, outputPath, "selected visual reference"));
    }
  }

  if (imageRecords.length === 0) {
    throw new Error("Selected visual references must include at least one real generated output path.");
  }

  return {
    gateId: "visual.reference-selection",
    gateStatus: "approved",
    selectedReferenceIds: [...selection.selectedReferenceIds],
    records,
    imageRecords,
    summary: {
      selectedReferenceIds: [...selection.selectedReferenceIds],
      screenIds: uniqueStrings(records.map((record) => record.screenId)),
      imagePaths: imageRecords.map((record) => record.path)
    }
  };
}

function normalizeLiveCheckSource(source, penFile) {
  const sourceText = formatJson(source);
  const sourceName = String(source.source || source.mcpTool || source.tool || source.toolName || "");
  const status = source.status || (source.available === true ? "available" : "unavailable");
  const checkedAt = source.checkedAt || source.at || null;
  const declaredTarget = source.targetPenPath || source.pencilDocumentPath || source.documentPath || null;
  const evidenceType = source.evidenceType || null;
  const toolCalls = normalizeToolCalls(source.mcpToolCalls || source.toolCalls || []);
  const penEvidence = source.penFile || source.pencilDocument || {};
  const attestation = source.agentAttestation || {};

  if (status !== "available") {
    throw new Error("Pencil live-check source must report status available.");
  }
  if (evidenceType !== "pencil-mcp-live-check") {
    throw new Error("Pencil live-check source must use evidenceType pencil-mcp-live-check.");
  }
  if (!checkedAt || !ISO_LIKE_PATTERN.test(checkedAt)) {
    throw new Error("Pencil live-check source must include an ISO-like checkedAt timestamp.");
  }
  if (!toolCalls.includes("get_editor_state")) {
    throw new Error("Pencil live-check source must include a get_editor_state MCP tool call.");
  }
  if (declaredTarget !== penFile.path) {
    throw new Error(`Pencil live-check target must match ${penFile.path}.`);
  }
  if (penEvidence.path && penEvidence.path !== penFile.path) {
    throw new Error("Pencil live-check source penFile.path must match the target .pen path.");
  }
  if (attestation.usedActivePencilMcp !== true) {
    throw new Error("Pencil live-check source must attest that active Pencil MCP was used.");
  }

  return {
    status: "available",
    checkedAt,
    source: sourceName || "pencil.get_editor_state",
    evidenceType,
    targetPenPath: penFile.path,
    toolCalls,
    penFile: {
      path: penFile.path,
      ownership: penFile.ownership,
      persistence: penFile.persistence,
      onDiskFileRequired: false
    },
    agentAttestation: {
      usedActivePencilMcp: true,
      targetFilePathValidated: attestation.targetFilePathValidated !== false,
      checkedAt
    },
    evidenceHash: sha256(sourceText),
    summary: source.summary || source.editorStateSummary || null
  };
}

async function readPencilActionEvidence(state, context, options, role, penFile, liveCheck, exportRecords) {
  if (!options.pencilEvidencePath) {
    throw new Error(`--pencil-evidence-path is required for --action ${role === "wireframe" ? "wireframes" : "prototype"}.`);
  }

  const evidencePath = resolveWorkspacePath(state.workspaceRoot, options.pencilEvidencePath, "Pencil action evidence path");
  const evidence = await readJsonFile(evidencePath.absolutePath);
  return {
    path: evidencePath.path,
    evidence,
    expected: {
      role,
      penFile,
      liveCheckEvidenceHash: liveCheck.liveCheck.evidenceHash,
      exportPaths: exportRecords.map((record) => record.path)
    }
  };
}

function normalizeCanvasEvidence(input, role, screenModel, penFile, liveCheck, exportRecords) {
  const evidence = input.evidence;
  const sourceText = formatJson(evidence);
  const evidenceType = evidence.evidenceType || null;
  const expectedEvidenceType = role === "wireframe"
    ? "pencil-mcp-wireframe-generation"
    : "pencil-mcp-prototype-generation";
  const toolCalls = normalizeToolCalls(evidence.mcpToolCalls || evidence.toolCalls || []);
  const toolCallRecords = normalizeToolCallRecords(evidence.mcpToolCalls || evidence.toolCalls || []);
  const frames = Array.isArray(evidence.frames) ? evidence.frames : [];
  const exports = Array.isArray(evidence.exports) ? evidence.exports : [];
  const penEvidence = evidence.penFile || evidence.pencilDocument || {};
  const attestation = evidence.agentAttestation || {};
  const screens = Array.isArray(screenModel.screens) ? screenModel.screens : [];
  const screenIds = screens.map((screen) => screen.id);
  const batchDesignEvidence = normalizeBatchDesignEvidence(evidence, toolCallRecords, penFile.path);
  const exportNodesEvidence = normalizeExportNodesEvidence(evidence, toolCallRecords, penFile.path);

  if (evidenceType !== expectedEvidenceType) {
    throw new Error(`Pencil action evidence must use evidenceType ${expectedEvidenceType}.`);
  }
  if (evidence.targetPenPath !== penFile.path) {
    throw new Error(`Pencil action evidence targetPenPath must match ${penFile.path}.`);
  }
  if (evidence.liveCheckEvidenceHash !== liveCheck.liveCheck.evidenceHash) {
    throw new Error("Pencil action evidence must reference the recorded live-check evidence hash.");
  }
  if (!toolCalls.includes("batch_design")) {
    throw new Error("Pencil action evidence must include a batch_design MCP tool call.");
  }
  if (!toolCalls.includes("export_nodes")) {
    throw new Error("Pencil action evidence must include an export_nodes MCP tool call.");
  }
  if (penEvidence.path && penEvidence.path !== penFile.path) {
    throw new Error("Pencil action evidence penFile path must match the target .pen path.");
  }
  if (attestation.usedActivePencilMcp !== true || attestation.createdCanvasNodes !== true || attestation.exportedCanvasNodes !== true) {
    throw new Error("Pencil action evidence must attest that active Pencil MCP created and exported canvas nodes.");
  }
  if (frames.length < screenIds.length) {
    throw new Error("Pencil action evidence must include one frame record for every canonical screen.");
  }

  const framesByScreen = new Map();
  for (const frame of frames) {
    if (!frame || typeof frame.screenId !== "string" || typeof frame.nodeId !== "string") {
      throw new Error("Every Pencil evidence frame must include screenId and nodeId.");
    }
    if (frame.nodeType !== "frame") {
      throw new Error(`Pencil evidence frame for ${frame.screenId} must have nodeType frame.`);
    }
    if (frame.createdByMcp !== true) {
      throw new Error(`Pencil evidence frame for ${frame.screenId} must have createdByMcp=true.`);
    }
    if (!batchDesignEvidence.createdNodeIds.includes(frame.nodeId)) {
      throw new Error(`Pencil evidence frame ${frame.nodeId} for ${frame.screenId} is not listed in batch_design created node ids.`);
    }
    if (framesByScreen.has(frame.screenId)) {
      throw new Error(`Duplicate Pencil evidence frame for screen ${frame.screenId}.`);
    }
    framesByScreen.set(frame.screenId, frame);
  }

  for (const screenId of screenIds) {
    if (!framesByScreen.has(screenId)) {
      throw new Error(`Pencil action evidence is missing a frame for canonical screen ${screenId}.`);
    }
  }

  const exportsByPath = new Map();
  for (const item of exports) {
    if (!item || typeof item.path !== "string" || typeof item.nodeId !== "string") {
      throw new Error("Every Pencil evidence export must include path and nodeId.");
    }
    exportsByPath.set(item.path, item);
  }

  for (const exportRecord of exportRecords) {
    const evidenceExport = exportsByPath.get(exportRecord.path);
    if (!evidenceExport) {
      throw new Error(`Pencil action evidence is missing export path ${exportRecord.path}.`);
    }
    if (evidenceExport.sha256 !== exportRecord.sha256 || evidenceExport.bytes !== exportRecord.bytes) {
      throw new Error(`Pencil action evidence export hash/bytes do not match ${exportRecord.path}.`);
    }
    if (!frames.some((frame) => frame.nodeId === evidenceExport.nodeId)) {
      throw new Error(`Pencil action evidence export ${exportRecord.path} does not reference a recorded frame node.`);
    }
    if (!exportNodesEvidence.nodeIds.includes(evidenceExport.nodeId)) {
      throw new Error(`Pencil action evidence export ${exportRecord.path} node ${evidenceExport.nodeId} is not listed in export_nodes node ids.`);
    }
  }

  const frameBindings = screenIds.map((screenId) => {
    const frame = framesByScreen.get(screenId);
    const boundExports = exports.filter((item) => item.nodeId === frame.nodeId).map((item) => item.path);
    if (boundExports.length === 0) {
      throw new Error(`Pencil action evidence frame ${frame.nodeId} for ${screenId} has no matching export.`);
    }
    return {
      screenId,
      nodeId: frame.nodeId,
      nodeName: frame.nodeName || frame.name || screenId,
      exportPaths: boundExports
    };
  });

  return {
    path: input.path,
    evidenceType,
    evidenceHash: sha256(sourceText),
    toolCalls,
    penFile: {
      path: penFile.path,
      ownership: penFile.ownership,
      persistence: penFile.persistence,
      onDiskFileRequired: false
    },
    batchDesign: batchDesignEvidence,
    exportNodes: exportNodesEvidence,
    frameBindings,
    exportBindings: exportRecords.map((record) => {
      const evidenceExport = exportsByPath.get(record.path);
      const binding = frameBindings.find((candidate) => candidate.nodeId === evidenceExport.nodeId);
      if (!binding) {
        throw new Error(`Pencil action evidence export ${record.path} is not bound to a canonical screen frame.`);
      }
      return {
        ...record,
        pencilNodeId: evidenceExport.nodeId,
        screenId: binding.screenId
      };
    }),
    summary: {
      evidencePath: input.path,
      evidenceType,
      evidenceHash: sha256(sourceText),
      frameCount: frameBindings.length,
      exportCount: exportRecords.length,
      batchDesignCreatedNodeIds: batchDesignEvidence.createdNodeIds,
      exportNodesNodeIds: exportNodesEvidence.nodeIds,
      screenIds
    }
  };
}

function normalizeToolCalls(calls) {
  const values = Array.isArray(calls) ? calls : [];
  return values.map((call) => {
    if (typeof call === "string") {
      return call.split(".").pop();
    }
    if (call && typeof call.name === "string") {
      return call.name.split(".").pop();
    }
    if (call && typeof call.tool === "string") {
      return call.tool.split(".").pop();
    }
    return "";
  }).filter(Boolean);
}

function normalizeToolCallRecords(calls) {
  const values = Array.isArray(calls) ? calls : [];
  return values.map((call) => {
    if (typeof call === "string") {
      return {
        name: call.split(".").pop(),
        raw: call
      };
    }
    if (call && typeof call === "object") {
      return {
        name: String(call.name || call.tool || call.mcpTool || call.toolName || "").split(".").pop(),
        raw: call
      };
    }
    return {
      name: "",
      raw: call
    };
  }).filter((call) => call.name);
}

function normalizeBatchDesignEvidence(evidence, toolCallRecords, targetPenPath) {
  const source = evidence.batchDesign || findToolCallRecord(toolCallRecords, "batch_design")?.raw;
  if (!source || typeof source !== "object") {
    throw new Error("Pencil action evidence must include detailed batchDesign evidence with filePath and created frame ids.");
  }

  const filePath = readOperationPath(source);
  if (filePath !== targetPenPath) {
    throw new Error(`batch_design evidence filePath must match ${targetPenPath}.`);
  }

  const createdNodeIds = uniqueStrings(readOperationNodeIds(source));
  if (createdNodeIds.length === 0) {
    throw new Error("batch_design evidence must include created frame/node ids.");
  }

  return {
    tool: "batch_design",
    filePath,
    createdNodeIds
  };
}

function normalizeExportNodesEvidence(evidence, toolCallRecords, targetPenPath) {
  const source = evidence.exportNodes || findToolCallRecord(toolCallRecords, "export_nodes")?.raw;
  if (!source || typeof source !== "object") {
    throw new Error("Pencil action evidence must include detailed exportNodes evidence with filePath and node ids.");
  }

  const filePath = readOperationPath(source);
  if (filePath !== targetPenPath) {
    throw new Error(`export_nodes evidence filePath must match ${targetPenPath}.`);
  }

  const nodeIds = uniqueStrings(readOperationNodeIds(source));
  if (nodeIds.length === 0) {
    throw new Error("export_nodes evidence must include exported node ids.");
  }

  return {
    tool: "export_nodes",
    filePath,
    nodeIds,
    outputPaths: uniqueStrings(readOperationOutputPaths(source))
  };
}

function findToolCallRecord(records, toolName) {
  return records.find((record) => record.name === toolName) || null;
}

function readOperationPath(value) {
  return firstString(
    value.filePath,
    value.path,
    value.targetPenPath,
    value.arguments?.filePath,
    value.args?.filePath,
    value.input?.filePath,
    value.parameters?.filePath,
    value.request?.filePath
  );
}

function readOperationNodeIds(value) {
  return [
    ...stringArray(value.nodeIds),
    ...stringArray(value.createdNodeIds),
    ...stringArray(value.createdFrameIds),
    ...stringArray(value.exportedNodeIds),
    ...stringArray(value.arguments?.nodeIds),
    ...stringArray(value.args?.nodeIds),
    ...stringArray(value.input?.nodeIds),
    ...stringArray(value.parameters?.nodeIds),
    ...stringArray(value.request?.nodeIds),
    ...stringArray(value.result?.nodeIds),
    ...stringArray(value.result?.createdNodeIds),
    ...stringArray(value.result?.createdFrameIds),
    ...objectArrayNodeIds(value.frames),
    ...objectArrayNodeIds(value.createdFrames),
    ...objectArrayNodeIds(value.result?.frames),
    ...objectArrayNodeIds(value.result?.createdFrames)
  ];
}

function readOperationOutputPaths(value) {
  return [
    ...stringArray(value.outputPaths),
    ...stringArray(value.paths),
    ...stringArray(value.result?.outputPaths),
    ...stringArray(value.result?.paths),
    ...objectArrayPaths(value.exports),
    ...objectArrayPaths(value.result?.exports)
  ];
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) || null;
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.length > 0) : [];
}

function objectArrayNodeIds(value) {
  return Array.isArray(value)
    ? value.map((item) => item && (item.nodeId || item.id)).filter((item) => typeof item === "string" && item.length > 0)
    : [];
}

function objectArrayPaths(value) {
  return Array.isArray(value)
    ? value.map((item) => item && (item.path || item.outputPath)).filter((item) => typeof item === "string" && item.length > 0)
    : [];
}

async function readRecordedLiveCheck(state, context, requireApprovedGate) {
  if (requireApprovedGate) {
    const gate = findGate(state.manifest, "pencil.live-check");
    if (!gate || gate.status !== "approved") {
      throw new Error("pencil.live-check gate must be approved before Pencil-derived actions can be recorded.");
    }
  }

  const artifact = context.artifactIndex.get("pencil.live-check");
  if (!artifact || artifact.generated !== true) {
    throw new Error("pencil.live-check artifact must be marked generated before Pencil-derived actions.");
  }
  const recorded = await readArtifactJson(state, context.artifactIndex, "pencil.live-check");
  if (!recorded.liveCheck || recorded.liveCheck.status !== "available") {
    throw new Error("Recorded Pencil live-check must report available.");
  }
  if (recorded.liveCheck.evidenceType !== "pencil-mcp-live-check") {
    throw new Error("Recorded Pencil live-check must use Pencil MCP evidence.");
  }
  if (!recorded.pencilTarget || recorded.pencilTarget.path !== context.pencilTarget.path) {
    throw new Error(`Recorded Pencil live-check must target ${context.pencilTarget.path}.`);
  }
  if (!recorded.liveCheck.penFile || recorded.liveCheck.penFile.path !== context.pencilTarget.path) {
    throw new Error("Recorded Pencil live-check must include matching penFile metadata.");
  }
  return recorded;
}

function buildWireframeMetadata(input) {
  const screens = Array.isArray(input.screenModel.screens) ? input.screenModel.screens : [];
  const transitions = Array.isArray(input.interactionModel.transitions) ? input.interactionModel.transitions : [];
  const stateRows = Array.isArray(input.stateMatrix.matrix) ? input.stateMatrix.matrix : [];

  return {
    schemaVersion: 1,
    stage: STAGE,
    artifactId: "pencil.wireframe-set",
    generatedBy: buildRecordMeta(input.options),
    sourceArtifacts: [
      "canonical.screen-model",
      "canonical.interaction-model",
      "canonical.screen-state-matrix",
      "visual.reference-selection",
      "pencil.live-check"
    ],
    selectedReferenceGate: selectedReferenceGateRecord(input.selectedReferences),
    pencilTarget: input.penFile,
    liveCheckArtifactId: "pencil.live-check",
    canvasExportArtifactId: "pencil.canvas-exports",
    pencilEvidence: input.evidenceBindings.summary,
    screens: screens.map((screen) => {
      const stateRow = stateRows.find((row) => row.screenId === screen.id) || {};
      const relatedTransitions = transitions
        .filter((transition) => transition.from === screen.id || transition.to === screen.id)
        .map((transition) => transition.id);
      const binding = input.evidenceBindings.frameBindings.find((entry) => entry.screenId === screen.id);
      const cliFrameId = input.frameMap.get(screen.id);
      if (cliFrameId && cliFrameId !== binding.nodeId) {
        throw new Error(`--pencil-frame-id for ${screen.id} does not match Pencil evidence node ${binding.nodeId}.`);
      }
      return {
        screenId: screen.id,
        screenName: screen.name,
        route: screen.route || null,
        priority: screen.priority || null,
        pencilFrameId: binding.nodeId,
        pencilFrameName: binding.nodeName,
        stateNames: Array.isArray(stateRow.states) ? stateRow.states.map((state) => state.name) : [],
        transitionIds: relatedTransitions,
        canvasExportPaths: binding.exportPaths
      };
    }),
    notes: [
      "Pencil frame ids are recorded only when supplied by the active Pencil agent.",
      "Canvas export paths are validated existing files; this script does not create canvas output."
    ]
  };
}

function buildCanvasExportArtifact(artifactId, options, context, exportRecords, liveCheck, evidenceBindings) {
  return {
    schemaVersion: 1,
    stage: STAGE,
    artifactId,
    generatedBy: buildRecordMeta(options),
    sourceArtifacts: [
      "visual.reference-selection",
      "pencil.live-check"
    ],
    selectedReferenceGate: selectedReferenceGateRecord(context.selectedReferences),
    pencilTarget: context.pencilTarget,
    liveCheckRecordId: liveCheck.liveCheck ? liveCheck.liveCheck.evidenceHash : null,
    pencilEvidence: evidenceBindings.summary,
    records: evidenceBindings.exportBindings
  };
}

function buildPrimitiveInventory(options, selectedReferences, brandDirection) {
  const brand = brandDirection.brand || {};
  const attributes = Array.isArray(brand.attributes) && brand.attributes.length > 0
    ? brand.attributes
    : ["clear", "credible", "focused"];
  const colors = buildColorPrimitives(attributes);
  const type = [
    {
      id: "primitive.type.family.ui",
      value: "system-ui",
      role: "Primary UI text family"
    },
    {
      id: "primitive.type.scale.compact",
      value: [12, 14, 16, 20, 24, 32],
      role: "Responsive app scale without viewport-based font sizing"
    }
  ];
  const spacing = [4, 8, 12, 16, 24, 32].map((value) => ({
    id: `primitive.space.${value}`,
    value,
    unit: "px"
  }));
  const radii = [0, 4, 8].map((value) => ({
    id: `primitive.radius.${value}`,
    value,
    unit: "px"
  }));

  return {
    schemaVersion: 1,
    stage: STAGE,
    artifactId: "design-system.primitives",
    generatedBy: buildRecordMeta(options),
    sourceArtifacts: [
      "canonical.brand-direction",
      "visual.reference-selection"
    ],
    selectedReferenceGate: selectedReferenceGateRecord(selectedReferences),
    derivation: {
      method: "deterministic-metadata",
      note: "Primitives are derived from canonical brand direction and selected visual reference records; no image pixels are sampled."
    },
    colorPrimitives: colors,
    typePrimitives: type,
    spacingPrimitives: spacing,
    radiusPrimitives: radii,
    referenceBindings: selectedReferences.records.map((record) => ({
      referenceId: record.id,
      screenId: record.screenId,
      screenName: record.screenName,
      imagePaths: Array.isArray(record.generatedOutputPaths) ? record.generatedOutputPaths : [record.generatedOutputPath].filter(Boolean)
    })),
    primitiveCounts: {
      colors: colors.length,
      type: type.length,
      spacing: spacing.length,
      radii: radii.length,
      total: colors.length + type.length + spacing.length + radii.length
    }
  };
}

function buildColorPrimitives(attributes) {
  const palette = {
    clear: "#245D7B",
    credible: "#2F5D50",
    focused: "#7A5A20",
    trustworthy: "#245D7B",
    efficient: "#59632E",
    approachable: "#8A4F6B",
    premium: "#5E527C",
    technical: "#305B6E",
    calm: "#496A63"
  };
  const picked = uniqueStrings(attributes).slice(0, 4).map((attribute, index) => ({
    id: `primitive.color.brand.${String(index + 1).padStart(2, "0")}`,
    name: attribute,
    value: palette[attribute] || palette.clear,
    sourceAttribute: attribute
  }));

  return [
    ...picked,
    {
      id: "primitive.color.surface.default",
      name: "surface-default",
      value: "#F7F8FA",
      sourceAttribute: "surface"
    },
    {
      id: "primitive.color.text.default",
      name: "text-default",
      value: "#1F2933",
      sourceAttribute: "text"
    },
    {
      id: "primitive.color.border.default",
      name: "border-default",
      value: "#D4DAE2",
      sourceAttribute: "border"
    }
  ];
}

function buildDesignSystemArtifacts(options, primitives, screenModel, wireframes, selectedReferences) {
  const primaryColor = findPrimitiveValue(primitives.colorPrimitives, "primitive.color.brand.01", "#245D7B");
  const surfaceColor = findPrimitiveValue(primitives.colorPrimitives, "primitive.color.surface.default", "#F7F8FA");
  const textColor = findPrimitiveValue(primitives.colorPrimitives, "primitive.color.text.default", "#1F2933");
  const screens = Array.isArray(screenModel.screens) ? screenModel.screens : [];
  const wireframeScreens = Array.isArray(wireframes.screens) ? wireframes.screens : [];
  const tokens = {
    schemaVersion: 1,
    stage: STAGE,
    artifactId: "design-system.tokens",
    generatedBy: buildRecordMeta(options),
    sourceArtifacts: [
      "design-system.primitives",
      "visual.reference-selection",
      "pencil.wireframe-set"
    ],
    selectedReferenceGate: selectedReferenceGateRecord(selectedReferences),
    semanticTokens: {
      color: {
        actionPrimary: primaryColor,
        surfaceDefault: surfaceColor,
        textDefault: textColor,
        borderDefault: findPrimitiveValue(primitives.colorPrimitives, "primitive.color.border.default", "#D4DAE2")
      },
      typography: {
        bodyFamily: "system-ui",
        bodySize: 14,
        headingSize: 24
      },
      spacing: {
        controlGap: 8,
        sectionGap: 24,
        pageInset: 32
      },
      radius: {
        control: 4,
        panel: 8
      }
    },
    componentTokenBindings: screens.map((screen) => ({
      screenId: screen.id,
      screenName: screen.name,
      frameRecorded: wireframeScreens.some((entry) => entry.screenId === screen.id),
      tokens: ["color.actionPrimary", "color.surfaceDefault", "typography.bodyFamily", "spacing.sectionGap"]
    }))
  };
  const contracts = {
    schemaVersion: 1,
    stage: STAGE,
    artifactId: "design-system.contracts",
    generatedBy: buildRecordMeta(options),
    sourceArtifacts: [
      "design-system.tokens",
      "canonical.screen-model",
      "pencil.wireframe-set"
    ],
    selectedReferenceGate: selectedReferenceGateRecord(selectedReferences),
    components: buildComponentContracts(screens, wireframes),
    constraints: [
      "Components describe design-system contracts only; no frontend implementation is generated in Stage 08.",
      "Token names must be stable across Pencil refinements unless user-approved changes are recorded."
    ]
  };

  return {
    tokens,
    contracts
  };
}

function buildComponentContracts(screens, wireframes) {
  const screenIds = new Set((Array.isArray(wireframes.screens) ? wireframes.screens : []).map((screen) => screen.screenId));
  const base = [
    {
      id: "component.app-shell",
      role: "Global navigation and page container",
      requiredTokens: ["color.surfaceDefault", "color.textDefault", "spacing.pageInset"],
      requiredStates: ["default", "loading", "error"]
    },
    {
      id: "component.primary-action",
      role: "Main action control",
      requiredTokens: ["color.actionPrimary", "typography.bodyFamily", "radius.control"],
      requiredStates: ["default", "hover", "disabled", "loading"]
    }
  ];
  const screenContracts = screens.map((screen) => ({
    id: `component.screen.${screen.id.replace(/^screen\./, "").replace(/[^a-z0-9.-]/g, "-")}`,
    role: `Screen contract for ${screen.name}`,
    screenId: screen.id,
    wireframeRecorded: screenIds.has(screen.id),
    requiredTokens: ["color.surfaceDefault", "color.textDefault", "spacing.sectionGap"],
    requiredStates: ["default", "loading", "empty", "error"]
  }));
  return [...base, ...screenContracts];
}

function buildPrototypeMetadata(input) {
  const screens = Array.isArray(input.screenModel.screens) ? input.screenModel.screens : [];
  const transitions = Array.isArray(input.interactionModel.transitions) ? input.interactionModel.transitions : [];
  const stateRows = Array.isArray(input.stateMatrix.matrix) ? input.stateMatrix.matrix : [];
  const wireframeScreens = Array.isArray(input.wireframes.screens) ? input.wireframes.screens : [];

  return {
    schemaVersion: 1,
    stage: STAGE,
    artifactId: "prototype.package",
    generatedBy: buildRecordMeta(input.options),
    sourceArtifacts: [
      "canonical.screen-model",
      "canonical.interaction-model",
      "canonical.screen-state-matrix",
      "pencil.wireframe-set",
      "pencil.canvas-exports",
      "design-system.tokens",
      "design-system.contracts",
      "visual.reference-selection"
    ],
    selectedReferenceGate: selectedReferenceGateRecord(input.selectedReferences),
    pencilTarget: input.penFile,
    liveCheckArtifactId: "pencil.live-check",
    canvasExportArtifactId: "prototype.canvas-exports",
    tokenArtifactId: "design-system.tokens",
    contractArtifactId: "design-system.contracts",
    pencilEvidence: input.evidenceBindings.summary,
    screens: screens.map((screen) => {
      const stateRow = stateRows.find((row) => row.screenId === screen.id) || {};
      const wireframe = wireframeScreens.find((entry) => entry.screenId === screen.id) || {};
      const binding = input.evidenceBindings.frameBindings.find((entry) => entry.screenId === screen.id);
      return {
        screenId: screen.id,
        screenName: screen.name,
        route: screen.route || null,
        wireframeFrameId: wireframe.pencilFrameId || null,
        pencilFrameId: binding.nodeId,
        pencilFrameName: binding.nodeName,
        stateNames: Array.isArray(stateRow.states) ? stateRow.states.map((state) => state.name) : [],
        transitionIds: transitions
          .filter((transition) => transition.from === screen.id || transition.to === screen.id)
          .map((transition) => transition.id),
        tokenBindings: ["color.surfaceDefault", "color.textDefault", "spacing.sectionGap"],
        canvasExportPaths: binding.exportPaths
      };
    }),
    interactionBindings: transitions.map((transition) => ({
      transitionId: transition.id,
      from: transition.from,
      to: transition.to,
      trigger: transition.trigger || "unspecified",
      feedback: transition.feedback || "unspecified"
    })),
    constraints: [
      "Prototype metadata records Pencil canvas output and semantic bindings only.",
      "No frontend handoff or executable implementation is generated in Stage 08."
    ]
  };
}

function buildQaReport(input) {
  const screens = Array.isArray(input.screenModel.screens) ? input.screenModel.screens : [];
  const wireframeScreens = Array.isArray(input.wireframes.screens) ? input.wireframes.screens : [];
  const prototypeScreens = Array.isArray(input.prototype.screens) ? input.prototype.screens : [];
  const exportRecords = Array.isArray(input.prototypeExports.records) ? input.prototypeExports.records : [];
  const componentBindings = input.tokens.componentTokenBindings || [];
  const components = Array.isArray(input.contracts.components) ? input.contracts.components : [];
  const checks = [
    qaCheck("qa.selected-references", input.selectedReferences.records.length > 0, "Selected visual references are approved and available."),
    qaCheck("qa.wireframe-pencil-evidence", hasPencilEvidence(input.wireframes, "pencil-mcp-wireframe-generation"), "Wireframe metadata includes Pencil MCP frame/export evidence."),
    qaCheck("qa.prototype-pencil-evidence", hasPencilEvidence(input.prototype, "pencil-mcp-prototype-generation"), "Prototype metadata includes Pencil MCP frame/export evidence."),
    qaCheck("qa.wireframe-screen-coverage", screens.every((screen) => wireframeScreens.some((entry) => entry.screenId === screen.id)), "Every canonical screen has wireframe metadata."),
    qaCheck("qa.prototype-screen-coverage", screens.every((screen) => prototypeScreens.some((entry) => entry.screenId === screen.id)), "Every canonical screen has prototype metadata."),
    qaCheck("qa.design-token-bindings", componentBindings.length >= screens.length, "Design tokens are bound to canonical screens."),
    qaCheck("qa.component-contracts", components.length >= screens.length, "Component contracts cover app shell and screen contracts."),
    qaCheck("qa.canvas-export-records", exportRecords.length > 0 && exportRecords.every((record) => record.pencilNodeId && record.screenId), "Prototype canvas export records include Pencil node and screen bindings.")
  ];
  const structuralPass = checks.every((check) => check.status === "pass");
  const status = input.options.qaStatus === "pass" && !structuralPass ? "blocked" : input.options.qaStatus;

  return {
    schemaVersion: 1,
    stage: STAGE,
    artifactId: "prototype.visual-qa-report",
    generatedBy: buildRecordMeta(input.options),
    sourceArtifacts: [
      "visual.reference-selection",
      "pencil.wireframe-set",
      "design-system.tokens",
      "design-system.contracts",
      "prototype.package",
      "prototype.canvas-exports"
    ],
    selectedReferenceGate: selectedReferenceGateRecord(input.selectedReferences),
    qaStatus: status,
    refinementAttempt: input.options.refinementAttempt,
    maxRefinementAttempts: MAX_REFINEMENT_ATTEMPTS,
    checks,
    notes: uniqueStrings(input.options.qaNotes),
    gate: {
      visualQaGateId: "prototype.visual-qa",
      refinementGateId: "prototype.refinement",
      status: qaGateStatus(status, input.options.refinementAttempt),
      remainingRefinements: Math.max(0, MAX_REFINEMENT_ATTEMPTS - input.options.refinementAttempt)
    }
  };
}

function hasPencilEvidence(artifact, evidenceType) {
  return artifact
    && artifact.pencilEvidence
    && artifact.pencilEvidence.evidenceType === evidenceType
    && typeof artifact.pencilEvidence.evidenceHash === "string"
    && artifact.pencilEvidence.frameCount > 0
    && artifact.pencilEvidence.exportCount > 0;
}

function buildRefinementLog(options, previousLog, qaReport) {
  const previousAttempts = previousLog && Array.isArray(previousLog.attempts) ? previousLog.attempts : [];
  const current = {
    attempt: options.refinementAttempt,
    actor: options.actor || "plan",
    at: options.at || "plan",
    qaStatus: qaReport.qaStatus,
    visualQaReportId: "prototype.visual-qa-report",
    notes: uniqueStrings(options.qaNotes)
  };
  const attempts = [
    ...previousAttempts.filter((attempt) => attempt.attempt !== current.attempt),
    current
  ].sort((left, right) => left.attempt - right.attempt);

  if (attempts.length > MAX_REFINEMENT_ATTEMPTS + 1) {
    throw new Error(`Refinement log may not contain more than attempts 0 through ${MAX_REFINEMENT_ATTEMPTS}.`);
  }

  return {
    schemaVersion: 1,
    stage: STAGE,
    artifactId: "prototype.refinement-log",
    generatedBy: buildRecordMeta(options),
    sourceArtifacts: [
      "prototype.visual-qa-report"
    ],
    refinementGate: {
      gateId: "prototype.refinement",
      maxAttempts: MAX_REFINEMENT_ATTEMPTS,
      currentAttempt: options.refinementAttempt,
      status: qaGateStatus(qaReport.qaStatus, options.refinementAttempt),
      requiresUserGate: qaReport.qaStatus !== "pass" && options.refinementAttempt >= MAX_REFINEMENT_ATTEMPTS
    },
    attempts
  };
}

function qaCheck(id, passed, message) {
  return {
    id,
    status: passed ? "pass" : "fail",
    message
  };
}

function assertRefinementAttemptAllowed(previousLog, attempt) {
  if (attempt > MAX_REFINEMENT_ATTEMPTS) {
    throw new Error(`Stage 08 supports at most ${MAX_REFINEMENT_ATTEMPTS} refinement attempts.`);
  }
  if (!previousLog || !Array.isArray(previousLog.attempts)) {
    return;
  }
  const attempts = previousLog.attempts.filter((entry) => Number.isInteger(entry.attempt));
  if (attempts.some((entry) => entry.attempt > MAX_REFINEMENT_ATTEMPTS)) {
    throw new Error("Existing refinement log exceeds the Stage 08 max-two-refinement gate.");
  }
  const latest = attempts.reduce((max, entry) => Math.max(max, entry.attempt), -1);
  const latestStatus = attempts.find((entry) => entry.attempt === latest);
  if (latest >= MAX_REFINEMENT_ATTEMPTS && latestStatus && latestStatus.qaStatus !== "pass" && attempt > latest) {
    throw new Error("Refinement gate is blocked after two unsuccessful refinement attempts.");
  }
}

function qaGateOverrides(qaStatus, attempt) {
  const status = qaGateStatus(qaStatus, attempt);
  return {
    "prototype.visual-qa": status,
    "prototype.refinement": status
  };
}

function qaGateStatus(qaStatus, attempt) {
  if (qaStatus === "pass") {
    return "approved";
  }
  if (qaStatus === "blocked" || attempt >= MAX_REFINEMENT_ATTEMPTS) {
    return "blocked";
  }
  return "pending";
}

function buildNextState(state, options, artifactIds, gateIds, inputHash, notes, gateOverrides = {}) {
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
      status: gateOverrides[gateId] || "approved"
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

async function buildArtifactWrite(state, artifactIndex, artifactId, text) {
  const artifact = artifactIndex.get(artifactId);
  if (!artifact) {
    throw new Error(`Artifact graph is missing ${artifactId}.`);
  }
  const absolutePath = resolveAgainst(state.workspaceRoot, artifact.path);
  return buildWriteAction(artifactId, absolutePath, artifact.path, text);
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

async function readArtifactJson(state, artifactIndex, artifactId) {
  const artifact = artifactIndex.get(artifactId);
  if (!artifact) {
    throw new Error(`Artifact graph is missing ${artifactId}.`);
  }
  return readJsonFile(resolveAgainst(state.workspaceRoot, artifact.path));
}

async function readOptionalArtifactJson(state, artifactIndex, artifactId) {
  try {
    return await readArtifactJson(state, artifactIndex, artifactId);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function resolveCanvasExportRecords(workspaceRoot, inputPaths, role) {
  if (inputPaths.length === 0) {
    throw new Error(`--canvas-export-path is required for ${role} records.`);
  }
  const records = [];
  for (const inputPath of uniqueStrings(inputPaths)) {
    const file = await validateExistingOutputFile(workspaceRoot, inputPath, `${role} canvas export`);
    if (!["png", "jpeg", "webp", "pdf"].includes(file.fileType)) {
      throw new Error(`Canvas export path must be PNG, JPEG, WEBP, or PDF: ${inputPath}`);
    }
    records.push({
      id: `canvas.export.${sha256(file.path).slice(0, 16)}`,
      role,
      ...file
    });
  }
  return records.sort((left, right) => left.path.localeCompare(right.path));
}

async function validateExistingOutputFile(workspaceRoot, inputPath, label) {
  const resolved = resolveWorkspacePath(workspaceRoot, inputPath, label);
  let stat;
  try {
    stat = await fs.stat(resolved.absolutePath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error(`${label} does not exist: ${inputPath}`);
    }
    throw error;
  }
  if (!stat.isFile()) {
    throw new Error(`${label} is not a file: ${inputPath}`);
  }
  if (stat.size === 0) {
    throw new Error(`${label} is empty: ${inputPath}`);
  }

  const bytes = await fs.readFile(resolved.absolutePath);
  const fileType = detectFileType(bytes);
  if (!fileType) {
    throw new Error(`${label} is not a supported image or PDF by byte signature: ${inputPath}`);
  }
  return {
    path: resolved.path,
    bytes: stat.size,
    sha256: sha256(bytes),
    fileType: fileType.type,
    mimeType: fileType.mimeType,
    fileExtension: path.extname(resolved.absolutePath).toLowerCase() || null
  };
}

function detectFileType(bytes) {
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return { type: "png", mimeType: "image/png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { type: "jpeg", mimeType: "image/jpeg" };
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return { type: "webp", mimeType: "image/webp" };
  }
  if (bytes.length >= 4 && bytes.toString("ascii", 0, 4) === "%PDF") {
    return { type: "pdf", mimeType: "application/pdf" };
  }
  return null;
}

function validateAutodesignPenPath(workspaceRoot, penPath) {
  const resolved = resolveWorkspacePath(workspaceRoot, penPath, "Pencil document path");
  if (!resolved.path.startsWith("autodesign/outputs/pencil/")) {
    throw new Error("Pencil document path must be under autodesign/outputs/pencil/.");
  }
  if (path.extname(resolved.path).toLowerCase() !== ".pen") {
    throw new Error("Pencil document path must end in .pen.");
  }
  return {
    path: resolved.path,
    absolutePath: resolved.absolutePath,
    ownership: "autodesign-owned",
    persistence: "pencil-mcp-virtual-filePath",
    onDiskFileRequired: false
  };
}

function resolveWorkspacePath(workspaceRoot, inputPath, label) {
  const absolutePath = resolveAgainst(workspaceRoot, inputPath);
  const relativePath = relativeToWorkspace(workspaceRoot, absolutePath);
  if (relativePath === ".." || relativePath.startsWith("../") || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must be inside the workspace: ${inputPath}`);
  }
  return {
    path: relativePath,
    absolutePath
  };
}

function parseFrameIds(entries) {
  const map = new Map();
  for (const entry of entries) {
    const separator = entry.indexOf("=");
    if (separator <= 0 || separator === entry.length - 1) {
      throw new Error("--pencil-frame-id must use screen-id=frame-id.");
    }
    const screenId = entry.slice(0, separator);
    const frameId = entry.slice(separator + 1);
    map.set(screenId, frameId);
  }
  return map;
}

function selectedReferenceGateRecord(selectedReferences) {
  return {
    gateId: selectedReferences.gateId,
    status: selectedReferences.gateStatus,
    selectedReferenceIds: selectedReferences.selectedReferenceIds
  };
}

function buildRecordMeta(options) {
  return {
    script: SCRIPT_ID,
    action: options.action,
    actor: options.actor || "plan",
    at: options.at || "plan"
  };
}

function updateGate(manifest, gateId, update) {
  const gate = findGate(manifest, gateId);
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
  if (gateId === "pencil.live-check") {
    return "Pencil live check recorded from supplied get_editor_state evidence.";
  }
  if (gateId === "pencil.operations") {
    return "Pencil wireframe metadata and real canvas export records were persisted.";
  }
  if (gateId === "design-system.primitives") {
    return "Primitive inventory generated from selected references and canonical brand direction.";
  }
  if (gateId === "design-system.generation") {
    return "Design-system tokens and component contracts generated from primitives and Pencil metadata.";
  }
  if (gateId === "prototype.generation") {
    return "Prototype metadata and real canvas export path records were persisted.";
  }
  if (gateId === "prototype.visual-qa") {
    return "Semantic visual QA report generated for selected references, Pencil, DS, and prototype metadata.";
  }
  if (gateId === "prototype.refinement") {
    return "Max-two-refinement gate updated from the QA report.";
  }
  return `Stage 08 ${action} gate updated.`;
}

function findGate(manifest, gateId) {
  return (Array.isArray(manifest.approvalGates) ? manifest.approvalGates : [])
    .find((gate) => gate && gate.id === gateId) || null;
}

function findPrimitiveValue(primitives, id, fallback) {
  const primitive = Array.isArray(primitives) ? primitives.find((entry) => entry.id === id) : null;
  return primitive ? primitive.value : fallback;
}

function formatPlan(plan) {
  const lines = [
    "Autodesign Stage 08 plan",
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
    "Autodesign Stage 08 apply complete",
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

function resolveAgainst(root, maybeRelativePath) {
  return path.isAbsolute(maybeRelativePath) ? maybeRelativePath : path.resolve(root, maybeRelativePath);
}

function relativeToWorkspace(workspaceRoot, absolutePath) {
  return path.relative(workspaceRoot, absolutePath).split(path.sep).join("/");
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

main().catch((error) => {
  process.stderr.write(`autodesign generate-pencil-prototype error: ${error.message}\n`);
  process.exitCode = 1;
});
