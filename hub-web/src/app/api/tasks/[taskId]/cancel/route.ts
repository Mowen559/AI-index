import { NextResponse } from "next/server";
import { taskManager } from "@/lib/task-manager";
import { killTaskProcess } from "@/lib/process-manager";

export async function POST(req: Request, props: { params: Promise<{ taskId: string }> }) {
  try {
    const params = await props.params;
    const { taskId } = params;
    const task = taskManager.getTask(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    taskManager.cancelTask(taskId);
    killTaskProcess(taskId);
    return NextResponse.json({ message: "Task cancelled successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
