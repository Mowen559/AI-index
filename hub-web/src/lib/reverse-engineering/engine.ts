import type {
  ReverseEngineeringRequest,
  ReverseEngineeringResult,
  TraceStep,
} from "@/lib/reverse-engineering/types";
import { mergeRequirementSchema } from "@/lib/reverse-engineering/extractor";
import { enrichRequirementSchema } from "@/lib/reverse-engineering/enricher";
import {
  buildCodeSearchTerms,
  queryCodebaseMemory,
  querySupermemoryForRequirement,
} from "@/lib/reverse-engineering/context";
import { buildArchitectureBlueprint } from "@/lib/reverse-engineering/blueprint";
import { buildDevelopmentTasks } from "@/lib/reverse-engineering/tasks";
import { createTraceStep } from "@/lib/reverse-engineering/trace";
import { nowIso } from "@/lib/reverse-engineering/utils";

import { getLLMProvider } from "@/lib/llm/provider";

export async function runReverseEngineeringEngine(
  request: ReverseEngineeringRequest,
  projectPath: string,
): Promise<ReverseEngineeringResult> {
  const trace: TraceStep[] = [];
  const requirement = String(request.requirement || request.extracted_schema?.requirement_summary || "").trim();
  const traceId = `rev-${Date.now()}`;

  if (!requirement && !request.extracted_schema) {
    throw new Error("Missing requirement or extracted_schema.");
  }

  let extracted: any;
  let extractionSource: string;
  let extractionNotes: string[];

  if (request.extracted_schema) {
    extracted = mergeRequirementSchema(requirement, request.extracted_schema);
    extractionSource = "schema";
    extractionNotes = [];
  } else {
    // Attempt to use Server LLM
    const llm = getLLMProvider();
    const llmSchema = await llm.extractRequirementSchema(requirement);
    extracted = mergeRequirementSchema(requirement, llmSchema);
    extractionSource = "rule_or_llm"; // Actually handled inside llmSchema fallback
    extractionNotes = ["Extracted via server LLM provider (or fallback rule)."];
  }

  trace.push(
    createTraceStep(
      "01-intent-extraction",
      "Intent recognition and schema extraction",
      { requirement, extracted_schema: request.extracted_schema },
      extracted,
      [{ source: extractionSource as any, label: "requirement_schema_v1" }],
      extractionNotes,
    ),
  );

  const enrichedSchema = enrichRequirementSchema(extracted);
  trace.push(
    createTraceStep(
      "02-schema-enrichment",
      "Map requirement schema to engineering schema",
      extracted,
      enrichedSchema,
      [{ source: "rule", label: "domain_feature_module_mapping" }],
    ),
  );

  const supermemoryLimit = request.options?.supermemory_limit ?? 8;
  const supermemoryContext = querySupermemoryForRequirement(enrichedSchema, supermemoryLimit, projectPath);
  trace.push(
    createTraceStep(
      "03-supermemory-context",
      "Query Supermemory project specifications and UA summaries",
      { query: supermemoryContext.query, limit: supermemoryLimit },
      supermemoryContext.matches.map((memory) => ({
        filePath: memory.filePath,
        summary: memory.summary,
        tags: memory.tags,
        source: memory.sourceLabel,
      })),
      supermemoryContext.matches.map((memory) => ({
        source: "supermemory" as const,
        label: memory.filePath,
        path: memory.sourceGraphPath,
      })),
      supermemoryContext.matches.length === 0
        ? ["No Supermemory matches found for this requirement."]
        : [],
    ),
  );

  const codeTerms = buildCodeSearchTerms(enrichedSchema);
  const existingModuleLimit = request.options?.existing_module_limit ?? 20;
  const existingModules = queryCodebaseMemory(codeTerms, existingModuleLimit, projectPath);
  trace.push(
    createTraceStep(
      "04-existing-module-detection",
      "Detect existing modules/classes/interfaces from CodeDatabase",
      { terms: codeTerms, limit: existingModuleLimit },
      existingModules,
      existingModules.map((match) => ({
        source: "codebase-memory" as const,
        label: match.name,
        path: match.file_path,
        value: { kind: match.kind, matched_from: match.matched_from },
      })),
      existingModules.length === 0 ? ["No existing module/class/interface matches found."] : [],
    ),
  );

  const blueprint = buildArchitectureBlueprint(
    enrichedSchema,
    supermemoryContext.matches,
    existingModules,
  );
  trace.push(
    createTraceStep(
      "05-blueprint-generation",
      "Generate architecture blueprint",
      {
        schema: enrichedSchema,
        context_count: supermemoryContext.matches.length + existingModules.length,
      },
      blueprint,
      [{ source: "rule", label: "architecture_blueprint_v1" }],
    ),
  );

  const tasks = buildDevelopmentTasks(blueprint);
  trace.push(
    createTraceStep(
      "06-task-generation",
      "Generate executable development tasks",
      blueprint,
      tasks,
      [{ source: "rule", label: "development_task_v1" }],
    ),
  );

  return {
    trace_id: traceId,
    generated_at: nowIso(),
    requirement_schema: enrichedSchema,
    project_context: {
      supermemory: supermemoryContext.matches,
      existing_modules: existingModules,
    },
    architecture_blueprint: blueprint,
    development_tasks: tasks,
    trace,
  };
}
