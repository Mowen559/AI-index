import { successResponse, errorResponse } from "@/lib/api-response";
import { Supermemory } from "@/lib/supermemory";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.projectPath) {
      return errorResponse("projectPath is required", "unknown");
    }
    
    if (!body.memory || !body.memory.id) {
       return errorResponse("memory object with id is required", body.projectPath);
    }
    
    await Supermemory.write(body.projectPath, body.memory);
    return successResponse({ success: true, id: body.memory.id }, body.projectPath);
  } catch (err: any) {
    return errorResponse(err.message || String(err));
  }
}
