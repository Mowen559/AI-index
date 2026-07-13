import { NextResponse } from "next/server";
import { getRuntimeStatuses } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectPath = searchParams.get("project") || req.headers.get("x-project-path") || undefined;
    
    const statuses = getRuntimeStatuses(projectPath);
    const hasError = statuses.some((status) => status.state === "error");
    const hasWarning = statuses.some((status) => status.state === "warning");

    return NextResponse.json({
      overall: hasError ? "error" : hasWarning ? "warning" : "ok",
      statuses,
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        overall: "error",
        statuses: [],
        checkedAt: new Date().toISOString(),
        error: error.message || "Failed to compute health status",
      },
      { status: 500 },
    );
  }
}
