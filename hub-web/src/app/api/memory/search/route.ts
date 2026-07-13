import { successResponse, errorResponse } from "@/lib/api-response";
import { searchSupermemoryMemories } from "@/lib/supermemory-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.projectPath) {
      return errorResponse("projectPath is required", "unknown");
    }
    
    const query = body.query || "";
    const limit = body.limit || 5;
    const matches = searchSupermemoryMemories(query, limit, body.projectPath);
    
    return successResponse({ matches }, body.projectPath);
  } catch (err: any) {
    return errorResponse(err.message || String(err));
  }
}
