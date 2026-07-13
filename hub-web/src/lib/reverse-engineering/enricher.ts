import type { RequirementSchema } from "@/lib/reverse-engineering/types";
import { DEFAULT_BUSINESS_FLOW, MODULE_ALIASES } from "@/lib/reverse-engineering/rules";
import { unique } from "@/lib/reverse-engineering/utils";

function deriveModules(schema: RequirementSchema) {
  const modules = [...schema.modules];

  for (const feature of schema.features) {
    const prefix = feature.split("_")[0];
    if (Object.prototype.hasOwnProperty.call(MODULE_ALIASES, prefix)) {
      modules.push(prefix);
    }
  }

  for (const objectName of schema.business_objects) {
    const normalized = objectName.toLowerCase();
    for (const [moduleName, aliases] of Object.entries(MODULE_ALIASES)) {
      if (aliases.some((alias) => normalized.includes(alias.toLowerCase()))) {
        modules.push(moduleName);
      }
    }
  }

  if (schema.business_domain) {
    modules.push(schema.business_domain);
  }

  return unique(modules);
}

function deriveApis(schema: RequirementSchema) {
  if (schema.engineering_constraints.backend.enabled === false) {
    return unique(schema.apis);
  }

  const apis = [...schema.apis];
  const modules = new Set(schema.modules);
  const features = new Set(schema.features);

  if (modules.has("order") || features.has("create_order")) apis.push("POST /orders");
  if (features.has("payment") || modules.has("payment")) apis.push("POST /payments");
  if (features.has("payment_callback")) apis.push("POST /payments/callback");
  if (features.has("timeout_cancel")) apis.push("POST /orders/{id}/cancel");
  if (modules.has("coupon")) apis.push("POST /coupons/redeem");

  return unique(apis);
}

function derivePages(schema: RequirementSchema) {
  if (schema.engineering_constraints.frontend.enabled !== true) {
    return unique(schema.pages);
  }

  const pages = [...schema.pages];
  const modules = new Set(schema.modules);

  if (modules.has("order")) pages.push("/orders", "/orders/[id]");
  if (modules.has("payment")) pages.push("/payments/[id]");
  if (modules.has("coupon")) pages.push("/coupons");

  return unique(pages);
}

function deriveComponents(schema: RequirementSchema) {
  if (schema.engineering_constraints.frontend.enabled !== true) {
    return unique(schema.components);
  }

  const components = [...schema.components];
  const modules = new Set(schema.modules);

  if (modules.has("order")) components.push("OrderForm", "OrderSummary");
  if (modules.has("payment")) components.push("PaymentStatusPanel");
  if (modules.has("coupon")) components.push("CouponInput");

  return unique(components);
}

function deriveDataModels(schema: RequirementSchema) {
  const models = [...schema.data_models, ...schema.business_objects];

  for (const moduleName of schema.modules) {
    if (moduleName === "order") models.push("Order");
    if (moduleName === "payment") models.push("PaymentOrder");
    if (moduleName === "coupon") models.push("CouponRecord");
    if (moduleName === "inventory") models.push("InventoryLock");
  }

  return unique(models);
}

function deriveRisks(schema: RequirementSchema) {
  const risks = [...schema.risks];
  const features = new Set(schema.features);
  const modules = new Set(schema.modules);

  if (features.has("payment_callback")) risks.push("Payment callback idempotency");
  if (modules.has("inventory")) risks.push("Inventory consistency");
  if (modules.has("coupon")) risks.push("Duplicate coupon usage");
  if (features.has("timeout_cancel") && modules.has("payment")) {
    risks.push("Race between timeout cancellation and successful payment");
  }
  if (schema.technical_points.includes("traceable_pipeline")) {
    risks.push("Incomplete trace evidence may reduce downstream agent reliability");
  }

  return unique(risks);
}

function deriveMissingQuestions(schema: RequirementSchema) {
  const questions = [...schema.missing_questions];
  const modules = new Set(schema.modules);
  const features = new Set(schema.features);

  if (modules.has("payment") && !schema.technical_points.some((point) => point.includes("channel"))) {
    questions.push("Which payment channel should be supported?");
  }
  if (features.has("timeout_cancel") && !schema.technical_points.some((point) => point.includes("timeout"))) {
    questions.push("What is the timeout duration?");
  }
  if (modules.has("inventory")) {
    questions.push("Should inventory be locked, and when should the lock be released?");
  }
  if (schema.actors.length === 0) questions.push("Who are the primary actors?");

  return unique(questions);
}

export function enrichRequirementSchema(schema: RequirementSchema): RequirementSchema {
  const withModules = { ...schema, modules: deriveModules(schema) };
  return {
    ...withModules,
    apis: deriveApis(withModules),
    pages: derivePages(withModules),
    components: deriveComponents(withModules),
    data_models: deriveDataModels(withModules),
    risks: deriveRisks(withModules),
    missing_questions: deriveMissingQuestions(withModules),
    business_flow:
      withModules.business_flow.length > 0 ? withModules.business_flow : DEFAULT_BUSINESS_FLOW,
  };
}

export function buildContextQuery(schema: RequirementSchema) {
  return unique([
    schema.requirement_summary,
    schema.business_domain,
    ...schema.modules,
    ...schema.features,
    ...schema.business_objects,
    "project specification architecture convention",
  ]).join(" ");
}
