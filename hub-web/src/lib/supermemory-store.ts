import fs from "fs";
import path from "path";
import {
  getSupermemoryStorePath,
  getUnderstandAnythingKnowledgeGraphCandidates,
} from "@/lib/runtime-config";

export interface SupermemoryRecord {
  id: string;
  filePath: string;
  name: string;
  summary: string;
  tags: string[];
  complexity: string;
  nodeType: string;
  sourceGraphPath: string;
  sourceLabel: string;
  updatedAt: string;
}

export interface SupermemoryLogEntry {
  id: string;
  timestamp: string;
  type: "query" | "sync" | "system";
  message?: string;
  query?: string;
  response?: string;
  tokensUsed?: number;
  matchedMemoryIds?: string[];
}

export interface SupermemoryStoreData {
  version: 1;
  memories: SupermemoryRecord[];
  logs: SupermemoryLogEntry[];
  stats: {
    totalQueries: number;
    activeAgents: number;
    lastSync: string;
    totalMemories: number;
    syncedSources: string[];
  };
}

interface KnowledgeGraphNode {
  id?: string;
  type?: string;
  name?: string;
  filePath?: string;
  summary?: string;
  tags?: string[];
  complexity?: string;
}

export interface SupermemorySyncResult {
  store: SupermemoryStoreData;
  syncedSources: string[];
  totalMemories: number;
  addedCount: number;
  updatedCount: number;
}

function getStorePath(projectPath?: string) {
  return getSupermemoryStorePath(projectPath);
}

function findNearestKnowledgeGraphProject(filePath: string) {
  let current = fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()
    ? filePath
    : path.dirname(filePath);

  while (current && current !== path.dirname(current)) {
    if (
      fs.existsSync(path.join(current, ".understand-anything", "knowledge-graph.json")) ||
      fs.existsSync(path.join(current, ".supermemory", "knowledge-graph.json"))
    ) {
      return current;
    }
    current = path.dirname(current);
  }

  return null;
}

function normalizePathValue(value: string) {
  return value.replace(/\\/g, "/").replace(/^\.\/+/, "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

const SUPERMEMORY_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "for",
  "how",
  "in",
  "is",
  "of",
  "or",
  "the",
  "to",
  "with",
]);

function createEmptyStore(): SupermemoryStoreData {
  return {
    version: 1,
    memories: [],
    logs: [],
    stats: {
      totalQueries: 0,
      activeAgents: 1,
      lastSync: nowIso(),
      totalMemories: 0,
      syncedSources: [],
    },
  };
}

function readStore(projectPath?: string): SupermemoryStoreData {
  const storePath = getStorePath(projectPath);
  if (!fs.existsSync(storePath)) {
    const empty = createEmptyStore();
    writeStore(empty, projectPath);
    return empty;
  }
  try {
    const data = fs.readFileSync(storePath, "utf8");
    return JSON.parse(data) as SupermemoryStoreData;
  } catch (error) {
    console.error("Failed to parse supermemory store, returning empty.", error);
    return createEmptyStore();
  }
}

function writeStore(store: SupermemoryStoreData, projectPath?: string) {
  const storePath = getStorePath(projectPath);
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
}

function buildSourceLabel(graphPath: string) {
  const normalized = normalizePathValue(graphPath).toLowerCase();
  if (normalized.includes("/gitnexus/.understand-anything/")) {
    return "GitNexus Understand-Anything";
  }
  if (normalized.includes("/.understand-anything/")) {
    return "Workspace Understand-Anything";
  }
  if (normalized.includes("/.supermemory/")) {
    return "Supermemory Graph";
  }
  if (normalized.includes("/packages/dashboard/public/knowledge-graph.json")) {
    return "Understand-Anything Demo Graph";
  }
  return "Knowledge Graph";
}

function getSourcePriority(graphPath: string) {
  const normalized = normalizePathValue(graphPath).toLowerCase();
  if (normalized.includes("/gitnexus/.understand-anything/")) return 4;
  if (normalized.includes("/.understand-anything/")) return 3;
  if (normalized.includes("/.supermemory/")) return 2;
  if (normalized.includes("/packages/dashboard/public/knowledge-graph.json")) return 1;
  return 0;
}

function readKnowledgeGraphNodes(graphPath: string) {
  const raw = fs.readFileSync(graphPath, "utf8");
  const parsed = JSON.parse(raw) as { nodes?: KnowledgeGraphNode[] };
  return Array.isArray(parsed.nodes) ? parsed.nodes : [];
}

function makeRecord(node: KnowledgeGraphNode, graphPath: string): SupermemoryRecord | null {
  const filePath = typeof node.filePath === "string" ? normalizePathValue(node.filePath) : "";
  const summary = typeof node.summary === "string" ? node.summary.trim() : "";
  if (!filePath || !summary) {
    return null;
  }

  return {
    id: filePath,
    filePath,
    name: typeof node.name === "string" && node.name.trim() ? node.name.trim() : path.basename(filePath),
    summary,
    tags: Array.isArray(node.tags)
      ? node.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
      : [],
    complexity:
      typeof node.complexity === "string" && node.complexity.trim()
        ? node.complexity.trim()
        : "moderate",
    nodeType: typeof node.type === "string" && node.type.trim() ? node.type.trim() : "file",
    sourceGraphPath: graphPath,
    sourceLabel: buildSourceLabel(graphPath),
    updatedAt: nowIso(),
  };
}

