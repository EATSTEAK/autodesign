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

const STAGE = "06-canonical-pipeline";
const SCRIPT_ID = "scripts/generate-canonical.mjs";
const ISO_LIKE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
const ALLOWED_INPUT_EXTENSIONS = new Set([
  ".csv",
  ".html",
  ".json",
  ".md",
  ".markdown",
  ".tsv",
  ".txt"
]);

const CANONICAL_ARTIFACTS = [
  "canonical.project-brief",
  "canonical.requirements",
  "canonical.brand-direction",
  "canonical.ux-rules",
  "canonical.screen-model",
  "canonical.interaction-model",
  "canonical.coverage-matrix",
  "log.decision-log",
  "canonical.navigation",
  "canonical.screen-state-matrix",
  "canonical.visual-anchor-proposals"
];

const VALID_SUBSKILLS = new Set([
  "all",
  "interview",
  "stories",
  "brand",
  "views",
  "ux",
  "visual-anchors"
]);

const PLATFORM_REQUIRED_ARTIFACTS = new Set([
  "canonical.ux-rules",
  "canonical.interaction-model",
  "canonical.screen-state-matrix",
  "canonical.visual-anchor-proposals"
]);

const USAGE = `Usage:
  node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace <workspace> --plan
  node autodesign-start/assets/payload/scripts/generate-canonical.mjs --workspace <workspace> --apply --approve-canonical-generation --actor <actor> --at <timestamp>

Options:
  --workspace <workspace>             Workspace root containing autodesign/manifest.json.
  --manifest <path>                   Optional manifest path, relative to workspace unless absolute.
  --graph <path>                      Optional graph path, relative to workspace unless absolute.
  --subskill <name>                   all, interview, stories, brand, views, ux, or visual-anchors. Default: all.
  --plan                              Print planned writes without mutating files. This is the default mode.
  --apply                             Write canonical artifacts and update manifest/graph state.
  --approve-canonical-generation      Required with --apply before any file writes are allowed.
  --actor <actor>                     Required with --apply; records who authorized generation.
  --at <timestamp>                    Required with --apply; explicit ISO-like timestamp for deterministic records.
  --json                              Print machine-readable JSON.
  --help                              Print this help text.
`;

