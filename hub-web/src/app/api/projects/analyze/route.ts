import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { taskManager } from "@/lib/task-manager";

import { runningProcesses } from "@/lib/process-manager";
import { getCodebaseMemoryExecutable } from "@/lib/runtime-config";

export async function POST(req: Request) {
  try {
    const { path: targetPath, projectId, options } = await req.json();

    if (!targetPath || !fs.existsSync(targetPath)) {
      return NextResponse.json({ error: "Invalid path provided." }, { status: 400 });
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "Path must be a directory." }, { status: 400 });
    }

    // Set UA language config if provided
    if (options?.language) {
      const uaDir = path.join(targetPath, '.understand-anything');
      if (!fs.existsSync(uaDir)) {
        fs.mkdirSync(uaDir, { recursive: true });
      }
      const configPath = path.join(uaDir, 'config.json');
      let config = { autoUpdate: false, outputLanguage: options.language };
      if (fs.existsSync(configPath)) {
        try {
          const existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          config = { ...existing, outputLanguage: options.language };
        } catch {
          console.warn("Failed to read existing UA config, overwriting.");
        }
      }
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    }

    // 1. Create a Task
    const task = taskManager.createTask("analysis", targetPath, { projectId });

    // 2. Start the analysis process asynchronously
    (async () => {
      try {
        taskManager.updateTaskStatus(task.id, "running");
        taskManager.appendTaskLog(task.id, `[System] Starting Agentic Analysis for: ${targetPath}`);
        taskManager.appendTaskLog(task.id, `[Codebase-Memory] Starting physical indexer...`);

        const executable = getCodebaseMemoryExecutable();

        const payload = JSON.stringify({ repo_path: targetPath });

        const child = spawn(executable, ['cli', 'index_repository', payload], {
          cwd: targetPath,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { 
            ...process.env,
            CBM_CACHE_DIR: require("@/lib/runtime-config").getCodebaseMemoryCacheRoot()
          }
        });

        runningProcesses.set(task.id, child);

        child.stdout.on('data', (data) => {
          const lines = data.toString().split('\n');
          for (const line of lines) {
            if (line.trim()) taskManager.appendTaskLog(task.id, `[CBM] ${line.trim()}`);
          }
        });

        child.stderr.on('data', (data) => {
          const lines = data.toString().split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
              if (trimmed.includes('level=info') || trimmed.includes('level=warn')) {
                taskManager.appendTaskLog(task.id, `[CBM] ${trimmed}`);
              } else {
                taskManager.appendTaskLog(task.id, `[CBM Error] ${trimmed}`);
              }
            }
          }
        });

        child.on('close', (code) => {
          runningProcesses.delete(task.id);
          const currentTask = taskManager.getTask(task.id);
          if (currentTask?.status === "cancelled") {
            // Already cancelled by user
            return;
          }

          if (code === 0) {
            taskManager.appendTaskLog(task.id, `[Codebase-Memory] Indexing completed successfully.`);
            
            const clientHandlesUA = options?.clientHandlesUA === true;

            if (clientHandlesUA) {
              taskManager.appendTaskLog(task.id, `[System] 物理上下文建立完毕。请本地大模型客户端接管执行 Understand-Anything 分析。`);
              taskManager.updateTaskStatus(task.id, "completed");
            } else {
              taskManager.appendTaskLog(task.id, `[Understand-Anything] Semantic Mapping started via Server LLM...`);
              
              // Lazy load provider to avoid circular deps if any
              import("@/lib/llm/provider").then(async ({ getLLMProvider }) => {
                try {
                  const llm = getLLMProvider();
                  await llm.executeUnderstandAnything(targetPath, {
                    ...options,
                    onProgress: (message) => taskManager.appendTaskLog(task.id, message),
                  });
                  taskManager.appendTaskLog(task.id, `[Understand-Anything] Semantic Mapping complete.`);
                  taskManager.updateTaskStatus(task.id, "completed");
                } catch (error: unknown) {
                  const message = error instanceof Error ? error.message : String(error);
                  taskManager.appendTaskLog(task.id, `[Understand-Anything Error] ${message}`);
                  taskManager.updateTaskStatus(task.id, "completed");
                }
              });
            }
          } else {
            taskManager.appendTaskLog(task.id, `[Codebase-Memory Error] Process exited with code ${code}`);
            taskManager.updateTaskStatus(task.id, "failed", `Process exited with code ${code}`);
          }
        });

        child.on('error', (err) => {
          runningProcesses.delete(task.id);
          taskManager.appendTaskLog(task.id, `[System Error] Failed to start codebase-memory-mcp: ${err.message}`);
          taskManager.updateTaskStatus(task.id, "failed", err.message);
        });

      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        taskManager.appendTaskLog(task.id, `[System Error] ${message}`);
        taskManager.updateTaskStatus(task.id, "failed", message);
      }
    })();

    // 3. Immediately return the Task ID
    return NextResponse.json({
      taskId: task.id,
      status: "pending",
      message: "Analysis task started"
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
