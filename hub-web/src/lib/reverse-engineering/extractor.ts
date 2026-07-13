import type { EngineeringConstraints, RequirementSchema } from "@/lib/reverse-engineering/types";
import {
  DOMAIN_KEYWORDS,
  EMPTY_REQUIREMENT_SCHEMA,
  FEATURE_KEYWORDS,
  MODULE_ALIASES,
  OBJECT_KEYWORDS,
} from "@/lib/reverse-engineering/rules";
import { coerceStringArray, includesAny, unique } from "@/lib/reverse-engineering/utils";

function coerceBooleanOrNull(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function coerceBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function coerceString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function mergeEngineeringConstraints(
  value: Partial<EngineeringConstraints> | undefined,
): EngineeringConstraints {
  const defaults = EMPTY_REQUIREMENT_SCHEMA.engineering_constraints;

  return {
    target_platform: coerceString(value?.target_platform) || defaults.target_platform,
    frontend: {
      enabled: coerceBooleanOrNull(value?.frontend?.enabled),
      language: coerceString(value?.frontend?.language),
      framework: coerceString(value?.frontend?.framework),
      ui_library: coerceString(value?.frontend?.ui_library),
      state_management: coerceString(value?.frontend?.state_management),
    },
    backend: {
      enabled: coerceBooleanOrNull(value?.backend?.enabled),
      language: coerceString(value?.backend?.language),
      runtime: coerceString(value?.backend?.runtime),
      framework: coerceString(value?.backend?.framework),
      database: coerceString(value?.backend?.database),
      orm: coerceString(value?.backend?.orm),
    },
    integration: {
      external_services: coerceStringArray(value?.integration?.external_services),
      auth_required: coerceBooleanOrNull(value?.integration?.auth_required),
      ide_plugin_supported: coerceBooleanOrNull(value?.integration?.ide_plugin_supported),
    },
    testing: {
      unit: coerceBoolean(value?.testing?.unit, defaults.testing.unit),
      integration: coerceBoolean(value?.testing?.integration, defaults.testing.integration),
      e2e: coerceBoolean(value?.testing?.e2e, defaults.testing.e2e),
    },
    delivery: {
      generate_blueprint: coerceBoolean(
        value?.delivery?.generate_blueprint,
        defaults.delivery.generate_blueprint,
      ),
      generate_tasks: coerceBoolean(value?.delivery?.generate_tasks, defaults.delivery.generate_tasks),
      generate_code: coerceBoolean(value?.delivery?.generate_code, defaults.delivery.generate_code),
      trace_required: coerceBoolean(value?.delivery?.trace_required, defaults.delivery.trace_required),
    },
  };
}

export function inferRequirementSchema(requirement: string): Partial<RequirementSchema> {
  const summary = requirement.trim().replace(/\s+/g, " ").slice(0, 240);
  const domains = DOMAIN_KEYWORDS.filter((entry) => includesAny(requirement, entry.keywords)).map(
    (entry) => entry.domain,
  );
  const features = FEATURE_KEYWORDS.filter((entry) => includesAny(requirement, entry.keywords)).map(
    (entry) => entry.feature,
  );
  const objects = OBJECT_KEYWORDS.filter((entry) => includesAny(requirement, entry.keywords)).map(
    (entry) => entry.object,
  );

  const modules = unique([
    ...domains,
    ...features
      .map((feature) => feature.split("_")[0])
      .filter((feature) => Object.prototype.hasOwnProperty.call(MODULE_ALIASES, feature)),
  ]);

  return {
    requirement_summary: summary,
    business_domain: domains[0] || "",
    features,
    business_objects: objects,
    modules,
    technical_points: requirement.toLowerCase().includes("trace") ? ["traceable_pipeline"] : [],
  };
}

export function mergeRequirementSchema(
  requirement: string,
  extractedSchema: Partial<RequirementSchema> | undefined,
): RequirementSchema {
  const inferred = inferRequirementSchema(requirement);
  const merged = { ...EMPTY_REQUIREMENT_SCHEMA, ...inferred, ...extractedSchema };

  return {
    requirement_summary:
      typeof merged.requirement_summary === "string" && merged.requirement_summary.trim()
        ? merged.requirement_summary.trim()
        : requirement.trim(),
    business_domain:
      typeof merged.business_domain === "string" ? merged.business_domain.trim() : "",
    actors: coerceStringArray(merged.actors),
    features: coerceStringArray(merged.features),
    business_objects: coerceStringArray(merged.business_objects),
    engineering_constraints: mergeEngineeringConstraints(merged.engineering_constraints),
    modules: coerceStringArray(merged.modules),
    apis: coerceStringArray(merged.apis),
    pages: coerceStringArray(merged.pages),
    components: coerceStringArray(merged.components),
    data_models: coerceStringArray(merged.data_models),
    business_flow: coerceStringArray(merged.business_flow),
    technical_points: coerceStringArray(merged.technical_points),
    risks: coerceStringArray(merged.risks),
    missing_questions: coerceStringArray(merged.missing_questions),
  };
}
