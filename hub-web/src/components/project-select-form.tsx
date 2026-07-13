"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Clock3,
  FolderOpen,
  GitBranch,
  Loader2,
  Play,
  Settings2,
  Sparkles,
  TerminalSquare,
} from "lucide-react";

type ProjectSource = "local" | "git";

type RecentProject = {
  path: string;
  name: string;
  source: ProjectSource;
  gitUrl?: string;
  lastOpenedAt: string;
};

type CloneResponse = {
  path: string;
  name: string;
  alreadyExists?: boolean;
};

type AnalyzeResponse = {
  taskId?: string;
  error?: string;
};

const RECENT_PROJECTS_KEY = "hub-web:recent-projects";
const LEGACY_RECENT_KEY = "recentProject";

function getProjectName(projectPath: string) {
  const parts = projectPath.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) || projectPath;
}

function normalizeRecentProject(project: Omit<RecentProject, "lastOpenedAt">): RecentProject {
  return {
    ...project,
    name: project.name || getProjectName(project.path),
    lastOpenedAt: new Date().toISOString(),
  };
}

function readRecentProjects(): RecentProject[] {
  const raw = localStorage.getItem(RECENT_PROJECTS_KEY);
  const legacy = localStorage.getItem(LEGACY_RECENT_KEY);

  try {
    const parsed = raw ? (JSON.parse(raw) as RecentProject[]) : [];
    const validProjects = Array.isArray(parsed)
      ? parsed.filter((item) => item?.path && item?.name)
      : [];

    if (legacy && !validProjects.some((item) => item.path === legacy)) {
      validProjects.unshift(
        normalizeRecentProject({
          path: legacy,
          name: getProjectName(legacy),
          source: "local",
        }),
      );
    }

    return validProjects.slice(0, 12);
  } catch {
    return legacy
      ? [
          normalizeRecentProject({
            path: legacy,
            name: getProjectName(legacy),
            source: "local",
          }),
        ]
      : [];
  }
}

