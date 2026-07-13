import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
// @ts-expect-error - node:sqlite is in Node 22.5+ but types might be outdated
import { DatabaseSync } from "node:sqlite";

const execAsync = promisify(exec);

// Helper to get or initialize the shadow git database for a project
function getShadowDb(projectPath: string) {
  const dbPath = path.join(projectPath, ".ai_history.db");
  const db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS ai_commits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      patch TEXT,
      message TEXT,
      author TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_file_path ON ai_commits(file_path);
  `);

  return db;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectPath = searchParams.get('project') || undefined;
  const project = searchParams.get("project");
  const filePath = searchParams.get("filePath");
  const action = searchParams.get("action"); // 'history' | 'diff'

  if (!project || !filePath || !action) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  try {
    if (action === "history") {
      const db = getShadowDb(project);
      
      // Get AI commits for this file, ordered by newest first
      const stmt = db.prepare(`
        SELECT * FROM ai_commits 
        WHERE file_path = ? 
        ORDER BY timestamp DESC 
        LIMIT 50
      `);
      const rows = stmt.all(filePath);

      // Map to the format expected by the frontend
      const history = rows.map((row: any) => ({
        hash: `ai-${row.id}`,
        author: row.author,
        date: row.timestamp,
        message: row.message,
        isAI: true,
        patch: row.patch
      }));

      return NextResponse.json({ history });

    } else if (action === "diff") {
      // Get the formal Git diff against HEAD
      let diff = "";
      try {
        const { stdout } = await execAsync(`git diff HEAD -- "${filePath}"`, { cwd: project });
        diff = stdout;
        
        if (!diff && fs.existsSync(filePath)) {
          // Check if untracked
          const { stdout: statusOut } = await execAsync(`git status --porcelain "${filePath}"`, { cwd: project });
          if (statusOut.trim().startsWith('??')) {
            const content = fs.readFileSync(filePath, 'utf-8');
            diff = `--- /dev/null\n+++ b/${path.basename(filePath)}\n@@ -0,0 +1,${content.split('\n').length} @@\n` + 
                   content.split('\n').map(l => '+' + l).join('\n');
          }
        }
      } catch (err: any) {
        console.error("Git diff failed:", err);
        diff = ""; 
      }

      return NextResponse.json({ diff });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    console.error("AI Git error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { project, filePath, patch, message, author } = body;

    if (!project || !filePath || !patch || !message) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const db = getShadowDb(project);
    const stmt = db.prepare(`
      INSERT INTO ai_commits (file_path, patch, message, author)
      VALUES (?, ?, ?, ?)
    `);
    
    const info = stmt.run(filePath, patch, message, author || "Antigravity AI");

    return NextResponse.json({ success: true, commitId: info.lastInsertRowid });
  } catch (error: any) {
    console.error("AI Git insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
