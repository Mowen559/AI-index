import type { RequirementSchema } from "@/lib/reverse-engineering/types";

export const EMPTY_REQUIREMENT_SCHEMA: RequirementSchema = {
  requirement_summary: "",
  business_domain: "",
  actors: [],
  features: [],
  business_objects: [],
  engineering_constraints: {
    target_platform: "",
    frontend: {
      enabled: null,
      language: "",
      framework: "",
      ui_library: "",
      state_management: "",
    },
    backend: {
      enabled: null,
      language: "",
      runtime: "",
      framework: "",
      database: "",
      orm: "",
    },
    integration: {
      external_services: [],
      auth_required: null,
      ide_plugin_supported: null,
    },
    testing: {
      unit: true,
      integration: true,
      e2e: false,
    },
    delivery: {
      generate_blueprint: true,
      generate_tasks: true,
      generate_code: false,
      trace_required: true,
    },
  },
  modules: [],
  apis: [],
  pages: [],
  components: [],
  data_models: [],
  business_flow: [],
  technical_points: [],
  risks: [],
  missing_questions: [],
};

export const DOMAIN_KEYWORDS: Array<{ domain: string; keywords: string[] }> = [
  { domain: "order", keywords: ["order", "orders", "create order"] },
  { domain: "payment", keywords: ["payment", "payments", "pay", "callback"] },
  { domain: "coupon", keywords: ["coupon", "discount"] },
  { domain: "inventory", keywords: ["inventory", "stock", "lock stock"] },
  { domain: "user", keywords: ["user", "account"] },
  { domain: "auth", keywords: ["auth", "login", "permission"] },
  { domain: "project", keywords: ["project", "workspace"] },
  { domain: "memory", keywords: ["memory", "supermemory", "specification"] },
  { domain: "reverse-engineering", keywords: ["reverse", "engineering", "blueprint"] },
];

export const FEATURE_KEYWORDS: Array<{ feature: string; keywords: string[] }> = [
  { feature: "create_order", keywords: ["create order", "order creation"] },
  { feature: "payment", keywords: ["payment", "pay"] },
  { feature: "payment_callback", keywords: ["callback", "webhook"] },
  { feature: "coupon", keywords: ["coupon", "discount"] },
  { feature: "timeout_cancel", keywords: ["timeout", "cancel"] },
  { feature: "inventory_lock", keywords: ["lock stock", "inventory lock"] },
  { feature: "reverse_engineering", keywords: ["reverse engineering", "blueprint"] },
  { feature: "task_generation", keywords: ["task", "development task"] },
];

export const OBJECT_KEYWORDS: Array<{ object: string; keywords: string[] }> = [
  { object: "Order", keywords: ["order"] },
  { object: "Payment", keywords: ["payment"] },
  { object: "Coupon", keywords: ["coupon"] },
  { object: "Inventory", keywords: ["inventory", "stock"] },
  { object: "User", keywords: ["user"] },
  { object: "Requirement", keywords: ["requirement"] },
  { object: "Blueprint", keywords: ["blueprint"] },
  { object: "Task", keywords: ["task"] },
];

export const MODULE_ALIASES: Record<string, string[]> = {
  order: ["order", "orders"],
  payment: ["payment", "payments", "pay"],
  coupon: ["coupon", "discount"],
  inventory: ["inventory", "stock"],
  auth: ["auth", "login", "permission"],
  user: ["user", "account"],
  memory: ["memory", "supermemory"],
  codegraph: ["codegraph", "graph"],
  "reverse-engineering": ["reverse", "engineering", "blueprint"],
};

export const DEFAULT_BUSINESS_FLOW = [
  "Receive requirement",
  "Extract intent and business objects",
  "Enrich with project context",
  "Generate executable development tasks",
];
