import { successResponse, errorResponse } from "@/lib/api-response";
import { queryCodebaseMemory } from "@/lib/reverse-engineering/context";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.projectPath) {
      return errorResponse("projectPath is required", "unknown");
    }
    
    const terms = body.terms || [];
    const limit = body.limit || 10;
    const matches = queryCodebaseMemory(terms, limit, body.projectPath);
    
    return successResponse({ matches }, body.projectPath);
  } catch (err: any) {
    return errorResponse(err.message || String(err));
  }
}
