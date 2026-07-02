"use client";

import React, { useEffect, useState } from 'react';
import { Sparkles, GitBranch, Cpu, Database } from 'lucide-react';

export function ProjectOverviewPanel() {
  const [stats, setStats] = useState<{ nodesCount: number; edgesCount: number } | null>(null);

  useEffect(() => {
    fetch('/api/project-graph')
      .then(res => res.json())
      .then(data => {
        if (data.stats) {
          setStats(data.stats);
        }
      })
      .catch(console.error);
  }, []);

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

        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm text-text-secondary mt-4">
          <p className="flex items-center gap-2 mb-2 font-medium text-text-primary">
            <GitBranch className="w-4 h-4 text-primary" />
            Supermemory Active
          </p>
          The Supermemory agent has embedded the codebase and is ready for natural language inquiries (coming soon).
        </div>
      </div>
    </div>
  );
}