function formatLastOpened(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleString();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ProjectSelectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ideParam = searchParams.has("ide") ? `&ide=${searchParams.get("ide")}` : "";
  const initialProjects = typeof window === "undefined" ? [] : readRecentProjects();
  const initialProjectPath = initialProjects[0]?.path ?? "";

  const [localPath, setLocalPath] = useState(initialProjectPath);
  const [gitUrl, setGitUrl] = useState("");
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>(initialProjects);
  const [selectedPath, setSelectedPath] = useState(initialProjectPath);
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState("");
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const selectedProject = useMemo(
    () => recentProjects.find((project) => project.path === selectedPath),
    [recentProjects, selectedPath],
  );

  const persistRecentProjects = (projects: RecentProject[]) => {
    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(projects));
    if (projects[0]) {
      localStorage.setItem(LEGACY_RECENT_KEY, projects[0].path);
    }
  };

  const rememberProject = (project: Omit<RecentProject, "lastOpenedAt">) => {
    const normalized = normalizeRecentProject(project);
    setRecentProjects((current) => {
      const next = [normalized, ...current.filter((item) => item.path !== normalized.path)].slice(0, 12);
      persistRecentProjects(next);
      return next;
    });
    setSelectedPath(normalized.path);
    setLocalPath(normalized.path);
    return normalized;
  };

  const openDashboard = (project: RecentProject) => {
    router.push(`/?project=${encodeURIComponent(project.path)}${ideParam}`);
  };

  const pollTask = async (taskId: string, project: Omit<RecentProject, "lastOpenedAt">) => {
    while (true) {
      await sleep(1200);

      const [taskRes, logsRes] = await Promise.all([
        fetch(`/api/tasks/${encodeURIComponent(taskId)}`),
        fetch(`/api/tasks/${encodeURIComponent(taskId)}/logs`),
      ]);

      const taskPayload = await taskRes.json().catch(() => ({}));
      const logText = await logsRes.text().catch(() => "");
      const nextLogs = logText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      setLogs(nextLogs);

      const status = taskPayload?.task?.status as string | undefined;
      if (status === "completed") {
        openDashboard(rememberProject(project));
        return;
      }

      if (status === "failed" || status === "cancelled") {
        throw new Error(taskPayload?.task?.error || "Analysis pipeline failed. Check the logs for details.");
      }
    }
  };

  const runAnalysis = async (project: Omit<RecentProject, "lastOpenedAt">) => {
    if (!project.path.trim()) {
      setError("Please choose a valid local project path first.");
      return;
    }

    setError("");
    setLoading(true);
    setActiveAction("analyze");
    setLogs([]);

    try {
      const res = await fetch("/api/projects/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: project.path.trim(),
          projectId: project.name,
          options: {
            clientHandlesUA: false,
          },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as AnalyzeResponse;
      if (!res.ok || !data.taskId) {
        throw new Error(data.error || "Failed to start project analysis.");
      }

      setLogs((prev) => [...prev, `[Hub] Analysis task created: ${data.taskId}`]);
      await pollTask(data.taskId, project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start project analysis.");
      setLoading(false);
      setActiveAction("");
    }
  };

  const handleAnalyzeLocalProject = () => {
    const projectPath = localPath.trim();
    void runAnalysis({
      path: projectPath,
      name: getProjectName(projectPath),
      source: "local",
    });
  };

  const handleOpenRecentProject = (project = selectedProject) => {
    if (!project) {
      setError("There is no recent project to open yet.");
      return;
    }

    openDashboard(rememberProject(project));
  };

  const handleCloneGitRepository = async () => {
    const url = gitUrl.trim();
    if (!url) {
      setError("Please enter a Git repository URL first.");
      return;
    }

    setError("");
    setLoading(true);
    setActiveAction("clone");
    setLogs(["[Git] Cloning repository into the local workspace..."]);

    try {
      const res = await fetch("/api/projects/git-clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gitUrl: url }),
      });

      const data = (await res.json().catch(() => ({}))) as Partial<CloneResponse> & {
        error?: string;
      };

      if (!res.ok || !data.path || !data.name) {
        throw new Error(data.error || "Failed to clone the Git repository.");
      }

      setLogs((prev) => [
        ...prev,
        data.alreadyExists
          ? `[Git] Reusing existing local checkout: ${data.path}`
          : `[Git] Repository cloned successfully: ${data.path}`,
        "[Hub] Starting the analysis pipeline...",
      ]);

      await runAnalysis({
        path: data.path,
        name: data.name,
        source: "git",
        gitUrl: url,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clone the Git repository.");
      setLoading(false);
      setActiveAction("");
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-2xl border border-border-default bg-surface/70 p-5 shadow-glow-soft backdrop-blur">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
              <TerminalSquare size={16} />
              Project Workspace
            </div>
            <h2 className="text-2xl font-semibold text-text-primary">Open a project like an IDE</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Pick a recent project, point Hub at a local folder, or clone a Git repository and let the
              backend run codebase indexing plus the LLM-powered semantic pass.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/settings")}
              className="hidden shrink-0 items-center gap-2 rounded-xl border border-border-default bg-surface/80 px-4 py-2 text-sm font-medium text-text-primary transition hover:border-primary/50 hover:bg-primary/10 sm:flex"
            >
              <Settings2 size={15} />
              LLM Settings
            </button>
            {selectedProject ? (
              <button
                type="button"
                onClick={() => handleOpenRecentProject()}
                disabled={loading}
                className="hidden shrink-0 items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:border-primary/60 hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50 sm:flex"
              >
                <Play size={15} />
                Open Recent
              </button>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border-subtle bg-deep/60">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <Clock3 size={16} className="text-primary" />
              Recent Projects
            </div>
            <span className="text-xs text-text-muted">
              {recentProjects.length ? "Double-click to open immediately" : "No history yet"}
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {recentProjects.length ? (
              recentProjects.map((project) => (
                <button
                  key={project.path}
                  type="button"
                  onClick={() => {
                    setSelectedPath(project.path);
                    setLocalPath(project.path);
                  }}
                  onDoubleClick={() => handleOpenRecentProject(project)}
                  className={`mb-2 w-full rounded-lg border px-3 py-3 text-left transition ${
                    selectedPath === project.path
                      ? "border-primary/60 bg-primary/10"
                      : "border-transparent bg-surface/40 hover:border-border-default hover:bg-hover/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-text-primary">{project.name}</span>
                    <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[11px] uppercase text-text-muted">
                      {project.source}
                    </span>
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-text-muted">{project.path}</div>
                  <div className="mt-2 text-xs text-text-secondary">{formatLastOpened(project.lastOpenedAt)}</div>
                </button>
              ))
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border-default bg-void/40 px-6 text-center">
                <FolderOpen size={28} className="mb-3 text-text-muted" />
                <p className="text-sm font-medium text-text-primary">No recent projects yet</p>
                <p className="mt-2 text-xs leading-5 text-text-secondary">
                  Start from a local folder or clone a Git repository. Hub will remember it after the
                  first successful analysis.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="rounded-2xl border border-border-default bg-surface/70 p-5 backdrop-blur">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-text-primary">
            <FolderOpen size={16} className="text-primary" />
            Local Folder
          </div>
          <label className="mb-2 block text-xs text-text-secondary">
            Paste an absolute path to the local project you want Hub to analyze.
          </label>
          <input
            type="text"
            value={localPath}
            onChange={(event) => setLocalPath(event.target.value)}
            placeholder="D:\\cloud\\deepcloud\\super agent\\hub-web"
            disabled={loading}
            className="w-full rounded-xl border border-border-subtle bg-void/60 px-4 py-3 font-mono text-sm text-text-primary placeholder:text-text-muted outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleAnalyzeLocalProject}
            disabled={loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border-default bg-hover px-4 py-3 text-sm font-medium text-text-primary transition hover:border-primary/60 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && activeAction === "analyze" ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Sparkles size={17} />
            )}
            Analyze Local Project
          </button>
        </div>

        <div className="rounded-2xl border border-border-default bg-surface/70 p-5 backdrop-blur">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-text-primary">
            <GitBranch size={16} className="text-primary" />
            Git Repository
          </div>
          <input
            type="text"
            value={gitUrl}
            onChange={(event) => setGitUrl(event.target.value)}
            placeholder="https://github.com/org/repo.git"
            disabled={loading}
            className="w-full rounded-xl border border-border-subtle bg-void/60 px-4 py-3 font-mono text-sm text-text-primary placeholder:text-text-muted outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
          />
          <p className="mt-2 text-xs text-text-secondary">
            Repositories are cloned into `HUB_PROJECTS_ROOT`, or `~/.aindex-hub/projects` when that
            variable is not configured.
          </p>
          <button
            type="button"
            onClick={handleCloneGitRepository}
            disabled={loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition hover:border-primary/60 hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && activeAction === "clone" ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <GitBranch size={17} />
            )}
            Clone And Analyze
          </button>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="max-h-52 overflow-y-auto rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-text-secondary">
            <div className="mb-3 flex items-center gap-3 text-text-primary">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
              </span>
              Backend analysis pipeline running
            </div>
            <ul className="space-y-1 font-mono text-xs">
              {logs.map((log, index) => (
                <li key={`${log}-${index}`} className="text-primary">
                  {log}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