function chooseBetterRecord(current: SupermemoryRecord, next: SupermemoryRecord) {
  const currentPriority = getSourcePriority(current.sourceGraphPath);
  const nextPriority = getSourcePriority(next.sourceGraphPath);
  if (nextPriority !== currentPriority) {
    return nextPriority > currentPriority ? next : current;
  }

  const currentSignal = current.summary.length + current.tags.length * 20;
  const nextSignal = next.summary.length + next.tags.length * 20;
  return nextSignal > currentSignal ? next : current;
}

export function syncSupermemoryFromKnowledgeGraphs(projectPath?: string): SupermemorySyncResult {
  const store = readStore(projectPath);
  const existingById = new Map(store.memories.map((memory) => [memory.id, memory]));
  const nextById = new Map<string, SupermemoryRecord>();
  const syncedSources: string[] = [];

  for (const graphPath of getUnderstandAnythingKnowledgeGraphCandidates(projectPath)) {
    if (!fs.existsSync(graphPath)) {
      continue;
    }
    syncedSources.push(graphPath);
    const nodes = readKnowledgeGraphNodes(graphPath);
    for (const node of nodes) {
      const record = makeRecord(node, graphPath);
      if (!record) continue;
      const current = nextById.get(record.id);
      nextById.set(record.id, current ? chooseBetterRecord(current, record) : record);
    }
  }

  let addedCount = 0;
  let updatedCount = 0;
  const nextMemories = Array.from(nextById.values())
    .map((memory) => {
      const previous = existingById.get(memory.id);
      if (!previous) {
        addedCount += 1;
        return memory;
      }

      const changed =
        previous.summary !== memory.summary ||
        previous.complexity !== memory.complexity ||
        previous.sourceGraphPath !== memory.sourceGraphPath ||
        JSON.stringify(previous.tags) !== JSON.stringify(memory.tags);

      if (changed) {
        updatedCount += 1;
        return { ...memory, updatedAt: nowIso() };
      }

      return previous;
    })
    .sort((a, b) => a.filePath.localeCompare(b.filePath));

  store.memories = nextMemories;
  store.stats.lastSync = nowIso();
  store.stats.totalMemories = nextMemories.length;
  store.stats.syncedSources = syncedSources;

  if (addedCount > 0 || updatedCount > 0 || store.logs.length === 0) {
    store.logs = [
      {
        id: `sync-${Date.now()}`,
        timestamp: nowIso(),
        type: "sync" as const,
        message: `Synced ${nextMemories.length} memories from ${syncedSources.length} knowledge graph source(s). Added ${addedCount}, updated ${updatedCount}.`,
      },
      ...store.logs,
    ].slice(0, 60);
  }

  writeStore(store);

  return {
    store,
    syncedSources,
    totalMemories: nextMemories.length,
    addedCount,
    updatedCount,
  };
}

export function findSupermemoryMemoryForFile(filePath: string) {
  const normalized = normalizePathValue(filePath);
  const projectPath = findNearestKnowledgeGraphProject(filePath) || undefined;
  const { store } = syncSupermemoryFromKnowledgeGraphs(projectPath);

  return (
    store.memories.find((memory) => memory.filePath === normalized) ||
    store.memories.find(
      (memory) =>
        normalized.endsWith(memory.filePath) || memory.filePath.endsWith(normalized),
    ) ||
    null
  );
}

export function searchSupermemoryMemories(query: string, limit = 5, projectPath?: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const { store } = syncSupermemoryFromKnowledgeGraphs(projectPath);

  if (!normalizedQuery) {
    return store.memories.slice(0, limit);
  }

  const terms = normalizedQuery
    .split(/[\s,.:;!?()[\]{}<>/"'`|+-]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !SUPERMEMORY_STOP_WORDS.has(term));

  return store.memories
    .map((memory) => {
      let score = 0;
      const normalizedPath = memory.filePath.toLowerCase();
      const normalizedName = memory.name.toLowerCase();
      const normalizedSummary = memory.summary.toLowerCase();
      const normalizedTags = memory.tags.map((tag) => tag.toLowerCase());
      const baseName = path.basename(normalizedPath, path.extname(normalizedPath));
      const haystacks = [
        normalizedPath,
        normalizedName,
        normalizedSummary,
        normalizedTags.join(" "),
      ];

      for (const term of terms) {
        if (baseName === term) score += 12;
        if (normalizedName === term) score += 10;
        if (normalizedPath.includes(`/${term}.`) || normalizedPath.endsWith(`/${term}`)) score += 9;
        if (normalizedPath.includes(term)) score += 6;
        if (normalizedName.includes(term)) score += 5;
        if (normalizedSummary.includes(term)) score += 4;
        if (normalizedTags.some((tag) => tag.includes(term))) score += 3;
      }

      if (score === 0 && haystacks.some((value) => value.includes(normalizedQuery))) {
        score += 2;
      }

      return { memory, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.memory.filePath.localeCompare(b.memory.filePath))
    .slice(0, limit)
    .map((entry) => entry.memory);
}

export function recordSupermemoryQuery(query: string, reply: string, matchedMemoryIds: string[]) {
  const store = readStore();
  store.stats.totalQueries += 1;
  store.logs = [
    {
      id: `query-${Date.now()}`,
      timestamp: nowIso(),
      type: "query" as const,
      query,
      response: reply,
      matchedMemoryIds,
      tokensUsed: Math.max(80, reply.length),
    },
    ...store.logs,
  ].slice(0, 60);
  writeStore(store);
  return store;
}

export function getSupermemoryStoreSnapshot() {
  return syncSupermemoryFromKnowledgeGraphs().store;
}
