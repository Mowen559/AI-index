import type { SupermemoryRecord } from "@/lib/supermemory-store";

export interface RequirementSchema {
  requirement_summary: string;
  business_domain: string;
  actors: string[];
  features: string[];
  business_objects: string[];
  engineering_constraints: EngineeringConstraints;
  modules: string[];
  apis: string[];
  pages: string[];
  components: string[];
  data_models: string[];
  business_flow: string[];
  technical_points: string[];
  risks: string[];
  missing_questions: string[];
}

export interface EngineeringConstraints {
  target_platform: string;
  frontend: {
    enabled: boolean | null;
    language: string;
    framework: string;
    ui_library: string;
    state_management: string;
  };
  backend: {
    enabled: boolean | null;
    language: string;
    runtime: string;
    framework: string;
    database: string;
    orm: string;
  };
  integration: {
    external_services: string[];
    auth_required: boolean | null;
    ide_plugin_supported: boolean | null;
  };
  testing: {
    unit: boolean;
    integration: boolean;
    e2e: boolean;
  };
  delivery: {
    generate_blueprint: boolean;
    generate_tasks: boolean;
    generate_code: boolean;
    trace_required: boolean;
  };
}

export interface ReverseEngineeringRequest {
  requirement?: string;
  extracted_schema?: Partial<RequirementSchema>;
  options?: {
    supermemory_limit?: number;
    existing_module_limit?: number;
    language?: string;
  };
}

export interface TraceEvidence {
  source: "input" | "schema" | "supermemory" | "codebase-memory" | "rule" | "validation";
  label: string;
  path?: string;
  value?: unknown;
}

export interface TraceStep {
  id: string;
  stage: string;
  status: "ok" | "warning" | "error";
  started_at: string;
  completed_at: string;
  input?: unknown;
  output?: unknown;
  evidence: TraceEvidence[];
  warnings: string[];
}

export interface ProjectContextMatch {
  name: string;
  kind: string;
  file_path: string;
  matched_from: string;
}

export interface ArchitectureBlueprint {
  summary: string;
  engineering_constraints: EngineeringConstraints;
  modules: Array<{
    name: string;
    action: "extend_existing" | "create_new" | "review";
    evidence: string[];
  }>;
  apis: string[];
  pages: string[];
  components: string[];
  data_models: string[];
  business_flow: string[];
  technical_points: string[];
  risks: string[];
  missing_questions: string[];
}

export interface DevelopmentTask {
  id: string;
  title: string;
  type: "investigate" | "extend" | "create" | "test" | "confirm";
  target?: string;
  reason: string;
  depends_on: string[];
}

export interface ReverseEngineeringResult {
  trace_id: string;
  generated_at: string;
  requirement_schema: RequirementSchema;
  project_context: {
    supermemory: SupermemoryRecord[];
    existing_modules: ProjectContextMatch[];
  };
  architecture_blueprint: ArchitectureBlueprint;
  development_tasks: DevelopmentTask[];
  trace: TraceStep[];
}
