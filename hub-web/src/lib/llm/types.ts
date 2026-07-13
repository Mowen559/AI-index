import type { RequirementSchema } from "@/lib/reverse-engineering/types";

export interface UnderstandAnythingOptions {
  language?: string;
  projectId?: string;
  onProgress?: (message: string) => void;
}

export interface LLMProvider {
  /**
   * Extract a requirement schema from a natural language requirement string.
   */
  extractRequirementSchema(requirement: string): Promise<Partial<RequirementSchema>>;

  /**
   * Execute the Understand-Anything semantic AST analysis.
   */
  executeUnderstandAnything(projectPath: string, options?: UnderstandAnythingOptions): Promise<void>;
}
