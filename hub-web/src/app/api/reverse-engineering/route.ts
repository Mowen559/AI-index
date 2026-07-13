import { NextResponse } from "next/server";
import {
  runReverseEngineeringEngine,
  type ReverseEngineeringRequest,
} from "@/lib/reverse-engineering-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    name: "hub-web reverse engineering engine",
    version: "v1",
    endpoint: "POST /api/reverse-engineering",
    request_schema: {
      requirement: "string optional when extracted_schema.requirement_summary is present",
      extracted_schema: {
        requirement_summary: "string",
        business_domain: "string",
        actors: "string[]",
        features: "string[]",
        business_objects: "string[]",
        engineering_constraints: {
          target_platform: "string",
          frontend: {
            enabled: "boolean | null",
            language: "string",
            framework: "string",
            ui_library: "string",
            state_management: "string",
          },
          backend: {
            enabled: "boolean | null",
            language: "string",
            runtime: "string",
            framework: "string",
            database: "string",
            orm: "string",
          },
          integration: {
            external_services: "string[]",
            auth_required: "boolean | null",
            ide_plugin_supported: "boolean | null",
          },
          testing: {
            unit: "boolean",
            integration: "boolean",
            e2e: "boolean",
          },
          delivery: {
            generate_blueprint: "boolean",
            generate_tasks: "boolean",
            generate_code: "boolean",
            trace_required: "boolean",
          },
        },
        modules: "string[]",
        apis: "string[]",
        pages: "string[]",
        components: "string[]",
        data_models: "string[]",
        business_flow: "string[]",
        technical_points: "string[]",
        risks: "string[]",
        missing_questions: "string[]",
      },
      options: {
        supermemory_limit: "number optional",
        existing_module_limit: "number optional",
      },
    },
    trace_stages: [
      "01-intent-extraction",
      "02-schema-enrichment",
      "03-supermemory-context",
      "04-existing-module-detection",
      "05-blueprint-generation",
      "06-task-generation",
    ],
    response_sections: [
      "requirement_schema",
      "project_context",
      "architecture_blueprint",
      "development_tasks",
      "trace",
    ],
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReverseEngineeringRequest & { projectPath: string };
    
    if (!body.projectPath) {
      return NextResponse.json({ error: "projectPath is required for context isolation." }, { status: 400 });
    }

    const result = await runReverseEngineeringEngine(body, body.projectPath);
    return NextResponse.json({
      project_id: body.projectPath,
      ...result,
      trace_id: result.trace_id || result.trace[0]?.id || `rev-${Date.now()}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to run reverse engineering engine.",
        details: error?.message || String(error),
      },
      { status: 400 },
    );
  }
}
