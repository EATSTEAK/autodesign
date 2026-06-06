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
  validateState
} from "./lib/autodesign-state.mjs";

const STAGE = "07-visual-reference-gates";
const SCRIPT_ID = "scripts/generate-visual-references.mjs";
const ISO_LIKE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
const VALID_ACTIONS = new Set(["prompts", "candidates", "selection"]);
const VALID_REVIEW_STATUSES = new Set(["pending", "approved", "rejected", "needs-revision"]);

const USAGE = `Usage:
  node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace <workspace> --action prompts --plan
  node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace <workspace> --action prompts --apply --approve-visual-prompts --actor <actor> --at <timestamp>
  node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace <workspace> --action candidates --prompt-id <prompt-id> --generated-output-path <path> --plan
  node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace <workspace> --action candidates --prompt-id <prompt-id> --generated-output-path <path> --apply --approve-visual-candidates --actor <actor> --at <timestamp>
  node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace <workspace> --action selection --reference-id <candidate-id> --plan
  node autodesign-start/assets/payload/scripts/generate-visual-references.mjs --workspace <workspace> --action selection --reference-id <candidate-id> --apply --approve-visual-reference-selection --actor <actor> --at <timestamp>

Options:
  --workspace <workspace>                     Workspace root containing autodesign/manifest.json.
  --manifest <path>                           Optional manifest path, relative to workspace unless absolute.
  --graph <path>                              Optional graph path, relative to workspace unless absolute.
  --action <name>                             prompts, candidates, or selection. Default: prompts.
  --plan                                      Print planned writes without mutating files. This is the default mode.
  --apply                                     Write visual reference records and update manifest/graph state.
  --approve-visual-prompts                    Required with --apply --action prompts.
  --approve-visual-candidates                 Required with --apply --action candidates.
  --approve-visual-reference-selection        Required with --apply --action selection.
  --prompt-id <id>                            Prompt record id for candidate recording.
  --generated-output-path <path>              Existing generated image path for candidate recording. May repeat.
  --reference-id <id>                         Candidate record id for selected-reference approval. May repeat.
  --review-status <status>                    pending, approved, rejected, or needs-revision. Default: pending.
  --reviewer <actor>                          Optional reviewer recorded in review metadata.
  --reviewed-at <timestamp>                   Optional explicit ISO-like review timestamp.
  --review-note <text>                        Optional review note. May repeat.
  --note <text>                               Optional generation or approval note.
  --actor <actor>                             Required with --apply; records who authorized writes.
  --at <timestamp>                            Required with --apply; explicit ISO-like timestamp for deterministic records.
  --json                                      Print machine-readable JSON.
  --help                                      Print this help text.
`;

