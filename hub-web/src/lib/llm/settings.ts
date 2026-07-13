import fs from "fs";
import path from "path";
import { getAppDataPath } from "@/lib/app-paths";

export interface LLMSettings {
  enabled: boolean;
  provider: "openai-compatible" | "anthropic";
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  uaFileLimit: number;
  uaSampleFileLimit: number;
  uaMaxFileChars: number;
  updatedAt: string;
}

const DEFAULT_LLM_SETTINGS: LLMSettings = {
  enabled: true,
  provider: "anthropic",
  baseUrl: "http://127.0.0.1:8045",
  apiKey: "sk-3c22e1fdc7ab4dce8cf3c5d2d0c7a18c",
  model: "claude-sonnet-4-6",
  temperature: 0.2,
  maxTokens: 8000,
  uaFileLimit: 24,
  uaSampleFileLimit: 6,
  uaMaxFileChars: 12000,
  updatedAt: new Date(0).toISOString(),
};

function getSettingsDir() {
  return getAppDataPath("settings");
}

export function getLLMSettingsPath() {
  return path.join(getSettingsDir(), "llm.json");
}

function ensureSettingsDir() {
  const dir = getSettingsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return clamp(value, min, max);
}

function normalizeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeSettings(value: Partial<LLMSettings> | null | undefined): LLMSettings {
  const provider = value?.provider === "anthropic" ? "anthropic" : "openai-compatible";
  return {
    enabled: typeof value?.enabled === "boolean" ? value.enabled : DEFAULT_LLM_SETTINGS.enabled,
    provider,
    baseUrl: normalizeString(value?.baseUrl, DEFAULT_LLM_SETTINGS.baseUrl).replace(/\/+$/, ""),
    apiKey: typeof value?.apiKey === "string" ? value.apiKey.trim() : DEFAULT_LLM_SETTINGS.apiKey,
    model: normalizeString(value?.model, DEFAULT_LLM_SETTINGS.model),
    temperature: normalizeNumber(value?.temperature, DEFAULT_LLM_SETTINGS.temperature, 0, 2),
    maxTokens: normalizeNumber(value?.maxTokens, DEFAULT_LLM_SETTINGS.maxTokens, 256, 32000),
    uaFileLimit: normalizeNumber(value?.uaFileLimit, DEFAULT_LLM_SETTINGS.uaFileLimit, 1, 200),
    uaSampleFileLimit: normalizeNumber(
      value?.uaSampleFileLimit,
      DEFAULT_LLM_SETTINGS.uaSampleFileLimit,
      1,
      20,
    ),
    uaMaxFileChars: normalizeNumber(
      value?.uaMaxFileChars,
      DEFAULT_LLM_SETTINGS.uaMaxFileChars,
      1000,
      50000,
    ),
    updatedAt:
      typeof value?.updatedAt === "string" && value.updatedAt
        ? value.updatedAt
        : DEFAULT_LLM_SETTINGS.updatedAt,
  };
}

export function readLLMSettings(): LLMSettings {
  const settingsPath = getLLMSettingsPath();
  if (!fs.existsSync(settingsPath)) {
    return DEFAULT_LLM_SETTINGS;
  }

  try {
    const raw = fs.readFileSync(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<LLMSettings>;
    return normalizeSettings(parsed);
  } catch (error) {
    console.error("Failed to read LLM settings, using defaults.", error);
    return DEFAULT_LLM_SETTINGS;
  }
}

export function writeLLMSettings(nextSettings: Partial<LLMSettings>) {
  ensureSettingsDir();
  const current = readLLMSettings();
  const merged = normalizeSettings({
    ...current,
    ...nextSettings,
    updatedAt: new Date().toISOString(),
  });

  fs.writeFileSync(getLLMSettingsPath(), JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

export function hasUsableLLMSettings(settings: LLMSettings) {
  return Boolean(
    settings.enabled &&
      (settings.provider === "openai-compatible" || settings.provider === "anthropic") &&
      settings.baseUrl &&
      settings.apiKey &&
      settings.model,
  );
}

export function getDefaultLLMSettings() {
  return DEFAULT_LLM_SETTINGS;
}
