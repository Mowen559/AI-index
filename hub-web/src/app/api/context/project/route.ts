import { successResponse, errorResponse } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.projectPath) {
      return errorResponse("projectPath is required", "unknown");
    }

    // TODO: implement project context logic
    return successResponse({ message: "Context project API stub", data: {} }, body.projectPath);
  } catch (err: any) {
    return errorResponse(err.message || String(err));
  }
}
