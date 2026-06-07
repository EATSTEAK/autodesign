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

const STAGE = "11-skillopt-hardening";
const SCRIPT_ID = "scripts/generate-skillopt.mjs";
const APPROVAL_FLAG = "--approve-skillopt-hardening";
const ISO_LIKE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const VALID_DECISIONS = new Set(["accept", "reject"]);
const REPORT_ARTIFACT_ID = "log.skillopt-report";
const PROPOSALS_ARTIFACT_ID = "log.skillopt-patch-proposals";
const REPORT_PATH = "autodesign/logs/skillopt-report.json";
const PROPOSALS_PATH = "autodesign/logs/skillopt-patch-proposals.json";

const USAGE = `Usage:
  node autodesign-start/assets/payload/scripts/generate-skillopt.mjs --workspace <workspace> --plan
  node autodesign-start/assets/payload/scripts/generate-skillopt.mjs --workspace <workspace> --apply --approve-skillopt-hardening --actor <actor> --at <timestamp>

Options:
  --workspace <workspace>              Workspace root containing autodesign/manifest.json.
  --manifest <path>                    Optional manifest path, relative to workspace unless absolute.
  --graph <path>                       Optional graph path, relative to workspace unless absolute.
  --plan                               Print planned writes without mutating files. This is the default mode.
  --apply                              Write SkillOpt report/proposal artifacts plus manifest/graph state.
  --approve-skillopt-hardening         Required with --apply.
  --actor <actor>                      Required with --apply; records who authorized writes.
  --at <timestamp>                     Required with --apply; explicit ISO-like timestamp for deterministic records.
  --json                               Print machine-readable JSON.
  --help                               Print this help text.

Eval report input shape:
  autodesign/logs/eval-report.json must have schemaVersion 1, artifactId log.eval-report,
  e2e.status PASS, and goldenCases[].skillComparisons[] records with before/after prompt
  versions, output versions, output hashes, accept/reject decisions, targetPath, and patch text.
`;

