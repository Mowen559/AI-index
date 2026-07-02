"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Box, BrainCircuit, Network, Database } from "lucide-react";
import dynamic from "next/dynamic";

const GraphTab = dynamic(() => import("graph-ui").then((mod) => mod.GraphTab), { ssr: false });

export default function ProjectDashboard({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const targetPath = decodeURIComponent(resolvedParams.id);
  const [activeTab, setActiveTab] = useState("graph");

  return (
    <div className="flex h-screen w-full bg-void text-text-primary overflow-hidden font-[family-name:var(--font-geist-sans)] selection:bg-primary/30">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent-purple/10 via-void to-void" />
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-purple via-primary to-accent-teal opacity-50" />

      {/* Left Sidebar */}
      <aside className="w-72 bg-surface/50 border-r border-border-subtle backdrop-blur-md flex flex-col z-10 relative">
        <div className="p-6 border-b border-border-subtle">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-primary transition-colors mb-6 group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Return to Hub
          </Link>
          <div className="space-y-1">
            <h2 className="font-bold text-lg truncate text-text-primary flex items-center gap-2" title={targetPath}>
              <Box className="text-primary" size={18} />
              Project Overview
            </h2>
            <p className="text-xs text-text-muted truncate" title={targetPath}>{targetPath}</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5">
          <button 
            onClick={() => setActiveTab("graph")}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-300 flex items-center gap-3 ${activeTab === 'graph' ? 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(45,212,191,0.1)]' : 'text-text-secondary hover:bg-surface hover:text-text-primary border border-transparent'}`}
          >
            <Network size={18} />
            <span className="font-medium">Nebula Graph (3D)</span>
          </button>
          <button 
            onClick={() => setActiveTab("blueprints")}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-300 flex items-center gap-3 ${activeTab === 'blueprints' ? 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(45,212,191,0.1)]' : 'text-text-secondary hover:bg-surface hover:text-text-primary border border-transparent'}`}
          >
            <BrainCircuit size={18} />
            <span className="font-medium">Code Blueprints</span>
          </button>
          <button 
            onClick={() => setActiveTab("memory")}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-300 flex items-center gap-3 ${activeTab === 'memory' ? 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(45,212,191,0.1)]' : 'text-text-secondary hover:bg-surface hover:text-text-primary border border-transparent'}`}
          >
            <Database size={18} />
            <span className="font-medium">Codebase Memory</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative">
        <header className="h-16 bg-surface/30 border-b border-border-subtle backdrop-blur-md flex items-center px-8 z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-6 bg-primary rounded-full animate-breathe" />
            <h1 className="text-xl font-semibold capitalize tracking-wide text-text-primary">
              {activeTab.replace("-", " ")}
            </h1>
          </div>
        </header>

        <div className="flex-1 bg-void relative overflow-hidden">
          {activeTab === "graph" && (
            <div className="w-full h-full flex items-center justify-center relative">
              <GraphTab project={targetPath} />
            </div>
          )}
          
          {activeTab === "blueprints" && (
            <div className="w-full h-full flex p-8 relative z-10">
              <div className="flex-1 bg-surface/40 backdrop-blur-md rounded-2xl border border-border-subtle shadow-2xl p-6 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent-purple/5 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2" />
                
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <BrainCircuit className="text-accent-purple" size={20} />
                  NLP to Code Blueprint
                </h3>
                <div className="flex-1 border border-border-subtle rounded-xl p-6 mb-6 bg-void/50 overflow-y-auto font-mono text-sm shadow-inner">
                  <p className="text-text-muted italic">Agentic analysis history will stream here. Powered by rtk & codebase-memory-mcp.</p>
                </div>
                <div className="flex gap-3 relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-accent-purple/20 to-primary/20 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity blur-sm -z-10" />
                  <input 
                    type="text" 
                    placeholder="e.g. Add a ping endpoint in server.ts..." 
                    className="flex-1 bg-void border border-border-subtle rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors" 
                  />
                  <button className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 px-6 py-3 rounded-xl font-medium transition-all shadow-[0_0_15px_rgba(45,212,191,0.1)] hover:shadow-[0_0_25px_rgba(45,212,191,0.2)]">
                    Generate
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "memory" && (
            <div className="w-full h-full flex p-8 relative z-10">
              <div className="w-full bg-surface/40 backdrop-blur-md rounded-2xl border border-border-subtle shadow-2xl p-8 relative overflow-hidden h-fit">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent-teal/30 to-transparent" />
                
                <h3 className="text-lg font-semibold mb-8 flex items-center gap-2">
                  <Database className="text-accent-teal" size={20} />
                  Memory Index Status
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="border border-border-subtle bg-void/30 rounded-xl p-6 hover:border-primary/30 transition-colors relative group">
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                    <p className="text-sm text-text-secondary mb-2 font-medium">Files Indexed</p>
                    <p className="text-3xl font-bold text-text-primary">1,245</p>
                  </div>
                  <div className="border border-border-subtle bg-void/30 rounded-xl p-6 hover:border-accent-purple/30 transition-colors relative group">
                    <div className="absolute inset-0 bg-accent-purple/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                    <p className="text-sm text-text-secondary mb-2 font-medium">AST Nodes</p>
                    <p className="text-3xl font-bold text-text-primary">8,932</p>
                  </div>
                  <div className="border border-border-subtle bg-void/30 rounded-xl p-6 hover:border-accent-teal/30 transition-colors relative group">
                    <div className="absolute inset-0 bg-accent-teal/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                    <p className="text-sm text-text-secondary mb-2 font-medium">Vector Embeddings</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-teal opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-accent-teal"></span>
                      </span>
                      <p className="text-2xl font-bold text-accent-teal">Active</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