function parseOptions(argv) {
  const common = parseCommonOptions(argv);
  const options = {
    ...common,
    action: "prompts",
    mode: "plan",
    modeWasSet: false,
    approveVisualPrompts: false,
    approveVisualCandidates: false,
    approveVisualReferenceSelection: false,
    actor: null,
    at: null,
    promptId: null,
    generatedOutputPaths: [],
    referenceIds: [],
    reviewStatus: "pending",
    reviewer: null,
    reviewedAt: null,
    reviewNotes: [],
    note: "",
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

    if (arg === "--approve-visual-prompts") {
      options.approveVisualPrompts = true;
      continue;
    }

    if (arg === "--approve-visual-candidates") {
      options.approveVisualCandidates = true;
      continue;
    }

    if (arg === "--approve-visual-reference-selection") {
      options.approveVisualReferenceSelection = true;
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

    if (arg === "--prompt-id") {
      options.promptId = readArgValue(common.rest, index, "--prompt-id");
      index += 1;
      continue;
    }

    if (arg === "--generated-output-path") {
      options.generatedOutputPaths.push(readArgValue(common.rest, index, "--generated-output-path"));
      index += 1;
      continue;
    }

    if (arg === "--reference-id") {
      options.referenceIds.push(readArgValue(common.rest, index, "--reference-id"));
      index += 1;
      continue;
    }

    if (arg === "--review-status") {
      options.reviewStatus = readArgValue(common.rest, index, "--review-status");
      index += 1;
      continue;
    }

    if (arg === "--reviewer") {
      options.reviewer = readArgValue(common.rest, index, "--reviewer");
      index += 1;
      continue;
    }

    if (arg === "--reviewed-at") {
      options.reviewedAt = readArgValue(common.rest, index, "--reviewed-at");
      index += 1;
      continue;
    }

    if (arg === "--review-note") {
      options.reviewNotes.push(readArgValue(common.rest, index, "--review-note"));
      index += 1;
      continue;
    }

    if (arg === "--note") {
      options.note = readArgValue(common.rest, index, "--note");
      index += 1;
      continue;
    }

    options.rest.push(arg);
  }

  if (!VALID_ACTIONS.has(options.action)) {
    throw new Error(`Unknown --action: ${options.action}`);
  }

  if (!VALID_REVIEW_STATUSES.has(options.reviewStatus)) {
    throw new Error(`Invalid --review-status: ${options.reviewStatus}`);
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
  const plan = await buildVisualReferencePlan(state, options);

  if (options.mode === "plan") {
    process.stdout.write(options.json ? formatJson(plan) : formatPlan(plan));
    return;
  }

  const result = await applyPlan(plan);
  process.stdout.write(options.json ? formatJson(result) : formatApplyResult(result));
}

async function buildVisualReferencePlan(state, options) {
  const validation = validateState(state);
  if (!validation.valid) {
    throw new Error(`State validation failed before visual reference generation: ${validation.errors[0].path}: ${validation.errors[0].message}`);
  }

  const dependencyResult = checkDependencies(state.graph);
  if (!dependencyResult.valid) {
    throw new Error("Artifact graph dependencies must be valid before visual reference generation.");
  }

  if (state.manifest.disabledBehaviors.visualReferenceGeneration !== false) {
    throw new Error("manifest.disabledBehaviors.visualReferenceGeneration must be false for Stage 07 visual reference records.");
  }

  if (state.manifest.disabledBehaviors.imageGeneration !== false) {
    throw new Error("manifest.disabledBehaviors.imageGeneration must be false so the active agent can generate real images outside this script.");
  }

  await assertVisualSubskillCanRun(state);
  const context = await loadVisualContext(state);

  if (options.action === "prompts") {
    return buildPromptPlan(state, context, options);
  }

  if (options.action === "candidates") {
    return buildCandidatePlan(state, context, options);
  }

  return buildSelectionPlan(state, context, options);
}

function assertApplyAllowed(options) {
  if (!options.actor) {
    throw new Error("--actor is required with --apply.");
  }
  if (!options.at) {
    throw new Error("--at is required with --apply.");
  }
  if (!ISO_LIKE_PATTERN.test(options.at)) {
    throw new Error("--at must be an explicit ISO-like timestamp such as 2026-06-06T00:00:00Z.");
  }
  if (options.reviewedAt && !ISO_LIKE_PATTERN.test(options.reviewedAt)) {
    throw new Error("--reviewed-at must be an explicit ISO-like timestamp.");
  }

  if (options.action === "prompts" && !options.approveVisualPrompts) {
    throw new Error("--approve-visual-prompts is required with --apply --action prompts.");
  }
  if (options.action === "candidates" && !options.approveVisualCandidates) {
    throw new Error("--approve-visual-candidates is required with --apply --action candidates.");
  }
  if (options.action === "selection" && !options.approveVisualReferenceSelection) {
    throw new Error("--approve-visual-reference-selection is required with --apply --action selection.");
  }
}

async function assertVisualSubskillCanRun(state) {
  const result = await checkSubskillCanRun(state, "visuals");
  if (result.canRun) {
    return;
  }

  const details = result.errors
    .map((error) => `${error.check} ${error.path}: ${error.message}`)
    .join("; ");
  throw new Error(`Subskill visuals cannot run: ${details}`);
}

async function loadVisualContext(state) {
  const artifactIndex = buildArtifactIndex(state.graph);
  const requiredArtifactIds = [
    "canonical.brand-direction",
    "canonical.screen-model",
    "canonical.interaction-model",
    "canonical.visual-anchor-proposals",
    "visual.reference-prompts",
    "visual.reference-candidates",
    "visual.reference-selection",
    "visual.reference-set"
  ];
  const artifacts = {};

  for (const artifactId of requiredArtifactIds) {
    const artifact = artifactIndex.get(artifactId);
    if (!artifact) {
      throw new Error(`Artifact graph is missing ${artifactId}.`);
    }
    artifacts[artifactId] = {
      ...artifact,
      absolutePath: resolveAgainst(state.workspaceRoot, artifact.path)
    };
  }

  const anchorArtifact = artifacts["canonical.visual-anchor-proposals"];
  if (anchorArtifact.generated !== true) {
    throw new Error("canonical.visual-anchor-proposals must be marked generated before Stage 07 visual references.");
  }
  const anchorGeneratedRecord = (Array.isArray(state.manifest.generationRecords) ? state.manifest.generationRecords : [])
    .some((record) => record && Array.isArray(record.artifacts) && record.artifacts.includes("canonical.visual-anchor-proposals"));
  if (!anchorGeneratedRecord) {
    throw new Error("canonical.visual-anchor-proposals must have a generation record before Stage 07 visual references.");
  }

  const brand = await readJsonFile(artifacts["canonical.brand-direction"].absolutePath);
  const screenModel = await readJsonFile(artifacts["canonical.screen-model"].absolutePath);
  const interactionModel = await readJsonFile(artifacts["canonical.interaction-model"].absolutePath);
  const anchorProposals = await readJsonFile(anchorArtifact.absolutePath);

  if (!Array.isArray(anchorProposals.proposals) || anchorProposals.proposals.length === 0) {
    throw new Error("canonical.visual-anchor-proposals must contain at least one proposal.");
  }

  return {
    artifacts,
    brand,
    screenModel,
    interactionModel,
    anchorProposals
  };
}

async function buildPromptPlan(state, context, options) {
  const promptRecords = buildPromptRecords(context, options);
  const output = {
    schemaVersion: 1,
    stage: STAGE,
    artifactId: "visual.reference-prompts",
    generatedBy: buildRecordMeta(options),
    sourceArtifacts: [
      "canonical.brand-direction",
      "canonical.screen-model",
      "canonical.interaction-model",
      "canonical.visual-anchor-proposals"
    ],
    anchorApprovalGate: {
      gateId: "canonical.visual-anchor-selection",
      requiredForCandidateGeneration: true,
      status: findGateStatus(state.manifest, "canonical.visual-anchor-selection")
    },
    records: promptRecords
  };
  const inputHash = sha256([
    formatJson(context.brand),
    formatJson(context.screenModel),
    formatJson(context.interactionModel),
    formatJson(context.anchorProposals)
  ].join("\n"));
  const nextState = await buildNextState(state, options, ["visual.reference-prompts"], ["visual.reference-prompts"], inputHash, [
    "Prompt records were created from generated canonical visual anchor proposals.",
    "No image files were generated by this script."
  ]);
  const writes = [
    await buildWriteAction("visual.reference-prompts", context.artifacts["visual.reference-prompts"].absolutePath, context.artifacts["visual.reference-prompts"].path, formatJson(output)),
    await buildWriteAction("state.manifest", state.manifestPath, relativeToWorkspace(state.workspaceRoot, state.manifestPath), formatJson(nextState.manifest)),
    await buildWriteAction("state.artifact-graph", state.graphPath, relativeToWorkspace(state.workspaceRoot, state.graphPath), formatJson(nextState.graph))
  ];

  return buildPlanObject(state, options, inputHash, writes, promptRecords.length);
}

function buildPromptRecords(context, options) {
  const brand = context.brand.brand || {};
  const attributes = Array.isArray(brand.attributes) && brand.attributes.length > 0
    ? brand.attributes
    : ["clear", "trustworthy", "usable"];
  const principles = Array.isArray(brand.visualPrinciples) && brand.visualPrinciples.length > 0
    ? brand.visualPrinciples
    : ["Use the product screen as the primary subject."];
  const screens = Array.isArray(context.screenModel.screens) ? context.screenModel.screens : [];
  const transitions = Array.isArray(context.interactionModel.transitions) ? context.interactionModel.transitions : [];

  return context.anchorProposals.proposals.map((proposal) => {
    const screen = screens.find((candidate) => candidate.id === proposal.screenId) || {};
    const relatedTransitions = transitions
      .filter((transition) => transition.from === proposal.screenId || transition.to === proposal.screenId)
      .slice(0, 3)
      .map((transition) => `${transition.from} to ${transition.to}`);
    const promptText = [
      `Create one high-fidelity visual reference image for the ${proposal.screenName || screen.name || proposal.screenId} screen.`,
      `Use these brand attributes: ${attributes.slice(0, 5).join(", ")}.`,
      `Honor these visual principles: ${principles.slice(0, 4).join(" ")}`,
      `Show a concrete product interface for screen id ${proposal.screenId}; this is a visual reference, not final production UI.`,
      relatedTransitions.length > 0 ? `Reflect these interaction contexts: ${relatedTransitions.join("; ")}.` : "Keep the current task context visually clear.",
      "Avoid placeholder charts, illegible text, invented logos, or decorative-only scenes."
    ].join(" ");
    const id = `visual.prompt.${proposal.id.replace(/^visual-anchor\.proposal\./, "")}`;

    return {
      id,
      anchorProposalId: proposal.id,
      screenId: proposal.screenId,
      screenName: proposal.screenName || screen.name || proposal.screenId,
      promptText,
      activeAgentImageGenerationInstruction: [
        "Use the currently active image-generation capability to generate a real bitmap image from promptText.",
        "Do not hardcode or record an image model name.",
        `Save the generated image under autodesign/outputs/visual-references/generated/${id}.png or another explicit workspace path.`,
        "After generation, record the real file path with --action candidates and --generated-output-path."
      ].join(" "),
      generatedOutputPath: null,
      generatedOutputPaths: [],
      review: buildReviewMetadata(options, "visual.reference-candidate-generation"),
      createdBy: options.actor || "plan",
      createdAt: options.at || "plan"
    };
  });
}

async function buildCandidatePlan(state, context, options) {
  if (!isGateApproved(state.manifest, "canonical.visual-anchor-selection")) {
    throw new Error("canonical.visual-anchor-selection must be manually approved before candidate generation can apply.");
  }
  if (!options.promptId) {
    throw new Error("--prompt-id is required for --action candidates.");
  }
  if (options.generatedOutputPaths.length === 0) {
    throw new Error("--generated-output-path is required for --action candidates.");
  }

  const promptRecords = await readRequiredRecords(context.artifacts["visual.reference-prompts"].absolutePath, "visual.reference-prompts");
  const prompt = promptRecords.records.find((record) => record.id === options.promptId);
  if (!prompt) {
    throw new Error(`Unknown prompt id: ${options.promptId}`);
  }

  const resolvedOutputPaths = await resolveAndValidateGeneratedOutputPaths(state.workspaceRoot, options.generatedOutputPaths);
  const existingCandidates = await readOptionalRecords(context.artifacts["visual.reference-candidates"].absolutePath, "visual.reference-candidates");
  const candidateRecord = buildCandidateRecord(prompt, resolvedOutputPaths, options);
  const records = [
    ...existingCandidates.records.filter((record) => record.id !== candidateRecord.id),
    candidateRecord
  ].sort((left, right) => left.id.localeCompare(right.id));
  const output = {
    schemaVersion: 1,
    stage: STAGE,
    artifactId: "visual.reference-candidates",
    generatedBy: buildRecordMeta(options),
    sourceArtifacts: [
      "visual.reference-prompts"
    ],
    anchorApprovalGate: {
      gateId: "canonical.visual-anchor-selection",
      required: true,
      status: "approved"
    },
    records
  };
  const inputHash = sha256([
    formatJson(promptRecords),
    formatJson(resolvedOutputPaths),
    formatJson(existingCandidates)
  ].join("\n"));
  const nextState = await buildNextState(state, options, ["visual.reference-candidates"], ["image.generation", "visual.reference-candidate-generation"], inputHash, [
    "Candidate records persisted prompt text, active-agent image-generation instruction, real generated output paths, and review metadata.",
    "Generated output paths were validated as existing image files.",
    "No image files were generated by this script."
  ]);
  const writes = [
    await buildWriteAction("visual.reference-candidates", context.artifacts["visual.reference-candidates"].absolutePath, context.artifacts["visual.reference-candidates"].path, formatJson(output)),
    await buildWriteAction("state.manifest", state.manifestPath, relativeToWorkspace(state.workspaceRoot, state.manifestPath), formatJson(nextState.manifest)),
    await buildWriteAction("state.artifact-graph", state.graphPath, relativeToWorkspace(state.workspaceRoot, state.graphPath), formatJson(nextState.graph))
  ];

  return buildPlanObject(state, options, inputHash, writes, 1);
}

function buildCandidateRecord(prompt, outputPaths, options) {
  const seed = {
    promptId: prompt.id,
    outputPaths: outputPaths.map((entry) => entry.path)
  };
  const id = `visual.candidate.${sha256(formatJson(seed)).slice(0, 16)}`;

  return {
    id,
    promptRecordId: prompt.id,
    anchorProposalId: prompt.anchorProposalId,
    screenId: prompt.screenId,
    screenName: prompt.screenName,
    promptText: prompt.promptText,
    activeAgentImageGenerationInstruction: prompt.activeAgentImageGenerationInstruction,
    generatedOutputPath: outputPaths[0].path,
    generatedOutputPaths: outputPaths.map((entry) => entry.path),
    generatedOutputMetadata: outputPaths,
    selected: false,
    selectionApproval: {
      approved: false,
      gateId: "visual.reference-selection",
      note: "This candidate is not selected until --approve-visual-reference-selection is applied with its reference id."
    },
    review: buildReviewMetadata(options, "visual.reference-selection"),
    createdBy: options.actor || "plan",
    createdAt: options.at || "plan"
  };
}

async function buildSelectionPlan(state, context, options) {
  if (options.referenceIds.length === 0) {
    throw new Error("--reference-id is required for --action selection. The script never auto-selects references.");
  }

  const candidateRecords = await readRequiredRecords(context.artifacts["visual.reference-candidates"].absolutePath, "visual.reference-candidates");
  const requestedIds = uniqueStrings(options.referenceIds);
  const selectedRecords = [];
  for (const referenceId of requestedIds) {
    const candidate = candidateRecords.records.find((record) => record.id === referenceId);
    if (!candidate) {
      throw new Error(`Unknown reference id: ${referenceId}`);
    }
    selectedRecords.push(candidate);
  }

  const updatedCandidates = candidateRecords.records.map((record) => {
    if (!requestedIds.includes(record.id)) {
      return record;
    }
    return {
      ...record,
      selected: true,
      selectionApproval: {
        approved: true,
        actor: options.actor || "plan",
        at: options.at || "plan",
        gateId: "visual.reference-selection",
        note: options.note || "Explicit user approval recorded for selected visual reference."
      }
    };
  }).sort((left, right) => left.id.localeCompare(right.id));

  const selectionOutput = {
    schemaVersion: 1,
    stage: STAGE,
    artifactId: "visual.reference-selection",
    generatedBy: buildRecordMeta(options),
    sourceArtifacts: [
      "visual.reference-candidates"
    ],
    approval: {
      approved: true,
      actor: options.actor || "plan",
      at: options.at || "plan",
      gateId: "visual.reference-selection",
      note: options.note || "Explicit user approval recorded for selected visual references."
    },
    selectedReferenceIds: requestedIds,
    records: selectedRecords.map((record) => ({
      ...record,
      selected: true,
      selectionApproval: {
        approved: true,
        actor: options.actor || "plan",
        at: options.at || "plan",
        gateId: "visual.reference-selection",
        note: options.note || "Explicit user approval recorded for selected visual reference."
      }
    }))
  };
  const candidateOutput = {
    ...candidateRecords,
    generatedBy: buildRecordMeta(options),
    records: updatedCandidates
  };
  const inputHash = sha256([
    formatJson(candidateRecords),
    requestedIds.join("\n")
  ].join("\n"));
  const nextState = await buildNextState(state, options, ["visual.reference-candidates", "visual.reference-selection", "visual.reference-set"], ["visual.reference-selection"], inputHash, [
    "Selected references were explicitly approved with --approve-visual-reference-selection.",
    "No visual reference was auto-selected."
  ]);
  const writes = [
    await buildWriteAction("visual.reference-candidates", context.artifacts["visual.reference-candidates"].absolutePath, context.artifacts["visual.reference-candidates"].path, formatJson(candidateOutput)),
    await buildWriteAction("visual.reference-selection", context.artifacts["visual.reference-selection"].absolutePath, context.artifacts["visual.reference-selection"].path, formatJson(selectionOutput)),
    await buildWriteAction("state.manifest", state.manifestPath, relativeToWorkspace(state.workspaceRoot, state.manifestPath), formatJson(nextState.manifest)),
    await buildWriteAction("state.artifact-graph", state.graphPath, relativeToWorkspace(state.workspaceRoot, state.graphPath), formatJson(nextState.graph))
  ];

  return buildPlanObject(state, options, inputHash, writes, requestedIds.length);
}

async function buildNextState(state, options, artifactIds, gateIds, inputHash, notes) {
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

function buildPlanObject(state, options, inputHash, writes, recordCount) {
  return {
    schemaVersion: 1,
    stage: STAGE,
    mode: options.mode,
    action: options.action,
    workspaceRoot: state.workspaceRoot,
    inputHash,
    recordCount,
    approvalGates: approvalGatesForAction(options.action),
    counts: countActions(writes),
    writes
  };
}

function approvalGatesForAction(action) {
  if (action === "prompts") {
    return {
      applyRequires: ["--approve-visual-prompts"],
      actorRequires: ["--actor"],
      timestampRequires: ["--at"]
    };
  }
  if (action === "candidates") {
    return {
      applyRequires: ["--approve-visual-candidates"],
      actorRequires: ["--actor"],
      timestampRequires: ["--at"],
      hardRequires: ["canonical.visual-anchor-selection approved", "generated output path exists", "generated output has PNG/JPEG/WebP byte signature"]
    };
  }
  return {
    applyRequires: ["--approve-visual-reference-selection"],
    actorRequires: ["--actor"],
    timestampRequires: ["--at"],
    hardRequires: ["explicit --reference-id", "no auto-selection"]
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

async function readRequiredRecords(filePath, artifactId) {
  const value = await readJsonFile(filePath);
  if (value.artifactId !== artifactId) {
    throw new Error(`${filePath}: expected artifactId ${artifactId}.`);
  }
  if (!Array.isArray(value.records)) {
    throw new Error(`${filePath}: records must be an array.`);
  }
  return value;
}

async function readOptionalRecords(filePath, artifactId) {
  try {
    return await readRequiredRecords(filePath, artifactId);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {
        schemaVersion: 1,
        stage: STAGE,
        artifactId,
        records: []
      };
    }
    throw error;
  }
}

async function resolveAndValidateGeneratedOutputPaths(workspaceRoot, inputPaths) {
  const resolved = [];
  for (const inputPath of uniqueStrings(inputPaths)) {
    const absolutePath = resolveAgainst(workspaceRoot, inputPath);
    const relativePath = relativeToWorkspace(workspaceRoot, absolutePath);
    if (relativePath.startsWith("../") || relativePath === ".." || path.isAbsolute(relativePath)) {
      throw new Error(`Generated output path must be inside the workspace: ${inputPath}`);
    }

    let stat;
    try {
      stat = await fs.stat(absolutePath);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        throw new Error(`Generated output path does not exist: ${inputPath}`);
      }
      throw error;
    }
    if (!stat.isFile()) {
      throw new Error(`Generated output path is not a file: ${inputPath}`);
    }

    const bytes = await fs.readFile(absolutePath);
    const imageType = detectImageType(bytes);
    if (!imageType) {
      throw new Error(`Generated output path is not a supported PNG, JPEG, or WEBP image by byte signature: ${inputPath}`);
    }

    resolved.push({
      path: relativePath,
      bytes: stat.size,
      sha256: sha256(bytes),
      imageType: imageType.type,
      mimeType: imageType.mimeType,
      fileExtension: path.extname(absolutePath).toLowerCase() || null
    });
  }
  return resolved.sort((left, right) => left.path.localeCompare(right.path));
}

function detectImageType(bytes) {
  if (!Buffer.isBuffer(bytes)) {
    return null;
  }

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
    return {
      type: "png",
      mimeType: "image/png"
    };
  }

  if (
    bytes.length >= 3
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff
  ) {
    return {
      type: "jpeg",
      mimeType: "image/jpeg"
    };
  }

  if (
    bytes.length >= 12
    && bytes.toString("ascii", 0, 4) === "RIFF"
    && bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return {
      type: "webp",
      mimeType: "image/webp"
    };
  }

  return null;
}

function buildReviewMetadata(options, gateId) {
  return {
    status: options.reviewStatus,
    reviewer: options.reviewer || null,
    reviewedAt: options.reviewedAt || null,
    notes: uniqueStrings(options.reviewNotes),
    approvalGateId: gateId
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
  if (gateId === "visual.reference-prompts") {
    return "Visual prompt records generated; image generation remains an active-agent operation.";
  }
  if (gateId === "image.generation") {
    return "Real generated image output paths were recorded and validated; the script did not create image files.";
  }
  if (gateId === "visual.reference-candidate-generation") {
    return "Visual candidate records persisted after manual anchor approval.";
  }
  if (gateId === "visual.reference-selection") {
    return "Selected visual references were explicitly approved by reference id.";
  }
  return `Visual reference ${action} gate updated.`;
}

function findGateStatus(manifest, gateId) {
  const gate = (Array.isArray(manifest.approvalGates) ? manifest.approvalGates : [])
    .find((candidate) => candidate.id === gateId);
  return gate ? gate.status : "unknown";
}

function isGateApproved(manifest, gateId) {
  return findGateStatus(manifest, gateId) === "approved";
}

function formatPlan(plan) {
  const lines = [
    "Autodesign visual reference plan",
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
    "Autodesign visual reference apply complete",
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

async function readJsonFile(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${filePath}: invalid JSON: ${error.message}`);
  }
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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
}

main().catch((error) => {
  process.stderr.write(`autodesign generate-visual-references error: ${error.message}\n`);
  process.exitCode = 1;
});
