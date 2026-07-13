"use client";

import React, { useEffect, useState } from 'react';
import { Sparkles, Cpu, Database, Activity, Terminal, Zap, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

type RuntimeStatus = {
  key: string;
  label: string;
  state: 'ok' | 'warning' | 'error';
  message: string;
  path?: string;
};

export function ProjectOverviewPanel() {
  const [stats, setStats] = useState<{ nodesCount: number; edgesCount: number } | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [agentStats, setAgentStats] = useState<any>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [runtimeHealth, setRuntimeHealth] = useState<{ overall: string; statuses: RuntimeStatus[] } | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const projectPath = searchParams.get('project') || '';

  useEffect(() => {
    fetch(`/api/project-graph?project=${encodeURIComponent(projectPath)}`)
      .then(res => res.json())
      .then(data => {
        if (data.stats) {
          setStats(data.stats);
        }
      })
      .catch(console.error);
  }, [projectPath]);

  useEffect(() => {
    fetch(`/api/supermemory-logs?project=${encodeURIComponent(projectPath)}`)
      .then(res => res.json())
      .then(data => {
        setLogs(data.logs || []);
        setAgentStats(data.stats || null);
      })
      .catch(console.error)
      .finally(() => setLoadingLogs(false));
  }, [projectPath]);

  useEffect(() => {
    fetch(`/api/health?project=${encodeURIComponent(projectPath)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load runtime health');
        }
        setRuntimeHealth(data);
      })
      .catch((error) => {
        console.error(error);
        setHealthError(error.message);
      });
  }, [projectPath]);

  const getStatusIcon = (state: RuntimeStatus['state']) => {
    if (state === 'ok') return <ShieldCheck className="w-4 h-4 text-green-400" />;
    if (state === 'warning') return <ShieldQuestion className="w-4 h-4 text-amber-400" />;
    return <ShieldAlert className="w-4 h-4 text-red-400" />;
  };

  return (
    <div className="h-full overflow-y-auto flex flex-col hide-scrollbar">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-border-default bg-surface/50 sticky top-0 backdrop-blur-xl z-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-text-primary">Project Overview</h2>
        </div>
        <p className="text-sm text-text-secondary mt-2 leading-relaxed">
          Powered by the <span className="text-primary font-medium">Understand-Anything</span> engine.
        </p>
      </div>

      <div className="p-6 flex flex-col gap-6">
        {/* Semantic Summary */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Cpu className="w-4 h-4 text-text-secondary" />
            Semantic Understanding
          </h3>
          <div className="p-4 rounded-xl bg-surface border border-border-default shadow-inner">
            <p className="text-sm text-text-secondary leading-relaxed">
              The neural graph has successfully mapped the underlying architecture and AST relationships across the entire workspace. 
              <br/><br/>
              By clicking on individual nodes in the Knowledge Graph or navigating the File Explorer, you can dive deep into file-specific semantics, callers, and structural definitions.
            </p>
          </div>
        </div>

        {/* Runtime Health */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-text-secondary" />
            Runtime Health
          </h3>
          <div className="rounded-xl bg-surface border border-border-default overflow-hidden">
            <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Subsystem Status</span>
              <span className={`text-[10px] px-2 py-1 rounded-full border ${
                runtimeHealth?.overall === 'ok'
                  ? 'border-green-500/30 text-green-400 bg-green-500/10'
                  : runtimeHealth?.overall === 'warning'
                    ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                    : 'border-red-500/30 text-red-400 bg-red-500/10'
              }`}>
                {runtimeHealth?.overall?.toUpperCase() || 'CHECKING'}
              </span>
            </div>
            <div className="p-3 space-y-3">
              {healthError ? (
                <div className="text-xs text-red-400">{healthError}</div>
              ) : !runtimeHealth ? (
                <div className="text-xs text-text-muted animate-pulse">Checking subsystem readiness...</div>
              ) : (
                runtimeHealth.statuses.map((status) => (
                  <div key={status.key} className="rounded-lg border border-border-subtle bg-deep/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {getStatusIcon(status.state)}
                        <span className="text-sm font-medium text-text-primary truncate">{status.label}</span>
                      </div>
                      <span className={`text-[10px] uppercase ${
                        status.state === 'ok'
                          ? 'text-green-400'
                          : status.state === 'warning'
                            ? 'text-amber-400'
                            : 'text-red-400'
                      }`}>
                        {status.state}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-2 leading-relaxed">{status.message}</p>
                    {status.path && (
                      <div className="mt-2 text-[10px] font-mono text-text-muted break-all">
                        {status.path}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Global Stats */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Database className="w-4 h-4 text-text-secondary" />
            Global Repository Stats
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-surface border border-border-default flex flex-col gap-1">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Total Files</span>
              <span className="text-2xl font-bold text-text-primary font-mono">{stats ? stats.nodesCount : '...'}</span>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-border-default flex flex-col gap-1">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Dependencies</span>
              <span className="text-2xl font-bold text-text-primary font-mono">{stats ? stats.edgesCount : '...'}</span>
            </div>
          </div>
        </div>

        {/* Supermemory Activity Monitor */}
        <div className="flex-1 min-h-[300px] flex flex-col bg-surface border border-border-default rounded-xl shadow-inner overflow-hidden mt-2">
          <div className="p-3 border-b border-border-default bg-surface/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-accent-purple">
              <Activity className="w-4 h-4" />
              Agent Activity Monitor
            </div>
            {agentStats && (
              <div className="flex items-center gap-3 text-[10px] font-mono text-text-muted">
                <span title="Total Queries Processed">Q: {agentStats.totalQueries}</span>
                <span title="Total Stored Memories">M: {agentStats.totalMemories ?? 0}</span>
                <span className="flex items-center gap-1 text-accent-teal"><Zap className="w-3 h-3"/> Active</span>
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#0a0a0a]">
            {loadingLogs ? (
              <div className="text-center text-xs text-text-muted animate-pulse py-4">Loading agent telemetry...</div>
            ) : logs.length === 0 ? (
              <div className="text-center text-xs text-text-muted italic py-4">No recent agent activity.</div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="flex gap-3 max-w-full">
                  <div className="w-6 h-6 rounded-md shrink-0 bg-surface border border-border-subtle flex items-center justify-center mt-0.5 text-text-secondary">
                    <Terminal className="w-3 h-3" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-text-muted font-mono">
                      <span>{log.type.toUpperCase()}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    {log.type === 'query' ? (
                      <div className="p-2.5 rounded bg-surface border border-border-subtle text-xs">
                        <div className="font-semibold text-text-primary mb-1 border-b border-border-subtle pb-1">User: {log.query}</div>
                        <div className="text-text-secondary leading-relaxed">{log.response}</div>
                        {log.tokensUsed && (
                          <div className="mt-2 text-[9px] text-text-muted text-right font-mono">Tokens: {log.tokensUsed}</div>
                        )}
                      </div>
                    ) : (
                      <div className="p-2 rounded bg-accent-purple/10 border border-accent-purple/20 text-xs text-accent-purple font-mono">
                        {log.message}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
