import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getAppDataPath } from "@/lib/app-paths";

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface Task {
  id: string;
  type: string;
  projectPath: string;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  durationMs?: number;
  error?: string;
  payload?: Record<string, unknown>;
}

export class TaskManager {
  private getTasksDir(): string {
    const dir = getAppDataPath("tasks");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private getTaskFilePath(taskId: string): string {
    return path.join(this.getTasksDir(), `${taskId}.json`);
  }

  public getTaskLogFilePath(taskId: string): string {
    return path.join(this.getTasksDir(), `${taskId}.log`);
  }

  public createTask(type: string, projectPath: string, payload?: Record<string, unknown>): Task {
    const taskId = randomUUID();
    const task: Task = {
      id: taskId,
      type,
      projectPath,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      payload
    };
    this.saveTask(task);
    fs.writeFileSync(this.getTaskLogFilePath(taskId), `[System] Task ${taskId} created.\n`, "utf8");
    return task;
  }

  public getTask(taskId: string): Task | null {
    const filePath = this.getTaskFilePath(taskId);
    if (!fs.existsSync(filePath)) return null;
    try {
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data) as Task;
    } catch {
      return null;
    }
  }

  public updateTaskStatus(taskId: string, status: TaskStatus, error?: string): void {
    const task = this.getTask(taskId);
    if (task) {
      task.status = status;
      task.updatedAt = Date.now();
      if (status === "completed" || status === "failed" || status === "cancelled") {
         task.durationMs = task.updatedAt - task.createdAt;
      }
      if (error) {
        task.error = error;
      }
      this.saveTask(task);
    }
  }

  public appendTaskLog(taskId: string, log: string): void {
    const logPath = this.getTaskLogFilePath(taskId);
    if (fs.existsSync(logPath)) {
      fs.appendFileSync(logPath, `${log}\n`, "utf8");
    } else {
      fs.writeFileSync(logPath, `${log}\n`, "utf8");
    }
  }

  public getTaskLogs(taskId: string): string {
    const logPath = this.getTaskLogFilePath(taskId);
    if (!fs.existsSync(logPath)) return "";
    return fs.readFileSync(logPath, "utf8");
  }

  public cancelTask(taskId: string): void {
     this.updateTaskStatus(taskId, "cancelled");
     this.appendTaskLog(taskId, `[System] Task ${taskId} cancelled by user.`);
  }

  private saveTask(task: Task): void {
    fs.writeFileSync(this.getTaskFilePath(task.id), JSON.stringify(task, null, 2), "utf8");
  }

  public listTasks(): Task[] {
     const dir = this.getTasksDir();
     const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
     const tasks = files.map(f => this.getTask(f.replace(".json", ""))).filter(Boolean) as Task[];
     // Sort by created At descending
     return tasks.sort((a, b) => b.createdAt - a.createdAt);
  }
}

export const taskManager = new TaskManager();
