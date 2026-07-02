"use client";

import React, { useState } from "react";
import { UnifiedKnowledgeGraph } from "@/components/UnifiedKnowledgeGraph";
import { CodebaseAnalysisPanel } from "@/components/CodebaseAnalysisPanel";
import { ShadowGitDiffViewer } from "@/components/ShadowGitDiffViewer";
import { FileExplorerSidebar } from "@/components/FileExplorerSidebar";
import { ProjectOverviewPanel } from "@/components/ProjectOverviewPanel";

export default function DashboardPage() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const handleNodeClick = (filePath: string, nodeType: string = "file") => {
    if (nodeType === "file") {
      setSelectedFile(filePath);
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
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            AIndex <span className="text-primary">Hub</span>
          </h1>
          <div className="h-4 w-px bg-border-subtle mx-2"></div>
          <span className="text-sm font-medium text-text-secondary flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            Understand-Anything Active
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-sm text-text-muted hover:text-text-primary transition-colors">Settings</button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex relative overflow-hidden">
        
        {/* Left: IDE File Explorer Sidebar */}
        <FileExplorerSidebar 
          onFileSelect={handleNodeClick}
          history={history}
          selectedFile={selectedFile}
        />

        {/* Center: Knowledge Graph */}
        <div className={`flex-1 transition-all duration-300 relative ${selectedFile ? 'mr-[400px]' : ''}`}>
          <UnifiedKnowledgeGraph onNodeClick={handleNodeClick} selectedFile={selectedFile} />
        </div>

        {/* Right: Codebase Analysis / Project Overview Panel */}
        <div className={`absolute top-0 right-0 h-full w-[400px] bg-surface/95 backdrop-blur-xl border-l border-border-default transition-transform duration-300 ease-in-out z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] translate-x-0`}>
          {selectedFile ? (
            <CodebaseAnalysisPanel 
              selectedFile={selectedFile} 
              onClose={() => setSelectedFile(null)} 
            />
          ) : (
            <ProjectOverviewPanel />
          )}
        </div>

        {/* Bottom: Shadow Git Diff Viewer */}
        <ShadowGitDiffViewer />
      </div>
    </div>
  );
}
