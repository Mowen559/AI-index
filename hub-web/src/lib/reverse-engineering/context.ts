import fs from "fs";
import path from "path";
import { getCodebaseMemoryDbPath } from "@/lib/runtime-config";
import { searchSupermemoryMemories } from "@/lib/supermemory-store";
import type { ProjectContextMatch, RequirementSchema } from "@/lib/reverse-engineering/types";
import { buildContextQuery } from "@/lib/reverse-engineering/enricher";
import { unique } from "@/lib/reverse-engineering/utils";

export function querySupermemoryForRequirement(schema: RequirementSchema, limit: number, projectPath: string) {
  return {
    query: buildContextQuery(schema),
    matches: searchSupermemoryMemories(buildContextQuery(schema), limit, projectPath),
  };
}

export function queryCodebaseMemory(terms: string[], limit: number, projectPath: string): ProjectContextMatch[] {
  const dbPath = getCodebaseMemoryDbPath(projectPath);
  if (!fs.existsSync(dbPath)) return [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3");
    const db = new Database(dbPath, { readonly: true });
    const matches = new Map<string, ProjectContextMatch>();
    const statement = db.prepare(`
      SELECT name, label, file_path
      FROM nodes
      WHERE LOWER(COALESCE(name, '')) LIKE ?
         OR LOWER(COALESCE(qualified_name, '')) LIKE ?
         OR LOWER(COALESCE(file_path, '')) LIKE ?
      LIMIT ?
    `);

    for (const term of terms.filter((item) => item.trim().length >= 3)) {
      const like = `%${term.toLowerCase()}%`;
      const rows = statement.all(like, like, like, Math.max(3, Math.ceil(limit / 2))) as Array<{
        name?: string;
        label?: string;
        file_path?: string;
      }>;

      for (const row of rows) {
        const filePath = row.file_path || "";
        const key = `${row.name || "unknown"}:${filePath}`;
        if (!matches.has(key)) {
          matches.set(key, {
            name: row.name || path.basename(filePath) || "unknown",
            kind: row.label || "unknown",
            file_path: filePath,
            matched_from: term,
          });
        }
      }
    }

    db.close();
    return Array.from(matches.values()).slice(0, limit);
  } catch {
    return [];
  }
}

export function buildCodeSearchTerms(schema: RequirementSchema) {
  return unique([
    ...schema.modules,
    ...schema.business_objects,
    ...schema.features.map((feature) => feature.replace(/_/g, "")),
  ]);
}

export function isStrongImplementationEvidence(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("/test/")) return false;
  if (normalized.includes("/tests/")) return false;
  if (normalized.includes("/fixtures/")) return false;
  if (normalized.includes("/skills/")) return false;
  if (normalized.includes("/docs/")) return false;
  if (normalized.endsWith(".md") || normalized.endsWith(".json")) return false;
  return normalized.includes("/src/") || normalized.includes("/app/") || normalized.includes("/packages/");
}
