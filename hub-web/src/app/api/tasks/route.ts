import { NextResponse } from "next/server";
import { taskManager } from "@/lib/task-manager";

export async function GET() {
  try {
    const tasks = taskManager.listTasks();
    return NextResponse.json({ tasks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
