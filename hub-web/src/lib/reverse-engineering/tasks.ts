import type { ArchitectureBlueprint, DevelopmentTask } from "@/lib/reverse-engineering/types";

export function buildDevelopmentTasks(blueprint: ArchitectureBlueprint): DevelopmentTask[] {
  const tasks: DevelopmentTask[] = [
    {
      id: "task-001",
      title: "Confirm missing requirement details",
      type: "confirm",
      reason: blueprint.missing_questions.length
        ? blueprint.missing_questions.join("; ")
        : "Requirement schema passed the basic completeness check",
      depends_on: [],
    },
  ];

  blueprint.modules.forEach((module, index) => {
    tasks.push({
      id: `task-${String(index + 2).padStart(3, "0")}`,
      title: `${module.action === "extend_existing" ? "Extend" : "Create"} ${module.name} module`,
      type: module.action === "extend_existing" ? "extend" : "create",
      target: module.name,
      reason:
        module.evidence.length > 0
          ? `Existing implementation evidence: ${module.evidence.slice(0, 3).join(", ")}`
          : "No strong implementation evidence found in project context",
      depends_on: ["task-001"],
    });
  });

  if (blueprint.engineering_constraints.frontend.enabled === true) {
    tasks.push({
      id: `task-${String(tasks.length + 1).padStart(3, "0")}`,
      title: "Implement frontend pages and components",
      type: "create",
      target: "frontend",
      reason: [
        blueprint.pages.length ? `Pages: ${blueprint.pages.join(", ")}` : "",
        blueprint.components.length ? `Components: ${blueprint.components.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("; "),
      depends_on: ["task-001"],
    });
  }

  if (blueprint.engineering_constraints.backend.enabled !== false) {
    tasks.push({
      id: `task-${String(tasks.length + 1).padStart(3, "0")}`,
      title: "Implement backend APIs and data models",
      type: "create",
      target: "backend",
      reason: [
        blueprint.apis.length ? `APIs: ${blueprint.apis.join(", ")}` : "",
        blueprint.data_models.length ? `Data models: ${blueprint.data_models.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("; "),
      depends_on: tasks.filter((task) => task.type === "extend" || task.type === "create").map((task) => task.id),
    });
  }

  tasks.push({
    id: `task-${String(tasks.length + 1).padStart(3, "0")}`,
    title: "Add API and risk-focused tests",
    type: "test",
    reason: [
      blueprint.engineering_constraints.testing.unit ? "unit tests" : "",
      blueprint.engineering_constraints.testing.integration ? "integration tests" : "",
      blueprint.engineering_constraints.testing.e2e ? "e2e tests" : "",
      blueprint.risks.length ? `risks: ${blueprint.risks.join("; ")}` : "",
    ]
      .filter(Boolean)
      .join("; "),
    depends_on: tasks.filter((task) => task.type === "extend" || task.type === "create").map((task) => task.id),
  });

  return tasks;
}
