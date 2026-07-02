"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderSearch, Loader2, Sparkles } from "lucide-react";

export function ProjectSelectForm() {
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!path.trim()) {
      setError("Please enter a valid absolute path.");
      return;
    }
    setError("");
    setLoading(true);
    setLogs([]);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Analysis failed");
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "log") {
                setLogs((prev) => [...prev, data.msg]);
              } else if (data.type === "status") {
                if (data.status === "complete") {
                  const projectId = encodeURIComponent(path.trim());
                  // Redirect to the new dashboard layout!
                  router.push(`/dashboard?project=${projectId}`);
                  return;
                } else if (data.status === "error") {
                  setError(logs[logs.length - 1] || "An error occurred during initialization.");
                  setLoading(false);
                  return;
                }
              }
            } catch (e) {
              // Ignore parse errors on partial chunks
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">
      <div className="relative group">
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2 transition-colors group-hover:text-primary">
          <FolderSearch size={16} />
          Local Project Path
        </label>
        <div className="relative">
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="e.g. D:\cloud\my-project"
            className="w-full bg-void/50 border border-border-subtle rounded-xl px-4 py-3 pl-11 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-300"
            disabled={loading}
          />
          <Sparkles 
            size={16} 
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" 
          />
        </div>
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/0 via-primary/20 to-primary/0 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur-sm -z-10" />
      </div>
      
      {error && (
        <div className="animate-fade-in text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2">
          {error}
        </div>
      )}
      
      <button
        type="submit"
        disabled={loading}
        className="relative group overflow-hidden w-full bg-surface border border-border-default hover:border-primary text-text-primary font-medium py-3 px-4 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent-purple/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <span className="relative flex items-center justify-center gap-2">
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Deep Indexing...
            </>
          ) : (
            <>
              Initialize Agentic Analysis
            </>
          )}
        </span>
      </button>
      
      {loading && (
        <div className="mt-2 animate-fade-in p-5 border border-primary/20 bg-primary/5 rounded-xl text-sm text-text-secondary backdrop-blur-sm max-h-48 overflow-y-auto">
          <div className="flex items-center gap-3 mb-3 sticky top-0 bg-primary/5 backdrop-blur py-1">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </div>
            <p className="font-medium text-text-primary">Pipeline running in background...</p>
          </div>
          <ul className="space-y-1 text-xs opacity-80 font-mono">
            {logs.map((log, i) => (
              <li key={i} className="text-primary">{log}</li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
