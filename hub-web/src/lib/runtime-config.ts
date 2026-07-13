import fs from "fs";
import path from "path";
import { hasUsableLLMSettings, readLLMSettings } from "@/lib/llm/settings";
import { getAppDataPath, getBundleRoot, isBundledRuntime } from "@/lib/app-paths";

export type HealthState = "ok" | "warning" | "error";

export interface RuntimeStatus {
  key: string;
  label: string;
  state: HealthState;
  message: string;
  path?: string;
}

function normalizeEnvPath(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? path.resolve(/* turbopackIgnore: true */ trimmed) : null;
}

function firstExistingPath(candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function getWorkspaceRoot() {
  return (
    normalizeEnvPath(process.env.HUB_WORKSPACE_ROOT) ??
    path.resolve(/* turbopackIgnore: true */ process.cwd(), "..")
  );
}

export function getBundledMcpToolsRoot() {
  return path.join(getBundleRoot(), "mcp-tools");
}

export function getGitNexusRoot(projectPath?: string) {
  if (projectPath) return projectPath;
  return (
    normalizeEnvPath(process.env.HUB_GITNEXUS_ROOT) ??
    path.join(getWorkspaceRoot(), "GitNexus")
  );
}

export function getGitNexusRepoRoot(projectPath?: string) {
  if (projectPath) return projectPath;
  return (
    normalizeEnvPath(process.env.HUB_GITNEXUS_REPO_ROOT) ??
    path.join(getGitNexusRoot(), "gitnexus")
  );
}

export function getUnderstandAnythingRoot() {
  return (
    normalizeEnvPath(process.env.HUB_UNDERSTAND_ANYTHING_ROOT) ??
    path.join(getWorkspaceRoot(), "Understand-Anything", "understand-anything-plugin")
  );
}

export function getCodegraphRoot() {
  return (
    normalizeEnvPath(process.env.HUB_CODEGRAPH_ROOT) ??
    path.join(getWorkspaceRoot(), "codegraph")
  );
}

export function getCodegraphDbPath(projectPath?: string) {
  if (projectPath) {
    return path.join(projectPath, ".codegraph", "codegraph.db");
  }
  const explicit = normalizeEnvPath(process.env.HUB_CODEGRAPH_DB_PATH);
  if (explicit) return explicit;
  return path.join(getWorkspaceRoot(), ".codegraph", "codegraph.db");
}

export function getShadowGitRoot(projectPath?: string) {
  if (projectPath) return require('path').join(projectPath, '.shadow-git');
  return (
    normalizeEnvPath(process.env.HUB_SHADOW_GIT_ROOT) ??
    (isBundledRuntime() ? getAppDataPath("shadow-git") : path.join(getWorkspaceRoot(), ".shadow-git"))
  );
}

export function getProjectRoot(projectPath?: string) {
  if (projectPath) return projectPath;
  return normalizeEnvPath(process.env.HUB_PROJECT_ROOT) ?? getWorkspaceRoot();
}

export function getProjectsRoot() {
  return (
    normalizeEnvPath(process.env.HUB_PROJECTS_ROOT) ??
    getAppDataPath("projects")
  );
}

export function getCodebaseMemoryCacheRoot() {
  return (
    normalizeEnvPath(process.env.HUB_CODEBASE_MEMORY_CACHE_ROOT) ??
    (isBundledRuntime()
      ? getAppDataPath("cache", "codebase-memory-mcp")
      : path.join(
          /* turbopackIgnore: true */ process.env.USERPROFILE || process.env.HOME || "",
          ".cache",
          "codebase-memory-mcp",
        ))
  );
}

export function getCodebaseMemoryExecutable() {
  const extension = process.platform === "win32" ? ".exe" : "";
  const explicit = normalizeEnvPath(process.env.HUB_CODEBASE_MEMORY_BIN);
  const bundled = path.join(
    getBundledMcpToolsRoot(),
    "codebase-memory-mcp",
    `codebase-memory-mcp${extension}`,
  );

  return (
    firstExistingPath([explicit, bundled]) ??
    `codebase-memory-mcp${extension}`
  );
}

export function getCodebaseMemoryDbPath(projectPath?: string) {
  const explicit = normalizeEnvPath(process.env.HUB_CODEBASE_MEMORY_DB_PATH);
  if (explicit) return explicit;

  const repoRoot = getProjectRoot(projectPath);
  const dbName =
    repoRoot.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") + ".db";
  return path.join(getCodebaseMemoryCacheRoot(), dbName);
}

export function getUnderstandAnythingKnowledgeGraphPath(projectPath?: string) {
  return firstExistingPath(getUnderstandAnythingKnowledgeGraphCandidates(projectPath));
}

export function getUnderstandAnythingKnowledgeGraphCandidates(projectPath?: string) {
  const explicit = normalizeEnvPath(process.env.HUB_KNOWLEDGE_GRAPH_PATH);
  const candidates = [
    explicit,
  ];

  if (projectPath) {
    candidates.push(path.join(projectPath, ".understand-anything", "knowledge-graph.json"));
    candidates.push(path.join(projectPath, ".supermemory", "knowledge-graph.json"));
  }

  candidates.push(
    path.join(getGitNexusRoot(), ".understand-anything", "knowledge-graph.json"),
    path.join(getWorkspaceRoot(), ".understand-anything", "knowledge-graph.json"),
    path.join(getGitNexusRoot(), ".supermemory", "knowledge-graph.json"),
    path.join(getWorkspaceRoot(), ".supermemory", "knowledge-graph.json"),
    path.join(
      getUnderstandAnythingRoot(),
      "packages",
      "dashboard",
      "public",
      "knowledge-graph.json",
    ),
  );

  return Array.from(new Set(candidates.filter((candidate): candidate is string => Boolean(candidate))));
}

export function getSupermemoryStorePath(projectPath?: string) {
  if (projectPath) {
    return path.join(projectPath, ".supermemory", "supermemory.json");
  }
  return path.join(getShadowGitRoot(), "supermemory_store.json");
}

export function getRuntimeStatuses(projectPath?: string): RuntimeStatus[] {
  const codebaseMemoryDb = getCodebaseMemoryDbPath(projectPath);
  const codegraphDb = getCodegraphDbPath(projectPath);
  const gitNexusRepo = getGitNexusRepoRoot(projectPath);
  const knowledgeGraph = getUnderstandAnythingKnowledgeGraphPath(projectPath);
  const knowledgeGraphCandidates = getUnderstandAnythingKnowledgeGraphCandidates(projectPath).filter((candidate) =>
    fs.existsSync(candidate),
  );
  const shadowGitRoot = getShadowGitRoot(projectPath);
  const projectsRoot = getProjectsRoot();
  const supermemoryStore = getSupermemoryStorePath(projectPath);
  const llmSettings = readLLMSettings();
  const llmReady = hasUsableLLMSettings(llmSettings);

  return [
    {
      key: "llm-provider",
      label: "LLM Provider",
      state: llmReady ? "ok" : llmSettings.enabled ? "warning" : "warning",
      message: llmReady
        ? `Configured for model ${llmSettings.model} via ${llmSettings.baseUrl}.`
        : llmSettings.enabled
          ? "LLM is enabled but base URL, API key, or model is incomplete."
          : "LLM is not configured yet. Understand-Anything and reverse parsing will use fallback rules.",
    },
    {
      key: "projects-root",
      label: "Projects Root",
      state: "ok",
      message: "Git repositories are cloned here before analysis.",
      path: projectsRoot,
    },
    {
      key: "codebase-memory-db",
      label: "Codebase Memory DB",
      state: fs.existsSync(codebaseMemoryDb) ? "ok" : "warning",
      message: fs.existsSync(codebaseMemoryDb)
        ? "Indexed graph database detected."
        : "Graph database not found. Run project analysis first.",
      path: codebaseMemoryDb,
    },
    {
      key: "gitnexus-runtime",
      label: "GitNexus Runtime",
      state: fs.existsSync(gitNexusRepo) ? "ok" : "error",
      message: fs.existsSync(gitNexusRepo)
        ? "GitNexus repository root detected."
        : "GitNexus repository root not found.",
      path: gitNexusRepo,
    },
    {
      key: "codegraph-db",
      label: "CodeGraph DB",
      state: fs.existsSync(codegraphDb) ? "ok" : "warning",
      message: fs.existsSync(codegraphDb)
        ? "CodeGraph database detected."
        : "CodeGraph database not found. File explorer will degrade.",
      path: codegraphDb,
    },
    {
      key: "understand-anything-metadata",
      label: "Understand-Anything Metadata",
      state: knowledgeGraph ? "ok" : "warning",
      message: knowledgeGraph
        ? `Knowledge graph metadata detected from ${knowledgeGraphCandidates.length} source(s).`
        : "Metadata file not found. Summary/tags/complexity will be unavailable.",
      path: knowledgeGraph ?? undefined,
    },
    {
      key: "shadow-git",
      label: "Shadow Git Workspace",
      state: fs.existsSync(shadowGitRoot) ? "ok" : "warning",
      message: fs.existsSync(shadowGitRoot)
        ? "Shadow Git workspace detected."
        : "Shadow Git workspace not found. AI history views may degrade.",
      path: shadowGitRoot,
    },
    {
      key: "supermemory-chat",
      label: "Supermemory Chat",
      state: fs.existsSync(supermemoryStore) || Boolean(knowledgeGraph) ? "ok" : "warning",
      message:
        fs.existsSync(supermemoryStore) || Boolean(knowledgeGraph)
          ? "Local supermemory sync is available for retrieval and activity logs."
          : "Supermemory store not initialized yet.",
      path: fs.existsSync(supermemoryStore) ? supermemoryStore : undefined,
    },
  ];
}
