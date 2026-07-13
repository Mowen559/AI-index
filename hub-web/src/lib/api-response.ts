import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export function successResponse(data: any, projectId: string, traceId?: string) {
  return NextResponse.json({
    trace_id: traceId || randomUUID(),
    project_id: projectId,
    ...data
  });
}

export function errorResponse(error: string, projectId?: string, traceId?: string, status: number = 400) {
  return NextResponse.json({
    trace_id: traceId || randomUUID(),
    project_id: projectId || "unknown",
    error
  }, { status });
}
