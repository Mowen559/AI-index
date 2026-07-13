import type { SupermemoryRecord } from "@/lib/supermemory-store";
import type {
  ArchitectureBlueprint,
  ProjectContextMatch,
  RequirementSchema,
} from "@/lib/reverse-engineering/types";
import { MODULE_ALIASES } from "@/lib/reverse-engineering/rules";
import { isStrongImplementationEvidence } from "@/lib/reverse-engineering/context";
import { unique } from "@/lib/reverse-engineering/utils";

export function buildArchitectureBlueprint(
  schema: RequirementSchema,
  supermemoryMatches: SupermemoryRecord[],
  existingModules: ProjectContextMatch[],
): ArchitectureBlueprint {
  const evidenceByModule = new Map<string, string[]>();

  for (const moduleName of schema.modules) {
    const aliases = MODULE_ALIASES[moduleName] || [moduleName];
    const evidence = existingModules
      .filter((match) => isStrongImplementationEvidence(match.file_path))
      .filter((match) =>
        aliases.some((alias) =>
          `${match.name} ${match.file_path}`.toLowerCase().includes(alias.toLowerCase()),
        ),
      )
      .map((match) => match.file_path || match.name)
      .filter(Boolean);

    evidenceByModule.set(moduleName, unique(evidence).slice(0, 5));
  }

  return {
    summary: schema.requirement_summary,
    engineering_constraints: schema.engineering_constraints,
    modules: schema.modules.map((moduleName) => {
      const evidence = evidenceByModule.get(moduleName) || [];
      return {
        name: moduleName,
        action: evidence.length > 0 ? "extend_existing" : "create_new",
        evidence,
      };
    }),
    apis: schema.apis,
    pages: schema.pages,
    components: schema.components,
    data_models: schema.data_models,
    business_flow: schema.business_flow,
    technical_points: unique([
      ...schema.technical_points,
      ...supermemoryMatches.flatMap((memory) => memory.tags).slice(0, 8),
    ]),
    risks: schema.risks,
    missing_questions: schema.missing_questions,
  };
}
