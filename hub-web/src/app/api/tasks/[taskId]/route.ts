import { NextResponse } from "next/server";
import { taskManager } from "@/lib/task-manager";

export async function GET(req: Request, props: { params: Promise<{ taskId: string }> }) {
  try {
    const params = await props.params;
    const { taskId } = params;
    const task = taskManager.getTask(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ task });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