function parseOptions(argv) {
  const common = parseCommonOptions(argv);
  const options = {
    ...common,
    mode: "plan",
    modeWasSet: false,
    approvals: new Set(),
    actor: null,
    at: null,
    rest: []
  };

  for (let index = 0; index < common.rest.length; index += 1) {
    const arg = common.rest[index];

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
  const plan = await buildSkillOptPlan(state, options);

  if (options.mode === "plan") {
    process.stdout.write(options.json ? formatJson(plan) : formatPlan(plan));
    return;
  }

  const result = await applyPlan(plan);
  process.stdout.write(options.json ? formatJson(result) : formatApplyResult(result));
}

function assertApplyAllowed(options) {
  if (!options.approvals.has(APPROVAL_FLAG)) {
    throw new Error(`${APPROVAL_FLAG} is required with --apply.`);
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

async function buildSkillOptPlan(state, options) {
  await assertBaseStateReady(state);
  await assertSubskillCanRun(state);

  const artifactIndex = buildArtifactIndex(state.graph);
  const evalArtifact = artifactIndex.get("log.eval-report");
  if (!evalArtifact) {
    throw new Error("Artifact graph is missing log.eval-report.");
  }

  const evalPath = resolveAgainst(state.workspaceRoot, evalArtifact.path);
  const evalReport = normalizeEvalReport(await readJsonFile(evalPath));
  const sourceInventory = [await buildSourceInventoryRecord(state, evalArtifact)];
  const comparisonResult = compareSkillOutputs(evalReport);
  const proposalBundle = buildProposalBundle(options, comparisonResult);
  const report = buildSkillOptReport(options, evalReport, sourceInventory, comparisonResult, proposalBundle);

  validateSkillOptReport(report);
  validateProposalBundle(proposalBundle);

  const inputHash = sha256([
    formatJson(evalReport),
    formatJson(sourceInventory),
    formatJson(comparisonResult.acceptedEdits),
    formatJson(comparisonResult.rejectedEdits)
  ].join("\n"));
  const nextState = buildNextState(state, options, [REPORT_ARTIFACT_ID, PROPOSALS_ARTIFACT_ID], inputHash, [
    "SkillOpt report was generated only after eval E2E PASS.",
    "Accepted and rejected prompt/version edit decisions were recorded from golden-case comparisons.",
    "Patch proposals were written as review-only artifacts; no upstream skill files, frontend code, images, or Pencil state were mutated."
  ]);

  const writes = [
    await buildArtifactWrite(state, artifactIndex, REPORT_ARTIFACT_ID, formatJson(report)),
    await buildArtifactWrite(state, artifactIndex, PROPOSALS_ARTIFACT_ID, formatJson(proposalBundle)),
    ...await buildStateWrite(state, nextState)
  ];
  assertAllowedWriteSet(writes);

  return buildPlanObject(state, options, inputHash, writes, comparisonResult.comparisons.length);
}

async function assertBaseStateReady(state) {
  const validation = validateState(state);
  if (!validation.valid) {
    throw new Error(`State validation failed before Stage 11 SkillOpt: ${validation.errors[0].path}: ${validation.errors[0].message}`);
  }

  const dependencyResult = checkDependencies(state.graph);
  if (!dependencyResult.valid) {
    throw new Error("Artifact graph dependencies must be valid before Stage 11 SkillOpt.");
  }
}

async function assertSubskillCanRun(state) {
  const result = await checkSubskillCanRun(state, "skillopt");
  if (result.canRun) {
    return;
  }

  const details = result.errors
    .map((error) => `${error.check} ${error.path}: ${error.message}`)
    .join("; ");
  throw new Error(`Subskill skillopt cannot run: ${details}`);
}

function normalizeEvalReport(value) {
  const errors = [];
  if (!isObject(value)) {
    throw new Error("eval report must be a JSON object.");
  }
  if (value.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1.");
  }
  if (value.artifactId !== "log.eval-report") {
    errors.push("artifactId must be log.eval-report.");
  }
  const e2eStatus = value.e2e?.status;
  if (typeof e2eStatus !== "string" || e2eStatus.toUpperCase() !== "PASS") {
    errors.push("e2e.status must be PASS.");
  }

  const cases = Array.isArray(value.goldenCases) ? value.goldenCases : [];
  if (cases.length === 0) {
    errors.push("goldenCases must contain at least one case.");
  }

  const goldenCases = [];
  cases.forEach((goldenCase, caseIndex) => {
    const basePath = `goldenCases[${caseIndex}]`;
    if (!isObject(goldenCase)) {
      errors.push(`${basePath} must be an object.`);
      return;
    }

    const caseId = requireString(errors, goldenCase.id, `${basePath}.id`);
    const caseStatus = requireString(errors, goldenCase.status, `${basePath}.status`).toUpperCase();
    if (caseStatus !== "PASS") {
      errors.push(`${basePath}.status must be PASS.`);
    }

    const comparisons = Array.isArray(goldenCase.skillComparisons) ? goldenCase.skillComparisons : [];
    if (comparisons.length === 0) {
      errors.push(`${basePath}.skillComparisons must contain at least one comparison.`);
    }

    const skillComparisons = comparisons.map((comparison, comparisonIndex) => {
      return normalizeComparison(errors, comparison, `${basePath}.skillComparisons[${comparisonIndex}]`, caseId);
    }).filter(Boolean);

    goldenCases.push({
      id: caseId,
      name: typeof goldenCase.name === "string" ? goldenCase.name : caseId,
      status: caseStatus,
      skillComparisons
    });
  });

  if (errors.length > 0) {
    throw new Error(`eval report schema validation failed: ${errors.join(" ")}`);
  }

  return {
    schemaVersion: 1,
    artifactId: "log.eval-report",
    e2e: {
      status: "PASS"
    },
    goldenCases: goldenCases.sort(compareObjectsByKeys(["id"]))
  };
}

function normalizeComparison(errors, comparison, basePath, caseId) {
  if (!isObject(comparison)) {
    errors.push(`${basePath} must be an object.`);
    return null;
  }

  const skill = requireString(errors, comparison.skill, `${basePath}.skill`);
  const targetPath = requireString(errors, comparison.targetPath, `${basePath}.targetPath`);
  const patch = typeof comparison.patch === "string" ? comparison.patch : "";
  const decision = normalizeDecision(comparison.decision);
  if (!VALID_DECISIONS.has(decision)) {
    errors.push(`${basePath}.decision must be accept or reject.`);
  }
  if (!validSkillTargetPath(targetPath)) {
    errors.push(`${basePath}.targetPath must target autodesign-start/SKILL.md or a private subskill SKILL.md.`);
  }
  if (decision === "accept" && patch.trim().length === 0) {
    errors.push(`${basePath}.patch is required for accepted edits.`);
  }
  if (patch.trim().length > 0) {
    validatePatchTargets(errors, patch, targetPath, `${basePath}.patch`);
  }

  const before = isObject(comparison.before) ? comparison.before : {};
  const after = isObject(comparison.after) ? comparison.after : {};
  const promptVersionBefore = requireString(errors, comparison.promptVersionBefore || before.promptVersion, `${basePath}.promptVersionBefore`);
  const promptVersionAfter = requireString(errors, comparison.promptVersionAfter || after.promptVersion, `${basePath}.promptVersionAfter`);
  const outputVersionBefore = requireString(errors, comparison.outputVersionBefore || before.outputVersion, `${basePath}.outputVersionBefore`);
  const outputVersionAfter = requireString(errors, comparison.outputVersionAfter || after.outputVersion, `${basePath}.outputVersionAfter`);
  const outputHashBefore = requireHash(errors, comparison.outputHashBefore || before.outputHash, `${basePath}.outputHashBefore`);
  const outputHashAfter = requireHash(errors, comparison.outputHashAfter || after.outputHash, `${basePath}.outputHashAfter`);
  const rationale = requireString(errors, comparison.rationale, `${basePath}.rationale`);
  const editSeed = {
    patch,
    promptVersionAfter,
    promptVersionBefore,
    skill,
    targetPath
  };
  const editId = typeof comparison.editId === "string" && comparison.editId.length > 0
    ? comparison.editId
    : `skillopt.edit.${sha256(formatJson(editSeed)).slice(0, 16)}`;
  const comparisonSeed = {
    caseId,
    editId,
    outputHashAfter,
    outputHashBefore,
    outputVersionAfter,
    outputVersionBefore
  };
  const id = typeof comparison.id === "string" && comparison.id.length > 0
    ? comparison.id
    : `skillopt.comparison.${sha256(formatJson(comparisonSeed)).slice(0, 16)}`;

  return {
    id,
    caseId,
    editId,
    skill,
    targetPath,
    decision,
    rationale,
    promptVersionBefore,
    promptVersionAfter,
    outputVersionBefore,
    outputVersionAfter,
    outputHashBefore,
    outputHashAfter,
    outputChanged: outputHashBefore !== outputHashAfter,
    patch,
    patchHash: patch.trim().length > 0 ? sha256(patch) : null,
    metrics: isObject(comparison.metrics) ? normalizeMetrics(comparison.metrics) : {}
  };
}

function compareSkillOutputs(evalReport) {
  const comparisons = evalReport.goldenCases
    .flatMap((goldenCase) => goldenCase.skillComparisons)
    .sort(compareObjectsByKeys(["editId", "caseId", "id"]));
  const groups = new Map();

  for (const comparison of comparisons) {
    const group = groups.get(comparison.editId) || {
      editId: comparison.editId,
      skill: comparison.skill,
      targetPath: comparison.targetPath,
      patch: comparison.patch,
      patchHash: comparison.patchHash,
      promptVersionBefore: comparison.promptVersionBefore,
      promptVersionAfter: comparison.promptVersionAfter,
      comparisons: []
    };

    if (group.skill !== comparison.skill || group.targetPath !== comparison.targetPath || group.patch !== comparison.patch) {
      throw new Error(`Edit ${comparison.editId} has conflicting skill, targetPath, or patch values across golden cases.`);
    }

    group.comparisons.push(comparison);
    groups.set(comparison.editId, group);
  }

  const acceptedEdits = [];
  const rejectedEdits = [];

  for (const group of [...groups.values()].sort(compareObjectsByKeys(["editId"]))) {
    const hasReject = group.comparisons.some((comparison) => comparison.decision === "reject");
    const hasAccept = group.comparisons.some((comparison) => comparison.decision === "accept");
    const base = {
      editId: group.editId,
      skill: group.skill,
      targetPath: group.targetPath,
      promptVersionBefore: group.promptVersionBefore,
      promptVersionAfter: group.promptVersionAfter,
      comparisonIds: group.comparisons.map((comparison) => comparison.id).sort(),
      caseIds: uniqueStrings(group.comparisons.map((comparison) => comparison.caseId)),
      outputChanges: group.comparisons.map((comparison) => ({
        caseId: comparison.caseId,
        outputVersionBefore: comparison.outputVersionBefore,
        outputVersionAfter: comparison.outputVersionAfter,
        outputHashBefore: comparison.outputHashBefore,
        outputHashAfter: comparison.outputHashAfter,
        outputChanged: comparison.outputChanged,
        metrics: comparison.metrics
      })).sort(compareObjectsByKeys(["caseId"])),
      rationales: uniqueStrings(group.comparisons.map((comparison) => comparison.rationale))
    };

    if (hasAccept && !hasReject) {
      acceptedEdits.push({
        ...base,
        status: "accepted",
        patchHash: group.patchHash
      });
    } else {
      rejectedEdits.push({
        ...base,
        status: "rejected",
        rejectionReasons: uniqueStrings(group.comparisons
          .filter((comparison) => comparison.decision === "reject")
          .map((comparison) => comparison.rationale))
      });
    }
  }

  return {
    comparisons,
    acceptedEdits,
    rejectedEdits,
    acceptedCount: acceptedEdits.length,
    rejectedCount: rejectedEdits.length
  };
}

function buildProposalBundle(options, comparisonResult) {
  const acceptedById = new Map(comparisonResult.acceptedEdits.map((edit) => [edit.editId, edit]));
  const proposals = comparisonResult.comparisons
    .filter((comparison) => acceptedById.has(comparison.editId))
    .reduce((map, comparison) => {
      if (!map.has(comparison.editId)) {
        const acceptedEdit = acceptedById.get(comparison.editId);
        const proposalSeed = {
          editId: comparison.editId,
          patchHash: comparison.patchHash,
          targetPath: comparison.targetPath
        };
        map.set(comparison.editId, {
          id: `skillopt.patch.${sha256(formatJson(proposalSeed)).slice(0, 16)}`,
          editId: comparison.editId,
          status: "proposed",
          applyPolicy: "manual-review-only",
          skill: comparison.skill,
          targetPath: comparison.targetPath,
          promptVersionBefore: acceptedEdit.promptVersionBefore,
          promptVersionAfter: acceptedEdit.promptVersionAfter,
          patchHash: comparison.patchHash,
          patch: comparison.patch,
          goldenCases: acceptedEdit.caseIds,
          acceptedComparisonIds: acceptedEdit.comparisonIds,
          constraints: [
            "This patch is a proposal only.",
            "Do not apply automatically from SkillOpt output.",
            "Review and apply upstream skill edits manually in a separate approved change."
          ]
        });
      }
      return map;
    }, new Map());

  return {
    schemaVersion: 1,
    stage: STAGE,
    artifactId: PROPOSALS_ARTIFACT_ID,
    generatedBy: buildRecordMeta(options),
    proposalScope: {
      type: "skill-prompt-patch-proposals",
      outputPath: PROPOSALS_PATH,
      allowedTargets: [
        "autodesign-start/SKILL.md",
        "autodesign-start/assets/payload/subskills/*/SKILL.md"
      ],
      exclusions: [
        "automatic upstream updates",
        "frontend source files",
        "image generation",
        "Pencil MCP mutation"
      ]
    },
    proposals: [...proposals.values()].sort(compareObjectsByKeys(["id"]))
  };
}

function buildSkillOptReport(options, evalReport, sourceInventory, comparisonResult, proposalBundle) {
  return {
    schemaVersion: 1,
    stage: STAGE,
    artifactId: REPORT_ARTIFACT_ID,
    generatedBy: buildRecordMeta(options),
    sourceArtifacts: sourceInventory,
    e2e: {
      status: "PASS",
      goldenCaseCount: evalReport.goldenCases.length,
      comparisonCount: comparisonResult.comparisons.length
    },
    comparisonMatrix: comparisonResult.comparisons.map((comparison) => ({
      id: comparison.id,
      caseId: comparison.caseId,
      editId: comparison.editId,
      skill: comparison.skill,
      targetPath: comparison.targetPath,
      decision: comparison.decision,
      promptVersionBefore: comparison.promptVersionBefore,
      promptVersionAfter: comparison.promptVersionAfter,
      outputVersionBefore: comparison.outputVersionBefore,
      outputVersionAfter: comparison.outputVersionAfter,
      outputHashBefore: comparison.outputHashBefore,
      outputHashAfter: comparison.outputHashAfter,
      outputChanged: comparison.outputChanged,
      patchHash: comparison.patchHash,
      metrics: comparison.metrics,
      rationale: comparison.rationale
    })),
    acceptedEdits: comparisonResult.acceptedEdits,
    rejectedEdits: comparisonResult.rejectedEdits,
    proposalArtifact: {
      id: PROPOSALS_ARTIFACT_ID,
      path: PROPOSALS_PATH,
      proposalCount: proposalBundle.proposals.length,
      sha256: sha256(formatJson(proposalBundle))
    },
    constraints: [
      "SkillOpt runs only after eval E2E PASS.",
      "SkillOpt writes only declared report and proposal artifacts plus state metadata.",
      "Patch proposals are not applied automatically.",
      "No frontend code, Pencil MCP calls, image generation, or upstream skill file mutation is performed."
    ]
  };
}

function validateSkillOptReport(report) {
  const errors = [];
  if (!isObject(report)) {
    errors.push("report must be an object.");
  }
  if (report.schemaVersion !== 1) {
    errors.push("report.schemaVersion must be 1.");
  }
  if (report.artifactId !== REPORT_ARTIFACT_ID) {
    errors.push(`report.artifactId must be ${REPORT_ARTIFACT_ID}.`);
  }
  if (report.e2e?.status !== "PASS") {
    errors.push("report.e2e.status must be PASS.");
  }
  if (!Array.isArray(report.acceptedEdits) || !Array.isArray(report.rejectedEdits) || !Array.isArray(report.comparisonMatrix)) {
    errors.push("report must include comparisonMatrix, acceptedEdits, and rejectedEdits arrays.");
  }
  if (report.proposalArtifact?.id !== PROPOSALS_ARTIFACT_ID || report.proposalArtifact?.path !== PROPOSALS_PATH) {
    errors.push("report proposalArtifact must reference the declared SkillOpt proposal artifact.");
  }
  if (errors.length > 0) {
    throw new Error(`SkillOpt report schema validation failed: ${errors.join(" ")}`);
  }
}

function validateProposalBundle(bundle) {
  const errors = [];
  if (!isObject(bundle)) {
    errors.push("proposal bundle must be an object.");
  }
  if (bundle.schemaVersion !== 1) {
    errors.push("proposal bundle schemaVersion must be 1.");
  }
  if (bundle.artifactId !== PROPOSALS_ARTIFACT_ID) {
    errors.push(`proposal bundle artifactId must be ${PROPOSALS_ARTIFACT_ID}.`);
  }
  if (!Array.isArray(bundle.proposals)) {
    errors.push("proposal bundle proposals must be an array.");
  } else {
    bundle.proposals.forEach((proposal, index) => {
      const basePath = `proposals[${index}]`;
      requireString(errors, proposal.id, `${basePath}.id`);
      requireString(errors, proposal.editId, `${basePath}.editId`);
      requireString(errors, proposal.patch, `${basePath}.patch`);
      if (proposal.status !== "proposed") {
        errors.push(`${basePath}.status must be proposed.`);
      }
      if (proposal.applyPolicy !== "manual-review-only") {
        errors.push(`${basePath}.applyPolicy must be manual-review-only.`);
      }
      if (!validSkillTargetPath(proposal.targetPath)) {
        errors.push(`${basePath}.targetPath is not an allowed skill prompt path.`);
      }
      if (typeof proposal.patchHash !== "string" || proposal.patchHash !== sha256(proposal.patch)) {
        errors.push(`${basePath}.patchHash must match patch text.`);
      }
      validatePatchTargets(errors, proposal.patch, proposal.targetPath, `${basePath}.patch`);
    });
  }
  if (errors.length > 0) {
    throw new Error(`SkillOpt proposal schema validation failed: ${errors.join(" ")}`);
  }
}

function buildNextState(state, options, artifactIds, inputHash, notes) {
  const manifest = JSON.parse(JSON.stringify(state.manifest));
  const graph = JSON.parse(JSON.stringify(state.graph));
  const gateIds = ["skillopt.proposals"];
  const recordSeed = {
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
      note: "SkillOpt report and manual-review patch proposals generated after eval E2E PASS.",
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

async function buildStateWrite(state, nextState) {
  return [
    await buildWriteAction("state.manifest", state.manifestPath, relativeToWorkspace(state.workspaceRoot, state.manifestPath), formatJson(nextState.manifest)),
    await buildWriteAction("state.artifact-graph", state.graphPath, relativeToWorkspace(state.workspaceRoot, state.graphPath), formatJson(nextState.graph))
  ];
}

async function buildArtifactWrite(state, artifactIndex, artifactId, text) {
  const artifact = artifactIndex.get(artifactId);
  if (!artifact) {
    throw new Error(`Artifact graph is missing ${artifactId}.`);
  }
  return buildWriteAction(artifactId, resolveAgainst(state.workspaceRoot, artifact.path), artifact.path, text);
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

function assertAllowedWriteSet(writes) {
  for (const write of writes) {
    const isStateWrite = write.path === "autodesign/manifest.json" || write.path === "autodesign/artifact-graph.json";
    if (isStateWrite) {
      continue;
    }
    if (write.path !== REPORT_PATH && write.path !== PROPOSALS_PATH) {
      throw new Error(`SkillOpt writes may only target declared report/proposal artifacts: ${write.path}`);
    }
    if (!write.path.endsWith(".json")) {
      throw new Error(`SkillOpt artifacts must be JSON: ${write.path}`);
    }
  }
}

async function buildSourceInventoryRecord(state, artifact) {
  const absolutePath = resolveAgainst(state.workspaceRoot, artifact.path);
  const stat = await fs.stat(absolutePath);
  if (!stat.isFile()) {
    throw new Error(`${artifact.id} must resolve to a JSON file: ${artifact.path}`);
  }
  const bytes = await fs.readFile(absolutePath);
  return {
    id: artifact.id,
    kind: artifact.kind,
    path: artifact.path,
    generated: artifact.generated,
    referenceOnly: artifact.referenceOnly,
    sourceOfTruth: artifact.sourceOfTruth,
    bytes: bytes.length,
    sha256: sha256(bytes)
  };
}

function buildPlanObject(state, options, inputHash, writes, recordCount) {
  return {
    schemaVersion: 1,
    stage: STAGE,
    mode: options.mode,
    workspaceRoot: state.workspaceRoot,
    inputHash,
    recordCount,
    approvalGates: {
      applyRequires: [APPROVAL_FLAG],
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
    workspaceRoot: plan.workspaceRoot,
    inputHash: plan.inputHash,
    recordCount: plan.recordCount,
    written
  };
}

function formatPlan(plan) {
  const lines = [
    "Autodesign Stage 11 SkillOpt plan",
    `stage: ${plan.stage}`,
    `workspace: ${plan.workspaceRoot}`,
    `input hash: ${plan.inputHash}`,
    `comparisons: ${plan.recordCount}`,
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
    "Autodesign Stage 11 SkillOpt apply complete",
    `stage: ${result.stage}`,
    `workspace: ${result.workspaceRoot}`,
    `input hash: ${result.inputHash}`,
    `comparisons: ${result.recordCount}`,
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
    action: "skillopt-hardening",
    actor: options.actor || "plan",
    at: options.at || "plan"
  };
}

function normalizeDecision(value) {
  if (value === "accepted") {
    return "accept";
  }
  if (value === "rejected") {
    return "reject";
  }
  return typeof value === "string" ? value : "";
}

function normalizeMetrics(metrics) {
  const normalized = {};
  for (const key of Object.keys(metrics).sort()) {
    const value = metrics[key];
    if (typeof value === "number" || typeof value === "string" || typeof value === "boolean" || value === null) {
      normalized[key] = value;
    }
  }
  return normalized;
}

function validSkillTargetPath(targetPath) {
  return targetPath === "autodesign-start/SKILL.md"
    || /^autodesign-start\/assets\/payload\/subskills\/autodesign-[a-z0-9-]+\/SKILL\.md$/.test(targetPath);
}

function validatePatchTargets(errors, patch, targetPath, basePath) {
  if (!patch.includes(targetPath)) {
    errors.push(`${basePath} must mention its targetPath.`);
    return;
  }

  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const parts = line.split(/\s+/);
      const paths = parts.slice(2, 4).map(stripDiffPrefix);
      if (paths.some((candidate) => candidate !== targetPath)) {
        errors.push(`${basePath} diff header references a path other than targetPath.`);
      }
    }
    if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      const candidate = stripDiffPrefix(line.slice(4).trim());
      if (candidate !== "/dev/null" && candidate !== targetPath) {
        errors.push(`${basePath} file header references a path other than targetPath.`);
      }
    }
  }
}

function stripDiffPrefix(value) {
  if (value.startsWith("a/") || value.startsWith("b/")) {
    return value.slice(2);
  }
  return value;
}

function requireString(errors, value, pathName) {
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${pathName} must be a non-empty string.`);
    return "";
  }
  return value;
}

function requireHash(errors, value, pathName) {
  const text = requireString(errors, value, pathName);
  if (text && !HASH_PATTERN.test(text)) {
    errors.push(`${pathName} must be a 64-character hex hash.`);
  }
  return text;
}

function buildArtifactIndex(graph) {
  const byId = new Map();
  for (const artifact of Array.isArray(graph.artifacts) ? graph.artifacts : []) {
    byId.set(artifact.id, artifact);
  }
  return byId;
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

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function relativeToWorkspace(workspaceRoot, absolutePath) {
  return path.relative(workspaceRoot, absolutePath).split(path.sep).join("/");
}

function resolveAgainst(root, maybeRelativePath) {
  return path.isAbsolute(maybeRelativePath) ? maybeRelativePath : path.resolve(root, maybeRelativePath);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

main().catch((error) => {
  process.stderr.write(`autodesign generate-skillopt error: ${error.message}\n`);
  process.exitCode = 1;
});
