"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";

type LLMSettings = {
  enabled: boolean;
  provider: "openai-compatible";
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  uaFileLimit: number;
  uaSampleFileLimit: number;
  uaMaxFileChars: number;
  updatedAt: string;
};

const EMPTY_SETTINGS: LLMSettings = {
  enabled: false,
  provider: "openai-compatible",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4.1-mini",
  temperature: 0.2,
  maxTokens: 4000,
  uaFileLimit: 24,
  uaSampleFileLimit: 6,
  uaMaxFileChars: 12000,
  updatedAt: "",
};

export function LlmSettingsForm() {
  const [settings, setSettings] = useState<LLMSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/settings/llm");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load settings.");
        }
        setSettings(data.settings || EMPTY_SETTINGS);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load settings.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const updateSetting = <K extends keyof LLMSettings>(key: K, value: LLMSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/settings/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings.");
      }

      setSettings(data.settings || settings);
      setMessage("LLM settings saved. Future analyses will use the updated model configuration.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="mb-2 text-sm font-medium text-primary">Runtime Settings</div>
          <h1 className="text-3xl font-semibold text-text-primary">LLM Configuration</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            Configure the OpenAI-compatible model used by server-side Understand-Anything analysis
            and reverse engineering extraction.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface/70 px-4 py-2 text-sm font-medium text-text-primary transition hover:border-primary/50 hover:bg-primary/10"
        >
          <ArrowLeft size={16} />
          Back
        </Link>
      </div>

      <form onSubmit={handleSave} className="rounded-2xl border border-border-default bg-surface/70 p-6 backdrop-blur">
        {loading ? (
          <div className="flex items-center gap-3 text-sm text-text-secondary">
            <Loader2 size={16} className="animate-spin" />
            Loading settings...
          </div>
        ) : (
          <div className="space-y-6">
            <label className="flex items-start gap-3 rounded-xl border border-border-subtle bg-void/30 p-4">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) => updateSetting("enabled", event.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <div>
                <div className="text-sm font-medium text-text-primary">Enable server-side LLM execution</div>
                <div className="mt-1 text-xs leading-5 text-text-secondary">
                  When enabled, Hub will use this model for reverse parsing and the Understand-Anything
                  semantic pass.
                </div>
              </div>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Provider</label>
                <input
                  type="text"
                  value="OpenAI-compatible"
                  disabled
                  className="w-full rounded-xl border border-border-subtle bg-void/40 px-4 py-3 text-sm text-text-secondary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Model</label>
                <input
                  type="text"
                  value={settings.model}
                  onChange={(event) => updateSetting("model", event.target.value)}
                  placeholder="gpt-4.1-mini"
                  className="w-full rounded-xl border border-border-subtle bg-void/60 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-text-primary">Base URL</label>
                <input
                  type="text"
                  value={settings.baseUrl}
                  onChange={(event) => updateSetting("baseUrl", event.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full rounded-xl border border-border-subtle bg-void/60 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-text-primary">API Key</label>
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={(event) => updateSetting("apiKey", event.target.value)}
                  placeholder="sk-..."
                  className="w-full rounded-xl border border-border-subtle bg-void/60 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Temperature</label>
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={settings.temperature}
                  onChange={(event) => updateSetting("temperature", Number(event.target.value))}
                  className="w-full rounded-xl border border-border-subtle bg-void/60 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Max Tokens</label>
                <input
                  type="number"
                  min={256}
                  max={32000}
                  step={128}
                  value={settings.maxTokens}
                  onChange={(event) => updateSetting("maxTokens", Number(event.target.value))}
                  className="w-full rounded-xl border border-border-subtle bg-void/60 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">UA File Limit</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  step={1}
                  value={settings.uaFileLimit}
                  onChange={(event) => updateSetting("uaFileLimit", Number(event.target.value))}
                  className="w-full rounded-xl border border-border-subtle bg-void/60 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">UA Sample File Limit</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  value={settings.uaSampleFileLimit}
                  onChange={(event) => updateSetting("uaSampleFileLimit", Number(event.target.value))}
                  className="w-full rounded-xl border border-border-subtle bg-void/60 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-text-primary">UA Max File Characters</label>
                <input
                  type="number"
                  min={1000}
                  max={50000}
                  step={500}
                  value={settings.uaMaxFileChars}
                  onChange={(event) => updateSetting("uaMaxFileChars", Number(event.target.value))}
                  className="w-full rounded-xl border border-border-subtle bg-void/60 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {message ? (
              <div className="rounded-xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm text-green-200">
                {message}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-4 border-t border-border-subtle pt-4">
              <div className="text-xs text-text-muted">
                Saved locally on this machine. The current API key is stored in the Hub runtime settings file.
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:border-primary/60 hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Settings
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