function parseOptions(argv) {
  const common = parseCommonOptions(argv);
  const options = {
    ...common,
    mode: "plan",
    modeWasSet: false,
    approveCanonicalGeneration: false,
    actor: null,
    at: null,
    subskill: "all",
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

    if (arg === "--approve-canonical-generation") {
      options.approveCanonicalGeneration = true;
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

    if (arg === "--subskill") {
      options.subskill = normalizeSubskillName(readArgValue(common.rest, index, "--subskill"));
      index += 1;
      continue;
    }

    options.rest.push(arg);
  }

  if (!VALID_SUBSKILLS.has(options.subskill)) {
    throw new Error(`Unknown --subskill: ${options.subskill}`);
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
  const plan = await buildCanonicalPlan(state, options);

  if (options.mode === "plan") {
    process.stdout.write(options.json ? formatJson(plan) : formatPlan(plan));
    return;
  }

  assertApplyAllowed(options);
  const result = await applyPlan(plan);
  process.stdout.write(options.json ? formatJson(result) : formatApplyResult(result));
}

async function buildCanonicalPlan(state, options) {
  const validation = validateState(state);
  if (!validation.valid) {
    throw new Error(`State validation failed before canonical generation: ${validation.errors[0].path}: ${validation.errors[0].message}`);
  }

  const dependencyResult = checkDependencies(state.graph);
  if (!dependencyResult.valid) {
    throw new Error("Artifact graph dependencies must be valid before canonical generation.");
  }

  if (state.manifest.disabledBehaviors.canonicalGeneration !== false) {
    throw new Error("manifest.disabledBehaviors.canonicalGeneration must be false for Stage 06 canonical generation.");
  }

  if (options.subskill !== "all") {
    await assertNamedSubskillCanRun(state, options.subskill);
  }

  const artifactIndex = buildArtifactIndex(state.graph);
  const selectedArtifacts = selectArtifacts(options.subskill, state);
  const inputBundle = await collectInputBundle(state, artifactIndex);
  const analysis = analyzeInputs(inputBundle);
  const requiresPlatform = selectedArtifacts.some((artifactId) => PLATFORM_REQUIRED_ARTIFACTS.has(artifactId));

  if (requiresPlatform && analysis.platform.status !== "selected") {
    throw new Error("UX platform selection is required. Add an explicit platform, target platform, surface, form factor, or common platform phrase to autodesign/inputs.");
  }

  const outputs = buildArtifacts(analysis, selectedArtifacts);
  const missingOutputs = selectedArtifacts.filter((artifactId) => !outputs.has(artifactId));
  if (missingOutputs.length > 0) {
    throw new Error(`No generator output for artifact id(s): ${missingOutputs.join(", ")}`);
  }

  const artifactWrites = [];
  for (const artifactId of selectedArtifacts) {
    const artifact = artifactIndex.get(artifactId);
    if (!artifact) {
      throw new Error(`Selected artifact is not declared in the artifact graph: ${artifactId}`);
    }
    const absolutePath = resolveAgainst(state.workspaceRoot, artifact.path);
    const text = formatJson(outputs.get(artifactId));
    artifactWrites.push(await buildWriteAction(artifactId, absolutePath, artifact.path, text));
  }

  const nextState = buildNextState(state, selectedArtifacts, artifactWrites, analysis, options);
  const stateWrites = [
    await buildWriteAction("state.manifest", state.manifestPath, relativeToWorkspace(state.workspaceRoot, state.manifestPath), formatJson(nextState.manifest)),
    await buildWriteAction("state.artifact-graph", state.graphPath, relativeToWorkspace(state.workspaceRoot, state.graphPath), formatJson(nextState.graph))
  ];

  const allWrites = [...artifactWrites, ...stateWrites];
  const counts = countActions(allWrites);

  return {
    schemaVersion: 1,
    stage: STAGE,
    mode: options.mode,
    workspaceRoot: state.workspaceRoot,
    subskill: options.subskill,
    inputHash: inputBundle.inputHash,
    platformGate: {
      required: requiresPlatform,
      status: analysis.platform.status,
      platform: analysis.platform.value,
      source: analysis.platform.source
    },
    visualAnchorApproval: {
      approved: false,
      gateId: "canonical.visual-anchor-selection",
      status: "pending"
    },
    counts,
    approvalGates: {
      applyRequires: ["--approve-canonical-generation"],
      actorRequires: ["--actor"],
      timestampRequires: ["--at"]
    },
    writes: allWrites
  };
}

function assertApplyAllowed(options) {
  if (!options.approveCanonicalGeneration) {
    throw new Error("--approve-canonical-generation is required with --apply.");
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
    stage: STAGE,
    workspaceRoot: plan.workspaceRoot,
    subskill: plan.subskill,
    inputHash: plan.inputHash,
    platformGate: plan.platformGate,
    visualAnchorApproval: plan.visualAnchorApproval,
    written
  };
}

async function collectInputBundle(state, artifactIndex) {
  const inputArtifact = artifactIndex.get("inputs.project-material");
  if (!inputArtifact) {
    throw new Error("inputs.project-material is not declared in the artifact graph.");
  }

  const inputRoot = resolveAgainst(state.workspaceRoot, inputArtifact.path);
  const files = await collectInputFiles(inputRoot);
  if (files.length === 0) {
    throw new Error("No real project input files found under autodesign/inputs.");
  }

  const entries = [];
  for (const absolutePath of files) {
    const text = await fs.readFile(absolutePath, "utf8");
    const relPath = relativeToWorkspace(state.workspaceRoot, absolutePath);
    entries.push({
      path: relPath,
      sha256: sha256(text),
      text
    });
  }

  const inputHash = sha256(entries.map((entry) => `${entry.path}\n${entry.sha256}`).join("\n"));
  return {
    root: inputArtifact.path,
    inputHash,
    files: entries
  };
}

async function collectInputFiles(inputRoot) {
  const files = [];

  async function walk(currentPath) {
    const stat = await fs.stat(currentPath);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      entries.sort((left, right) => left.name.localeCompare(right.name));
      for (const entry of entries) {
        if (entry.name.startsWith(".")) {
          continue;
        }
        await walk(path.join(currentPath, entry.name));
      }
      return;
    }

    if (!stat.isFile()) {
      return;
    }

    const basename = path.basename(currentPath).toLowerCase();
    if (basename === "readme.md") {
      return;
    }

    const extension = path.extname(currentPath).toLowerCase();
    if (ALLOWED_INPUT_EXTENSIONS.has(extension)) {
      files.push(currentPath);
    }
  }

  await walk(inputRoot);
  return files.sort();
}

function analyzeInputs(inputBundle) {
  const sourceText = inputBundle.files.map((file) => file.text).join("\n\n");
  const lines = splitUsefulLines(sourceText);
  const title = detectTitle(inputBundle.files, lines);
  const platform = detectPlatform(inputBundle.files);
  const summary = summarize(lines, title);
  const keywords = detectKeywords(sourceText);
  const constraints = pickLines(lines, [
    "constraint",
    "must not",
    "accessibility",
    "privacy",
    "security",
    "compliance",
    "deadline",
    "budget"
  ], 8);
  const goals = pickLines(lines, [
    "goal",
    "objective",
    "outcome",
    "success",
    "must",
    "need"
  ], 8);
  const audience = detectAudience(lines);
  const requirementLines = detectRequirementLines(lines);
  const requirements = buildRequirements(requirementLines, summary, keywords);
  const stories = buildStories(requirements, audience);
  const screens = buildScreens(requirements, keywords, title);
  const navigation = buildNavigation(screens);
  const screenStates = buildScreenStates(screens);
  const interactions = buildInteractions(screens, requirements, platform);
  const brand = buildBrand(sourceText, title);
  const uxRules = buildUxRules(platform, keywords);
  const decisions = buildDecisions(title, platform, keywords, requirements, screens);
  const visualAnchors = buildVisualAnchors(screens, brand);
  const coverage = buildCoverage(requirements, stories, screens, screenStates, decisions);

  return {
    inputBundle,
    title,
    platform,
    summary,
    goals,
    constraints,
    audience,
    keywords,
    requirements,
    stories,
    screens,
    navigation,
    screenStates,
    interactions,
    brand,
    uxRules,
    decisions,
    visualAnchors,
    coverage
  };
}

function buildArtifacts(analysis, selectedArtifacts) {
  const baseMeta = {
    inputHash: analysis.inputBundle.inputHash,
    sourceFiles: analysis.inputBundle.files.map((file) => ({
      path: file.path,
      sha256: file.sha256
    })),
    stage: STAGE
  };
  const outputs = new Map();

  outputs.set("canonical.project-brief", {
    schemaVersion: 1,
    artifactId: "canonical.project-brief",
    generatedBy: baseMeta,
    project: {
      name: analysis.title,
      summary: analysis.summary,
      primaryAudience: analysis.audience,
      platformSelection: analysis.platform,
      goals: analysis.goals,
      constraints: analysis.constraints,
      openQuestions: buildOpenQuestions(analysis)
    },
    interviewIntent: {
      objectives: [
        "Clarify product scope, users, platform, and success criteria.",
        "Identify screen inventory, decision points, and design constraints.",
        "Separate approved inputs from generated assumptions before visual work."
      ],
      questions: buildInterviewQuestions(analysis),
      missingInformation: buildMissingInformation(analysis)
    }
  });

  outputs.set("canonical.requirements", {
    schemaVersion: 1,
    artifactId: "canonical.requirements",
    generatedBy: baseMeta,
    stories: analysis.stories,
    functionalRequirements: analysis.requirements.filter((requirement) => requirement.type === "functional"),
    nonFunctionalRequirements: analysis.requirements.filter((requirement) => requirement.type === "non-functional"),
    sourceCoverage: analysis.requirements.map((requirement) => ({
      requirementId: requirement.id,
      source: requirement.source
    }))
  });

  outputs.set("canonical.brand-direction", {
    schemaVersion: 1,
    artifactId: "canonical.brand-direction",
    generatedBy: baseMeta,
    brand: analysis.brand
  });

  outputs.set("canonical.ux-rules", {
    schemaVersion: 1,
    artifactId: "canonical.ux-rules",
    generatedBy: baseMeta,
    platformSelectionGate: {
      required: true,
      status: analysis.platform.status === "selected" ? "passed" : "blocked",
      platform: analysis.platform.value,
      source: analysis.platform.source
    },
    rules: analysis.uxRules
  });

  outputs.set("canonical.screen-model", {
    schemaVersion: 1,
    artifactId: "canonical.screen-model",
    generatedBy: baseMeta,
    viewTaxonomy: buildViewTaxonomy(analysis.screens),
    screens: analysis.screens
  });

  outputs.set("canonical.interaction-model", {
    schemaVersion: 1,
    artifactId: "canonical.interaction-model",
    generatedBy: baseMeta,
    platform: analysis.platform.value,
    flows: analysis.interactions.flows,
    transitions: analysis.interactions.transitions,
    globalPatterns: analysis.interactions.globalPatterns,
    edgeCases: analysis.interactions.edgeCases
  });

  outputs.set("canonical.coverage-matrix", {
    schemaVersion: 1,
    artifactId: "canonical.coverage-matrix",
    generatedBy: baseMeta,
    rows: analysis.coverage.rows,
    gaps: analysis.coverage.gaps
  });

  outputs.set("log.decision-log", {
    schemaVersion: 1,
    artifactId: "log.decision-log",
    generatedBy: baseMeta,
    decisions: analysis.decisions,
    pendingDecisions: [
      {
        id: "decision.pending.visual-anchor-selection",
        status: "pending",
        decision: "Select the primary visual anchor proposal before Stage 07 visual reference work.",
        gateId: "canonical.visual-anchor-selection"
      }
    ]
  });

  outputs.set("canonical.navigation", {
    schemaVersion: 1,
    artifactId: "canonical.navigation",
    generatedBy: baseMeta,
    navigation: analysis.navigation
  });

  outputs.set("canonical.screen-state-matrix", {
    schemaVersion: 1,
    artifactId: "canonical.screen-state-matrix",
    generatedBy: baseMeta,
    matrix: analysis.screenStates
  });

  outputs.set("canonical.visual-anchor-proposals", {
    schemaVersion: 1,
    artifactId: "canonical.visual-anchor-proposals",
    generatedBy: baseMeta,
    approval: {
      approved: false,
      gateId: "canonical.visual-anchor-selection",
      status: "proposed",
      note: "Stage 06 proposes primary anchor screens only. Stage 07 must not treat these as selected visual references without manual approval."
    },
    proposals: analysis.visualAnchors
  });

  return new Map([...outputs.entries()].filter(([artifactId]) => selectedArtifacts.includes(artifactId)));
}

function buildNextState(state, selectedArtifacts, artifactWrites, analysis, options) {
  const manifest = JSON.parse(JSON.stringify(state.manifest));
  const graph = JSON.parse(JSON.stringify(state.graph));
  const recordSeed = {
    actor: options.actor || "plan",
    at: options.at || "plan",
    artifacts: selectedArtifacts,
    inputHash: analysis.inputBundle.inputHash,
    script: SCRIPT_ID,
    subskill: options.subskill
  };
  const recordId = `generation.${sha256(formatJson(recordSeed)).slice(0, 16)}`;
  const generatedArtifactIds = new Set(selectedArtifacts);

  for (const artifact of graph.artifacts) {
    if (generatedArtifactIds.has(artifact.id)) {
      artifact.generated = true;
    }
  }

  const gates = [
    "canonical.generation"
  ];
  if (analysis.platform.status === "selected") {
    gates.push("canonical.ux-platform-selection");
  }
  if (selectedArtifacts.includes("canonical.visual-anchor-proposals")) {
    gates.push("canonical.visual-anchor-selection");
  }

  updateGate(manifest, "canonical.generation", {
    actor: options.actor,
    at: options.at,
    historyId: recordId,
    note: "Canonical artifacts generated by deterministic Stage 06 pipeline.",
    status: "approved"
  });

  if (analysis.platform.status === "selected") {
    updateGate(manifest, "canonical.ux-platform-selection", {
      actor: options.actor,
      at: options.at,
      historyId: recordId,
      note: `Platform selection detected from input files: ${analysis.platform.value}.`,
      status: "approved"
    });
  }

  if (selectedArtifacts.includes("canonical.visual-anchor-proposals")) {
    updateGate(manifest, "canonical.visual-anchor-selection", {
      actor: null,
      at: null,
      historyId: recordId,
      note: "Primary visual anchor proposals generated; manual selection is still required.",
      status: "pending"
    });
  }

  const record = {
    id: recordId,
    actor: options.actor || "plan",
    at: options.at || "plan",
    script: SCRIPT_ID,
    inputHash: analysis.inputBundle.inputHash,
    artifacts: selectedArtifacts,
    gates,
    notes: [
      "No image generation, Pencil operations, visual references, design-system outputs, prototypes, or handoff outputs were generated.",
      "Primary visual anchor proposals are not approved by this record."
    ]
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
    graph,
    artifactWrites
  };
}

function updateGate(manifest, gateId, update) {
  const gate = (Array.isArray(manifest.approvalGates) ? manifest.approvalGates : [])
    .find((candidate) => candidate.id === gateId);
  if (!gate) {
    return;
  }

  gate.status = update.status;
  gate.updatedAt = update.at || null;
  gate.actor = update.actor || null;
  gate.note = update.note;
  gate.history = uniqueStrings([...(Array.isArray(gate.history) ? gate.history : []), update.historyId]);
}

async function buildWriteAction(id, absolutePath, relPath, text) {
  const existing = await readMaybe(absolutePath);
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

async function readMaybe(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function formatPlan(plan) {
  const lines = [
    "Autodesign canonical generation plan",
    `stage: ${plan.stage}`,
    `workspace: ${plan.workspaceRoot}`,
    `subskill: ${plan.subskill}`,
    `input hash: ${plan.inputHash}`,
    `platform gate: ${plan.platformGate.required ? plan.platformGate.status : "not-required"}${plan.platformGate.platform ? ` (${plan.platformGate.platform})` : ""}`,
    `visual anchors approved: ${plan.visualAnchorApproval.approved ? "yes" : "no"}`,
    `create: ${plan.counts.create}`,
    `overwrite: ${plan.counts.overwrite}`,
    `preserve: ${plan.counts.preserve}`,
    "approval gates:",
    "  apply: --approve-canonical-generation",
    "  record: --actor and --at",
    "writes:"
  ];

  for (const write of plan.writes) {
    lines.push(`  ${write.action} ${write.path} (${write.bytes} bytes, sha256 ${write.sha256})`);
  }

  return `${lines.join("\n")}\n`;
}

function formatApplyResult(result) {
  const lines = [
    "Autodesign canonical generation apply complete",
    `stage: ${result.stage}`,
    `workspace: ${result.workspaceRoot}`,
    `subskill: ${result.subskill}`,
    `input hash: ${result.inputHash}`,
    `platform gate: ${result.platformGate.status}${result.platformGate.platform ? ` (${result.platformGate.platform})` : ""}`,
    `visual anchors approved: ${result.visualAnchorApproval.approved ? "yes" : "no"}`,
    `written: ${result.written.length}`
  ];

  for (const relPath of result.written) {
    lines.push(`  ${relPath}`);
  }

  return `${lines.join("\n")}\n`;
}

async function assertNamedSubskillCanRun(state, subskill) {
  const result = await checkSubskillCanRun(state, subskill);
  if (result.canRun) {
    return;
  }

  const details = result.errors
    .map((error) => `${error.check} ${error.path}: ${error.message}`)
    .join("; ");
  throw new Error(`Subskill ${subskill} cannot run: ${details}`);
}

function selectArtifacts(subskill, state) {
  const graph = state.graph;
  const requested = subskill === "all"
    ? CANONICAL_ARTIFACTS
    : getSubskillOutputArtifacts(state.manifest, subskill);
  const order = Array.isArray(graph.artifacts) ? graph.artifacts.map((artifact) => artifact.id) : CANONICAL_ARTIFACTS;
  return requested
    .filter((artifactId) => CANONICAL_ARTIFACTS.includes(artifactId))
    .sort((left, right) => order.indexOf(left) - order.indexOf(right));
}

function getSubskillOutputArtifacts(manifest, subskill) {
  const contract = (Array.isArray(manifest.subskillContracts) ? manifest.subskillContracts : [])
    .find((candidate) => candidate && candidate.name === subskill);
  if (!contract) {
    throw new Error(`No manifest contract found for subskill ${subskill}.`);
  }
  return Array.isArray(contract.outputArtifacts) ? contract.outputArtifacts : [];
}

function splitUsefulLines(text) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[#*_`>|]/g, "").trim())
    .map((line) => line.replace(/^[-+*]\s+/, "").replace(/^\d+[.)]\s+/, "").trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^readme$/i.test(line))
    .slice(0, 200);
}

function detectTitle(files, lines) {
  for (const file of files) {
    const heading = file.text.split(/\r?\n/).find((line) => /^#\s+\S+/.test(line));
    if (heading) {
      return cleanSentence(heading.replace(/^#\s+/, ""), 80);
    }
  }

  const titleLine = lines.find((line) => /^(project|product|app|service|name)\s*[:=-]/i.test(line));
  if (titleLine) {
    return cleanSentence(titleLine.replace(/^[^:=-]+[:=-]\s*/, ""), 80);
  }

  const first = lines.find((line) => line.length >= 4);
  if (first) {
    return cleanSentence(first, 80);
  }

  return "Autodesign Project";
}

function detectPlatform(files) {
  for (const file of files) {
    const lines = file.text.split(/\r?\n/);
    for (const line of lines) {
      const explicit = line.match(/["']?(?:target\s+platform|primary\s+platform|targetPlatform|primaryPlatform|platform|surface|target\s+surface|targetSurface|form\s+factor|formFactor|device\s+target|deviceTarget)["']?\s*[:=-]\s*["']?(.+?)["']?\s*[,}]?$/i);
      if (explicit) {
        const normalized = normalizePlatform(explicit[1]);
        if (normalized) {
          return {
            status: "selected",
            value: normalized,
            source: file.path,
            evidence: cleanSentence(line, 140)
          };
        }
      }
    }
  }

  const phrases = [
    ["responsive-web", /\bresponsive\s+web\s+app\b/i],
    ["web", /\bdesktop\s+web\s+app\b/i],
    ["web", /\bweb\s+app\b/i],
    ["native-mobile", /\bnative\s+mobile\b/i],
    ["ios", /\bios\s+app\b/i],
    ["android", /\bandroid\s+app\b/i],
    ["mobile", /\bmobile\s+app\b/i],
    ["desktop", /\bdesktop\s+app\b/i],
    ["browser-extension", /\bbrowser\s+extension\b/i],
    ["tablet", /\btablet\s+experience\b/i],
    ["kiosk", /\bkiosk\s+experience\b/i]
  ];

  for (const file of files) {
    for (const [value, pattern] of phrases) {
      const match = file.text.match(pattern);
      if (match) {
        return {
          status: "selected",
          value,
          source: file.path,
          evidence: match[0]
        };
      }
    }
  }

  return {
    status: "missing",
    value: null,
    source: null,
    evidence: null
  };
}

function normalizePlatform(value) {
  const normalized = String(value).toLowerCase();
  if (/\bresponsive\s+web\b/.test(normalized)) return "responsive-web";
  if (/\bdesktop\s+web\b|\bweb\b|\bbrowser\b/.test(normalized)) return "web";
  if (/\bnative\s+mobile\b/.test(normalized)) return "native-mobile";
  if (/\bios\b/.test(normalized)) return "ios";
  if (/\bandroid\b/.test(normalized)) return "android";
  if (/\bmobile\b/.test(normalized)) return "mobile";
  if (/\bdesktop\b|\bmacos\b|\bwindows\b/.test(normalized)) return "desktop";
  if (/\bextension\b/.test(normalized)) return "browser-extension";
  if (/\btablet\b/.test(normalized)) return "tablet";
  if (/\bkiosk\b/.test(normalized)) return "kiosk";
  return null;
}

function summarize(lines, title) {
  const candidates = lines
    .filter((line) => line !== title)
    .filter((line) => line.length >= 24)
    .slice(0, 4);
  if (candidates.length === 0) {
    return `Canonical brief for ${title}.`;
  }
  return cleanSentence(candidates.join(" "), 420);
}

function detectKeywords(text) {
  const normalized = text.toLowerCase();
  const keywords = [];
  const known = [
    "authentication",
    "dashboard",
    "analytics",
    "search",
    "profile",
    "settings",
    "admin",
    "checkout",
    "booking",
    "messaging",
    "collaboration",
    "upload",
    "reporting",
    "notifications",
    "accessibility",
    "offline",
    "privacy",
    "security"
  ];

  for (const keyword of known) {
    if (normalized.includes(keyword)) {
      keywords.push(keyword);
    }
  }
  return keywords;
}

function pickLines(lines, keywords, limit) {
  const picked = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (keywords.some((keyword) => lower.includes(keyword))) {
      picked.push(cleanSentence(line, 220));
    }
    if (picked.length >= limit) {
      break;
    }
  }
  return uniqueStrings(picked);
}

function detectAudience(lines) {
  const audienceLine = lines.find((line) => /^(audience|users|user|customer|persona|for)\s*[:=-]/i.test(line));
  if (audienceLine) {
    return cleanSentence(audienceLine.replace(/^[^:=-]+[:=-]\s*/, ""), 140);
  }
  const phrase = lines.find((line) => /\b(for|users are|used by|customers are)\b/i.test(line));
  return phrase ? cleanSentence(phrase, 140) : "Primary users from project input files";
}

function detectRequirementLines(lines) {
  const patterns = [
    /\bas a\b.+\bi want\b/i,
    /\bmust\b/i,
    /\bshould\b/i,
    /\bneeds?\b/i,
    /\brequirement\b/i,
    /\bfeature\b/i,
    /\buser can\b/i,
    /\buser should\b/i
  ];
  return lines.filter((line) => patterns.some((pattern) => pattern.test(line))).slice(0, 24);
}

function buildRequirements(requirementLines, summary, keywords) {
  const seedLines = requirementLines.length > 0 ? requirementLines : [
    `Users need a clear primary workflow for ${summary}`,
    "The experience must expose essential content and actions without ambiguity.",
    "The interface should handle loading, empty, and error states."
  ];

  const requirements = seedLines.slice(0, 12).map((line, index) => ({
    id: `req.func.${String(index + 1).padStart(3, "0")}`,
    type: "functional",
    priority: index < 5 ? "high" : "medium",
    statement: cleanSentence(line, 220),
    source: "project-input"
  }));

  const nonFunctionalSeeds = [];
  if (keywords.includes("accessibility")) nonFunctionalSeeds.push("Meet accessibility expectations for perceivable, operable, and understandable UI.");
  if (keywords.includes("privacy")) nonFunctionalSeeds.push("Protect user privacy in data display and input flows.");
  if (keywords.includes("security")) nonFunctionalSeeds.push("Keep sensitive actions explicit and guarded.");
  if (keywords.includes("offline")) nonFunctionalSeeds.push("Represent offline and reconnecting states.");
  if (nonFunctionalSeeds.length === 0) {
    nonFunctionalSeeds.push("Keep navigation predictable and recoverable across core screens.");
  }

  nonFunctionalSeeds.forEach((statement, index) => {
    requirements.push({
      id: `req.nfr.${String(index + 1).padStart(3, "0")}`,
      type: "non-functional",
      priority: "medium",
      statement,
      source: "derived-from-input"
    });
  });

  return requirements;
}

function buildStories(requirements, audience) {
  return requirements
    .filter((requirement) => requirement.type === "functional")
    .slice(0, 10)
    .map((requirement, index) => ({
      id: `story.${String(index + 1).padStart(3, "0")}`,
      actor: audience,
      need: requirement.statement,
      outcome: "Complete the related task with clear feedback and recovery paths.",
      requirementId: requirement.id
    }));
}

function buildScreens(requirements, keywords, title) {
  const seeds = [
    {
      id: "screen.start",
      name: "Start",
      route: "/",
      purpose: `Orient users to ${title} and expose the primary entry path.`,
      type: "entry"
    },
    {
      id: "screen.workspace",
      name: keywords.includes("dashboard") ? "Dashboard" : "Workspace",
      route: "/workspace",
      purpose: "Support the main task flow and active work area.",
      type: "primary"
    }
  ];

  const keywordScreens = [
    ["authentication", "screen.auth", "Authentication", "/auth", "Capture sign-in, sign-up, and account access decisions.", "system"],
    ["search", "screen.search", "Search", "/search", "Help users find and filter relevant records or content.", "primary"],
    ["analytics", "screen.analytics", "Analytics", "/analytics", "Present metrics, trends, and reporting summaries.", "primary"],
    ["profile", "screen.profile", "Profile", "/profile", "Manage user identity and personal details.", "supporting"],
    ["admin", "screen.admin", "Admin", "/admin", "Support administrative review and control tasks.", "supporting"],
    ["checkout", "screen.checkout", "Checkout", "/checkout", "Complete payment, confirmation, and review flow.", "primary"],
    ["booking", "screen.booking", "Booking", "/booking", "Select availability, details, and confirmation steps.", "primary"],
    ["messaging", "screen.messages", "Messages", "/messages", "Review conversations and communication history.", "primary"],
    ["settings", "screen.settings", "Settings", "/settings", "Configure preferences, account options, and system behavior.", "supporting"]
  ];

  for (const [keyword, id, name, route, purpose, type] of keywordScreens) {
    if (keywords.includes(keyword)) {
      seeds.push({ id, name, route, purpose, type });
    }
  }

  if (!seeds.some((screen) => screen.id === "screen.settings")) {
    seeds.push({
      id: "screen.settings",
      name: "Settings",
      route: "/settings",
      purpose: "Configure preferences and secondary account behavior.",
      type: "supporting"
    });
  }

  const functionalIds = requirements
    .filter((requirement) => requirement.type === "functional")
    .map((requirement) => requirement.id);

  return seeds.map((screen, index) => ({
    ...screen,
    priority: index < 2 ? "primary" : "secondary",
    requirementIds: functionalIds.slice(0, Math.max(1, Math.min(3, functionalIds.length)))
  }));
}

function buildNavigation(screens) {
  return {
    model: "primary-navigation",
    items: screens.map((screen, index) => ({
      id: `nav.${String(index + 1).padStart(3, "0")}`,
      label: screen.name,
      route: screen.route,
      screenId: screen.id,
      parentId: null,
      visibility: screen.type === "system" ? "conditional" : "primary"
    })),
    primaryPath: screens.filter((screen) => screen.priority === "primary").map((screen) => screen.id)
  };
}

function buildScreenStates(screens) {
  return screens.map((screen) => ({
    screenId: screen.id,
    screenName: screen.name,
    states: [
      {
        id: `${screen.id}.default`,
        name: "default",
        expectedContent: "Primary content and actions are visible."
      },
      {
        id: `${screen.id}.loading`,
        name: "loading",
        expectedContent: "Progress feedback appears without layout shift."
      },
      {
        id: `${screen.id}.empty`,
        name: "empty",
        expectedContent: "Empty state explains what is missing and offers a next action."
      },
      {
        id: `${screen.id}.error`,
        name: "error",
        expectedContent: "Error state gives a clear recovery path."
      }
    ]
  }));
}

function buildInteractions(screens, requirements, platform) {
  const transitions = [];
  for (let index = 0; index < screens.length - 1; index += 1) {
    transitions.push({
      id: `transition.${String(index + 1).padStart(3, "0")}`,
      from: screens[index].id,
      to: screens[index + 1].id,
      trigger: "primary navigation or completed action",
      feedback: "active destination, preserved context, and recoverable back path"
    });
  }

  return {
    flows: [
      {
        id: "flow.primary-task",
        name: "Primary Task Flow",
        screenIds: screens.filter((screen) => screen.priority === "primary").map((screen) => screen.id),
        requirementIds: requirements.filter((requirement) => requirement.type === "functional").slice(0, 5).map((requirement) => requirement.id)
      }
    ],
    transitions,
    globalPatterns: [
      `${platform.value || "selected platform"} interactions should keep primary actions visible near the active task context.`,
      "Every destructive or irreversible action needs confirmation and an undo or recovery path when feasible.",
      "Loading, empty, and error states must keep navigation and orientation intact."
    ],
    edgeCases: [
      "First-run empty data",
      "Interrupted submission",
      "Permission or authentication failure"
    ]
  };
}

function buildBrand(sourceText, title) {
  const lower = sourceText.toLowerCase();
  const attributeMap = [
    ["trustworthy", ["trust", "secure", "reliable"]],
    ["efficient", ["fast", "efficient", "productivity"]],
    ["approachable", ["friendly", "approachable", "simple"]],
    ["premium", ["premium", "luxury", "high-end"]],
    ["technical", ["developer", "technical", "api"]],
    ["calm", ["calm", "quiet", "minimal"]]
  ];
  const attributes = attributeMap
    .filter(([, terms]) => terms.some((term) => lower.includes(term)))
    .map(([attribute]) => attribute);

  if (attributes.length === 0) {
    attributes.push("clear", "credible", "focused");
  }

  return {
    name: title,
    attributes: uniqueStrings(attributes).slice(0, 5),
    tone: attributes.includes("technical") ? "precise and practical" : "clear and confident",
    visualPrinciples: [
      "Prioritize content hierarchy and task clarity over decoration.",
      "Use restrained contrast and purposeful emphasis for key decisions.",
      "Keep visual language aligned with the selected platform and user workflow."
    ],
    messaging: {
      promise: `Help users complete the core ${title} workflow with clarity.`,
      avoid: [
        "Unapproved visual themes",
        "Decorative imagery not tied to user tasks",
        "Ambiguous action labels"
      ]
    }
  };
}

function buildUxRules(platform, keywords) {
  const rules = [
    {
      id: "ux.rule.001",
      appliesTo: platform.value,
      rule: "Keep the primary action and current task context visible on every core screen."
    },
    {
      id: "ux.rule.002",
      appliesTo: platform.value,
      rule: "Define default, loading, empty, and error states before visual generation."
    },
    {
      id: "ux.rule.003",
      appliesTo: platform.value,
      rule: "Preserve navigation orientation across transitions and recoverable errors."
    }
  ];

  if (keywords.includes("accessibility")) {
    rules.push({
      id: "ux.rule.004",
      appliesTo: platform.value,
      rule: "Treat keyboard/focus order, text contrast, and readable labels as core acceptance criteria."
    });
  }

  return rules;
}

function buildDecisions(title, platform, keywords, requirements, screens) {
  const decisions = [
    {
      id: "decision.001",
      status: platform.status === "selected" ? "accepted" : "blocked",
      decision: platform.status === "selected" ? `Use ${platform.value} as the selected UX platform.` : "UX platform selection is missing.",
      rationale: platform.status === "selected" ? `Detected from ${platform.source}.` : "Stage 06 cannot generate UX rules without an explicit platform.",
      sourceArtifacts: ["inputs.project-material"]
    },
    {
      id: "decision.002",
      status: "accepted",
      decision: `Use ${screens.length} generated screens as the canonical screen model for ${title}.`,
      rationale: "Screens were derived from requirement language and recognized product workflow keywords.",
      sourceArtifacts: ["canonical.requirements", "canonical.screen-model"]
    },
    {
      id: "decision.003",
      status: "accepted",
      decision: `Map ${requirements.length} requirements into the coverage matrix.`,
      rationale: "Coverage must be visible before downstream design artifacts are generated.",
      sourceArtifacts: ["canonical.requirements", "canonical.coverage-matrix"]
    },
    {
      id: "decision.004",
      status: "proposed",
      decision: "Generate primary visual anchor proposals without approving a visual direction.",
      rationale: "Stage 06 is planning-only for visual anchors; visual references belong to Stage 07.",
      sourceArtifacts: ["canonical.visual-anchor-proposals"]
    }
  ];

  if (keywords.includes("security")) {
    decisions.push({
      id: "decision.005",
      status: "accepted",
      decision: "Treat security-sensitive actions as explicit confirmation flows.",
      rationale: "Security was detected in project inputs.",
      sourceArtifacts: ["inputs.project-material", "canonical.interaction-model"]
    });
  }

  return decisions;
}

function buildVisualAnchors(screens, brand) {
  return screens
    .filter((screen) => screen.priority === "primary")
    .slice(0, 3)
    .map((screen, index) => ({
      id: `visual-anchor.proposal.${String(index + 1).padStart(3, "0")}`,
      screenId: screen.id,
      screenName: screen.name,
      priority: index === 0 ? "primary" : "secondary",
      rationale: `Use ${screen.name} to test ${brand.attributes.slice(0, 3).join(", ")} brand attributes against the main workflow.`,
      approved: false,
      requiresManualSelection: true
    }));
}

function buildCoverage(requirements, stories, screens, screenStates, decisions) {
  const rows = requirements.map((requirement, index) => {
    const story = stories.find((candidate) => candidate.requirementId === requirement.id);
    const screen = screens[index % screens.length];
    const stateEntry = screenStates.find((candidate) => candidate.screenId === screen.id);
    return {
      requirementId: requirement.id,
      storyId: story ? story.id : null,
      screenId: screen.id,
      states: stateEntry ? stateEntry.states.map((state) => state.name) : [],
      decisionIds: decisions.slice(0, 3).map((decision) => decision.id),
      coverageStatus: "covered"
    };
  });

  return {
    rows,
    gaps: rows.length === 0 ? ["No requirements were available for coverage."] : []
  };
}

function buildViewTaxonomy(screens) {
  const groups = {};
  for (const screen of screens) {
    groups[screen.type] = groups[screen.type] || [];
    groups[screen.type].push(screen.id);
  }
  return Object.keys(groups).sort().map((type) => ({
    type,
    screenIds: groups[type]
  }));
}

function buildOpenQuestions(analysis) {
  const questions = [];
  if (analysis.platform.status !== "selected") {
    questions.push("Which platform or surface should the UX rules target?");
  }
  if (analysis.goals.length === 0) {
    questions.push("What outcome defines success for the primary workflow?");
  }
  if (analysis.constraints.length === 0) {
    questions.push("Are there accessibility, compliance, privacy, or implementation constraints?");
  }
  return questions;
}

function buildInterviewQuestions(analysis) {
  return [
    "Who is the primary user and what task are they trying to complete?",
    analysis.platform.status === "selected" ? `What platform-specific constraints apply to ${analysis.platform.value}?` : "What target platform or surface should this experience use?",
    "Which screens are mandatory for the first usable version?",
    "Which decisions are already approved and should be preserved?"
  ];
}

function buildMissingInformation(analysis) {
  const missing = [];
  if (analysis.platform.status !== "selected") missing.push("platform-selection");
  if (analysis.goals.length === 0) missing.push("success-goals");
  if (analysis.constraints.length === 0) missing.push("constraints");
  return missing;
}

function countActions(writes) {
  return writes.reduce((counts, write) => {
    counts[write.action] += 1;
    return counts;
  }, { create: 0, overwrite: 0, preserve: 0 });
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

function normalizeSubskillName(name) {
  const normalized = name.startsWith("autodesign-") ? name.slice("autodesign-".length) : name;
  return normalized === "visual-anchor" ? "visual-anchors" : normalized;
}

function cleanSentence(value, maxLength) {
  const cleaned = String(value).replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxLength - 1).trim()}.`;
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

main().catch((error) => {
  process.stderr.write(`autodesign generate-canonical error: ${error.message}\n`);
  process.exitCode = 1;
});
