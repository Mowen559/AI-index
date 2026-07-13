"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { UnifiedKnowledgeGraph } from "@/components/UnifiedKnowledgeGraph";
import { CodebaseAnalysisPanel } from "@/components/CodebaseAnalysisPanel";
import { FileHistoryMergeView } from "@/components/FileHistoryMergeView";
import { ShadowGitDiffViewer } from "@/components/ShadowGitDiffViewer";
import { FileExplorerSidebar } from "@/components/FileExplorerSidebar";
import { ProjectOverviewPanel } from "@/components/ProjectOverviewPanel";
import { ProjectSelectForm } from "@/components/project-select-form";

function getProjectName(projectPath: string) {
  const parts = projectPath.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) || projectPath || "No project selected";
}

function DashboardWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectPath = searchParams.get("project") || "";
  const isIde = searchParams.has("ide");
  const projectName = getProjectName(projectPath);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [centerView, setCenterView] = useState<'graph' | 'merge'>('graph');

  const handleNodeClick = (filePath: string, nodeType: string = "file") => {
    if (nodeType === "file") {
      setSelectedFile(filePath);
      setCenterView('graph'); // Reset to graph view on new file selection
      // Add to history, move to front if already exists
      setHistory(prev => {
        const filtered = prev.filter(p => p !== filePath);
        return [filePath, ...filtered].slice(0, 20); // Keep last 20
      });
    }
  };

  return (
    <div className="w-full h-screen flex flex-col bg-deep overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-border-default bg-surface/80 backdrop-blur-md flex items-center justify-between px-6 z-40 shrink-0">
        <div className="flex min-w-0 items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            AIndex <span className="text-primary">Hub</span>
          </h1>
          <div className="h-4 w-px bg-border-subtle mx-2"></div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-text-primary">{projectName}</div>
            {projectPath ? (
              <div className="max-w-[520px] truncate font-mono text-[11px] text-text-muted">
                {projectPath}
              </div>
            ) : null}
          </div>
          <div className="h-4 w-px bg-border-subtle mx-2"></div>
          <span className="text-sm font-medium text-text-secondary flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            Understand-Anything Active
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/settings"
            className="text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            LLM Settings
          </Link>
          {!isIde && (
            <button
              onClick={() => {
                localStorage.removeItem('recentProject');
                window.location.href = '/';
              }}
              className="text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              Change Project
            </button>
          )}
          <button className="text-sm text-text-muted hover:text-text-primary transition-colors">Settings</button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex relative overflow-hidden">
        
        {/* Left: IDE File Explorer Sidebar */}
        {!isIde && (
          <FileExplorerSidebar 
            onFileSelect={handleNodeClick}
            history={history}
            selectedFile={selectedFile}
          />
        )}

        {/* Center: Knowledge Graph or History Merge */}
        <div className={`flex-1 transition-all duration-300 relative overflow-y-auto ${selectedFile && centerView === 'graph' ? 'mr-[400px]' : ''}`}>
          {!projectPath ? (
            <div className="flex items-center justify-center h-full min-h-[600px] p-8">
              <ProjectSelectForm />
            </div>
          ) : centerView === 'graph' ? (
            <UnifiedKnowledgeGraph onNodeClick={handleNodeClick} selectedFile={selectedFile} />
          ) : selectedFile ? (
            <FileHistoryMergeView 
              selectedFile={selectedFile} 
              onClose={() => setCenterView('graph')} 
            />
          ) : null}
        </div>

        {/* Right: Codebase Analysis / Project Overview Panel */}
        {projectPath && (
          <div className={`absolute top-0 right-0 h-full w-[400px] bg-surface/95 backdrop-blur-xl border-l border-border-default transition-transform duration-300 ease-in-out z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] ${centerView === 'graph' ? 'translate-x-0' : 'translate-x-[400px]'}`}>
            {selectedFile ? (
              <CodebaseAnalysisPanel 
                selectedFile={selectedFile} 
                onClose={() => setSelectedFile(null)} 
                onOpenMergeView={() => setCenterView('merge')}
              />
            ) : (
              <ProjectOverviewPanel />
            )}
          </div>
        )}

        {/* Bottom: Shadow Git Diff Viewer */}
        <ShadowGitDiffViewer />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-deep" />}>
      <DashboardWorkspace />
    </Suspense>
  );
}
