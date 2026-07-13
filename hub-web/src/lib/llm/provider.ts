import fs from "fs";
import path from "path";
import {
  buildFileAnalysisPrompt,
  buildProjectSummaryPrompt,
  parseFileAnalysisResponse,
  parseProjectSummaryResponse,
} from "@understand-anything/core";
import type { LLMProvider, UnderstandAnythingOptions } from "./types";
import type { RequirementSchema } from "@/lib/reverse-engineering/types";
import { inferRequirementSchema } from "@/lib/reverse-engineering/extractor";
import { Supermemory } from "@/lib/supermemory";
import { hasUsableLLMSettings, readLLMSettings, type LLMSettings } from "./settings";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

type ProjectSummary = {
  description: string;
  frameworks: string[];
  layers: Array<{ name: string; description: string; filePatterns: string[] }>;
};

type FileAnalysis = {
  fileSummary: string;
  tags: string[];
  complexity: "simple" | "moderate" | "complex";
  functionSummaries: Record<string, string>;
  classSummaries: Record<string, string>;
  languageNotes?: string;
};

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  ".understand-anything",
  ".supermemory",
  ".shadow-git",
  ".aindex-hub",
  ".codegraph",
  ".idea",
  ".vscode",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "target",
  "tmp",
  "temp",
  "vendor",
]);

const CANDIDATE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".java",
  ".go",
  ".rs",
  ".rb",
  ".php",
  ".cs",
  ".cpp",
  ".c",
  ".h",
  ".hpp",
  ".kt",
  ".swift",
  ".sql",
  ".graphql",
  ".md",
  ".mdx",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".env",
  ".sh",
  ".ps1",
  ".xml",
  ".html",
  ".css",
  ".scss",
]);

const SPECIAL_FILENAMES = new Set([
  "dockerfile",
  "jenkinsfile",
  "makefile",
  "readme.md",
  "package.json",
  "pom.xml",
  "build.gradle",
  "tsconfig.json",
  "next.config.ts",
  "next.config.js",
]);

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function extractJsonBlock(raw: string) {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1);
  }

  return raw.trim();
}

function normalizeFilePathForStore(filePath: string) {
  return filePath.replace(/\\/g, "/");
}

function scoreProjectFile(projectPath: string, filePath: string) {
  const relativePath = path.relative(projectPath, filePath).replace(/\\/g, "/").toLowerCase();
  let score = 0;

  if (relativePath === "package.json" || relativePath === "readme.md") score += 30;
  if (relativePath.startsWith("src/")) score += 20;
  if (relativePath.includes("/app/")) score += 18;
  if (relativePath.includes("/api/")) score += 16;
  if (relativePath.includes("/lib/")) score += 14;
  if (relativePath.includes("/components/")) score += 12;
  if (relativePath.includes("/services/")) score += 12;
  if (relativePath.includes("/models/")) score += 10;
  if (relativePath.includes("/controllers/")) score += 10;

  const ext = path.extname(relativePath);
  if (ext === ".ts" || ext === ".tsx") score += 6;
  if (ext === ".js" || ext === ".jsx") score += 5;
  if (ext === ".md") score += 2;

  score -= relativePath.split("/").length;
  return score;
}

function isCandidateFile(filePath: string) {
  const baseName = path.basename(filePath).toLowerCase();
  if (SPECIAL_FILENAMES.has(baseName)) {
    return true;
  }
  return CANDIDATE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function collectProjectFiles(projectPath: string, settings: LLMSettings) {
  const files: string[] = [];

  function visit(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRECTORIES.has(entry.name)) {
          continue;
        }
        visit(absolutePath);
        continue;
      }

      if (!entry.isFile() || !isCandidateFile(absolutePath)) {
        continue;
      }

      const stat = fs.statSync(absolutePath);
      if (stat.size > settings.uaMaxFileChars * 2) {
        continue;
      }

      files.push(absolutePath);
    }
  }

  visit(projectPath);

  return files
    .sort((left, right) => scoreProjectFile(projectPath, right) - scoreProjectFile(projectPath, left))
    .slice(0, settings.uaFileLimit);
}

async function readTrimmedFile(filePath: string, maxChars: number) {
  const content = await fs.promises.readFile(filePath, "utf8");
  return content.length > maxChars ? `${content.slice(0, maxChars)}\n/* truncated */` : content;
}

