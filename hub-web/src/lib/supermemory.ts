import fs from "fs";
import path from "path";

export interface SupermemorySchema {
  version: string;
  projectPath: string;
  lastAnalyzedAt: number;
  summary: string;
  coreModules: string[];
  architecturalGuidelines: string[];
}

export class Supermemory {
  public static getSupermemoryPath(projectPath: string): string {
    return path.join(projectPath, ".supermemory", "supermemory.json");
  }

  public static read(projectPath: string): SupermemorySchema | null {
    const smPath = this.getSupermemoryPath(projectPath);
    if (!fs.existsSync(smPath)) return null;
    try {
      const content = fs.readFileSync(smPath, "utf8");
      return JSON.parse(content) as SupermemorySchema;
    } catch {
      return null;
    }
  }

  public static write(projectPath: string, data: Partial<SupermemorySchema>): SupermemorySchema {
    const smPath = this.getSupermemoryPath(projectPath);
    const dir = path.dirname(smPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const existing = this.read(projectPath) || {
      version: "1.0",
      projectPath,
      lastAnalyzedAt: Date.now(),
      summary: "",
      coreModules: [],
      architecturalGuidelines: []
    };

    const updated: SupermemorySchema = {
      ...existing,
      ...data,
      projectPath,
      lastAnalyzedAt: Date.now()
    };

    fs.writeFileSync(smPath, JSON.stringify(updated, null, 2), "utf8");
    return updated;
  }
}