class FallbackLLMProvider implements LLMProvider {
  async extractRequirementSchema(requirement: string): Promise<Partial<RequirementSchema>> {
    return inferRequirementSchema(requirement);
  }

  async executeUnderstandAnything(projectPath: string, options?: UnderstandAnythingOptions): Promise<void> {
    const message = `[FallbackLLMProvider] Understand-Anything execution skipped for ${projectPath}. No LLM configured.`;
    options?.onProgress?.(message);
    console.warn(message);
  }
}

class OpenAICompatibleProvider implements LLMProvider {
  constructor(private readonly settings: LLMSettings) {}

  private async createChatCompletion(systemPrompt: string, userPrompt: string) {
    let baseUrl = this.settings.baseUrl.replace(/\/+$/, "");
    if (!baseUrl.endsWith("/v1")) {
      baseUrl += "/v1";
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.apiKey}`,
      },
      body: JSON.stringify({
        model: this.settings.model,
        temperature: this.settings.temperature,
        max_tokens: this.settings.maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`LLM request failed: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => (typeof part?.text === "string" ? part.text : ""))
        .join("")
        .trim();
    }

    throw new Error("LLM response did not contain assistant text.");
  }

  private async createJsonResponse<T>(systemPrompt: string, userPrompt: string) {
    const raw = await this.createChatCompletion(systemPrompt, userPrompt);
    const jsonBlock = extractJsonBlock(raw);
    return JSON.parse(jsonBlock) as T;
  }

  async extractRequirementSchema(requirement: string): Promise<Partial<RequirementSchema>> {
    const heuristic = inferRequirementSchema(requirement);

    try {
      return await this.createJsonResponse<Partial<RequirementSchema>>(
        [
          "You are a senior software architect.",
          "Extract a structured requirement schema from the user request.",
          "Return only JSON.",
          "Prefer concise arrays of strings.",
          "If a field is unknown, use an empty string, null-like omission, or an empty array.",
        ].join(" "),
        [
          "Analyze the requirement below and return a JSON object with these keys:",
          "requirement_summary, business_domain, actors, features, business_objects, engineering_constraints, modules, apis, pages, components, data_models, business_flow, technical_points, risks, missing_questions.",
          'For engineering_constraints include: target_platform, frontend, backend, integration, testing, delivery.',
          "",
          requirement,
        ].join("\n"),
      );
    } catch (error) {
      console.error("Failed to extract requirement schema via LLM, using heuristic fallback.", error);
      return heuristic;
    }
  }

  async executeUnderstandAnything(projectPath: string, options?: UnderstandAnythingOptions): Promise<void> {
    const files = collectProjectFiles(projectPath, this.settings);
    if (files.length === 0) {
      throw new Error("No eligible project files were found for Understand-Anything analysis.");
    }

    options?.onProgress?.(
      `[LLM] Starting Understand-Anything semantic pass with model ${this.settings.model}.`,
    );
    options?.onProgress?.(`[LLM] Selected ${files.length} file(s) for semantic analysis.`);

    const sampleFiles = await Promise.all(
      files.slice(0, this.settings.uaSampleFileLimit).map(async (filePath) => ({
        path: path.relative(projectPath, filePath).replace(/\\/g, "/"),
        content: await readTrimmedFile(filePath, Math.min(this.settings.uaMaxFileChars, 6000)),
      })),
    );

    let projectSummary: ProjectSummary = {
      description: `Project rooted at ${projectPath}`,
      frameworks: [],
      layers: [],
    };

    try {
      const summaryText = await this.createChatCompletion(
        "You analyze codebase structures and respond only with JSON.",
        buildProjectSummaryPrompt(
          files.map((filePath) => path.relative(projectPath, filePath).replace(/\\/g, "/")),
          sampleFiles,
        ),
      );
      const parsed = parseProjectSummaryResponse(summaryText);
      if (parsed) {
        projectSummary = parsed;
      }
    } catch (error) {
      console.error("Failed to generate project summary via LLM.", error);
    }

    const nodes: Array<Record<string, unknown>> = [];

    for (const filePath of files) {
      const relativePath = path.relative(projectPath, filePath).replace(/\\/g, "/");
      options?.onProgress?.(`[LLM] Analyzing ${relativePath}`);

      const content = await readTrimmedFile(filePath, this.settings.uaMaxFileChars);
      let analysis: FileAnalysis | null = null;

      try {
        const raw = await this.createChatCompletion(
          "You are a precise code analysis assistant and must respond only with JSON.",
          buildFileAnalysisPrompt(filePath, content, projectSummary.description),
        );
        analysis = parseFileAnalysisResponse(raw);
      } catch (error) {
        console.error(`Failed to analyze ${relativePath} via LLM.`, error);
      }

      nodes.push({
        id: normalizeFilePathForStore(filePath),
        type: "file",
        name: path.basename(filePath),
        filePath: normalizeFilePathForStore(filePath),
        summary: analysis?.fileSummary || `Source file ${relativePath}`,
        tags: unique([
          ...(analysis?.tags || []),
          ...projectSummary.frameworks.slice(0, 3),
        ]),
        complexity: analysis?.complexity || "moderate",
        languageNotes: analysis?.languageNotes,
        relativePath,
      });
    }

    const outputDir = path.join(projectPath, ".understand-anything");
    fs.mkdirSync(outputDir, { recursive: true });

    const knowledgeGraph = {
      generatedAt: new Date().toISOString(),
      projectPath: normalizeFilePathForStore(projectPath),
      projectSummary,
      nodes,
      edges: [],
    };

    fs.writeFileSync(
      path.join(outputDir, "knowledge-graph.json"),
      JSON.stringify(knowledgeGraph, null, 2),
      "utf8",
    );

    Supermemory.write(projectPath, {
      summary: projectSummary.description,
      coreModules: unique(projectSummary.frameworks),
      architecturalGuidelines: projectSummary.layers.map(
        (layer) => `${layer.name}: ${layer.description}`,
      ),
    });

    options?.onProgress?.(
      `[LLM] Understand-Anything semantic metadata written to ${path.join(outputDir, "knowledge-graph.json")}.`,
    );
  }
}

class AnthropicProvider implements LLMProvider {
  constructor(private readonly settings: LLMSettings) {}

  private async createChatCompletion(systemPrompt: string, userPrompt: string) {
    const response = await fetch(`${this.settings.baseUrl.replace(/\/+$/, "")}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.settings.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.settings.model,
        temperature: this.settings.temperature,
        max_tokens: this.settings.maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`LLM request failed: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const payload = await response.json();
    const content = payload.content?.[0]?.text;

    if (typeof content === "string") {
      return content;
    }

    throw new Error("LLM response did not contain assistant text.");
  }

  private async createJsonResponse<T>(systemPrompt: string, userPrompt: string) {
    const raw = await this.createChatCompletion(systemPrompt, userPrompt);
    const jsonBlock = extractJsonBlock(raw);
    return JSON.parse(jsonBlock) as T;
  }

  async extractRequirementSchema(requirement: string): Promise<Partial<RequirementSchema>> {
    const heuristic = inferRequirementSchema(requirement);
    try {
      return await this.createJsonResponse<Partial<RequirementSchema>>(
        [
          "You are a senior software architect.",
          "Extract a structured requirement schema from the user request.",
          "Return only JSON.",
          "Prefer concise arrays of strings.",
          "If a field is unknown, use an empty string, null-like omission, or an empty array.",
        ].join(" "),
        [
          "Analyze the requirement below and return a JSON object with these keys:",
          "requirement_summary, business_domain, actors, features, business_objects, engineering_constraints, modules, apis, pages, components, data_models, business_flow, technical_points, risks, missing_questions.",
          'For engineering_constraints include: target_platform, frontend, backend, integration, testing, delivery.',
          "",
          requirement,
        ].join("\n"),
      );
    } catch (error) {
      console.error("Failed to extract requirement schema via LLM, using heuristic fallback.", error);
      return heuristic;
    }
  }

  async executeUnderstandAnything(projectPath: string, options?: UnderstandAnythingOptions): Promise<void> {
    const files = collectProjectFiles(projectPath, this.settings);
    if (files.length === 0) {
      throw new Error("No eligible project files were found for Understand-Anything analysis.");
    }

    options?.onProgress?.(
      `[LLM] Starting Understand-Anything semantic pass with Anthropic model ${this.settings.model}.`,
    );
    options?.onProgress?.(`[LLM] Selected ${files.length} file(s) for semantic analysis.`);

    const sampleFiles = await Promise.all(
      files.slice(0, this.settings.uaSampleFileLimit).map(async (filePath) => ({
        path: path.relative(projectPath, filePath).replace(/\\/g, "/"),
        content: await readTrimmedFile(filePath, Math.min(this.settings.uaMaxFileChars, 6000)),
      })),
    );

    let projectSummary: ProjectSummary = {
      description: `Project rooted at ${projectPath}`,
      frameworks: [],
      layers: [],
    };

    try {
      const summaryText = await this.createChatCompletion(
        "You analyze codebase structures and respond only with JSON.",
        buildProjectSummaryPrompt(
          files.map((filePath) => path.relative(projectPath, filePath).replace(/\\/g, "/")),
          sampleFiles,
        ),
      );
      const parsed = parseProjectSummaryResponse(summaryText);
      if (parsed) {
        projectSummary = parsed;
      }
    } catch (error) {
      console.error("Failed to generate project summary via LLM.", error);
    }

    const nodes: Array<Record<string, unknown>> = [];

    for (const filePath of files) {
      const relativePath = path.relative(projectPath, filePath).replace(/\\/g, "/");
      options?.onProgress?.(`[LLM] Analyzing ${relativePath}`);

      const content = await readTrimmedFile(filePath, this.settings.uaMaxFileChars);
      let analysis: FileAnalysis | null = null;

      try {
        const raw = await this.createChatCompletion(
          "You are a precise code analysis assistant and must respond only with JSON.",
          buildFileAnalysisPrompt(filePath, content, projectSummary.description),
        );
        analysis = parseFileAnalysisResponse(raw);
      } catch (error) {
        console.error(`Failed to analyze ${relativePath} via LLM.`, error);
      }

      nodes.push({
        id: normalizeFilePathForStore(filePath),
        type: "file",
        name: path.basename(filePath),
        filePath: normalizeFilePathForStore(filePath),
        summary: analysis?.fileSummary || `Source file ${relativePath}`,
        tags: unique([
          ...(analysis?.tags || []),
          ...projectSummary.frameworks.slice(0, 3),
        ]),
        complexity: analysis?.complexity || "moderate",
        languageNotes: analysis?.languageNotes,
        relativePath,
      });
    }

    const outputDir = path.join(projectPath, ".understand-anything");
    fs.mkdirSync(outputDir, { recursive: true });

    const knowledgeGraph = {
      generatedAt: new Date().toISOString(),
      projectPath: normalizeFilePathForStore(projectPath),
      projectSummary,
      nodes,
      edges: [],
    };

    fs.writeFileSync(
      path.join(outputDir, "knowledge-graph.json"),
      JSON.stringify(knowledgeGraph, null, 2),
      "utf8",
    );

    Supermemory.write(projectPath, {
      summary: projectSummary.description,
      coreModules: unique(projectSummary.frameworks),
      architecturalGuidelines: projectSummary.layers.map(
        (layer) => `${layer.name}: ${layer.description}`,
      ),
    });

    options?.onProgress?.(
      `[LLM] Understand-Anything semantic metadata written to ${path.join(outputDir, "knowledge-graph.json")}.`,
    );
  }
}

let providerInstance: LLMProvider | null = null;
let providerCacheKey = "";

export function getLLMProvider(): LLMProvider {
  const settings = readLLMSettings();
  const cacheKey = JSON.stringify({
    enabled: settings.enabled,
    provider: settings.provider,
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiKeyPresent: Boolean(settings.apiKey),
  });

  if (providerInstance && cacheKey === providerCacheKey) {
    return providerInstance;
  }

  providerCacheKey = cacheKey;

  if (hasUsableLLMSettings(settings)) {
    if (settings.provider === "anthropic") {
      providerInstance = new AnthropicProvider(settings);
    } else {
      providerInstance = new OpenAICompatibleProvider(settings);
    }
    return providerInstance;
  }

  providerInstance = new FallbackLLMProvider();
  return providerInstance;
}
