"use client";

import React, { useState, useEffect } from "react";
import { FileDiffViewer } from "./FileDiffViewer";

interface ShadowGitFile {
  path: string;
  status: string;
  diff: string;
}

export function ShadowGitDiffViewer() {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<ShadowGitFile[]>([]);
  const [activeFile, setActiveFile] = useState<ShadowGitFile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/shadow-git')
        .then(res => res.json())
        .then(data => {
          if (data.files) {
            setFiles(data.files);
            if (data.files.length > 0) {
              setActiveFile(data.files[0]);
            }
          }
        })
        .catch(err => console.error("Failed to load shadow git status", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) {
    return (
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
        <button 
          onClick={() => setIsOpen(true)}
          className="px-6 py-3 bg-accent-purple/20 hover:bg-accent-purple/30 border border-accent-purple/50 text-text-primary rounded-full shadow-glow-purple backdrop-blur-md transition-all flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-accent-purple animate-pulse"></span>
          View Shadow Git Changes
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-0 left-0 w-full h-[45vh] bg-surface/95 border-t border-border-default backdrop-blur-xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-slide-in flex flex-col z-50">
      <div className="flex justify-between items-center p-3 border-b border-border-subtle bg-elevated/50">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-text-primary">GitNexus: Shadow Git Diff!</h3>
          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-accent-purple/20 text-accent-purple border border-accent-purple/30">
            Uncommitted AI Edits
          </span>
          {loading && <span className="text-xs text-text-muted animate-pulse">Syncing...</span>}
        </div>
        <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-text-primary">
          ✕
        </button>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Modified Files List */}
        <div className="w-64 border-r border-border-subtle bg-void/50 overflow-y-auto p-2">
          <div className="text-xs font-semibold text-text-secondary mb-2 px-2 uppercase">
            Modified Files ({files.length})
          </div>
          
          {files.map((file) => (
            <div 
              key={file.path}
              onClick={() => setActiveFile(file)}
              className={`p-2 mb-1 rounded cursor-pointer text-sm font-mono transition-colors ${
                activeFile?.path === file.path 
                  ? 'bg-elevated border border-accent-purple/50 text-text-primary' 
                  : 'bg-transparent hover:bg-elevated text-text-muted border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{file.path}</span>
                <span className="text-xs text-text-secondary">{file.status}</span>
              </div>
            </div>
          ))}

          {files.length === 0 && !loading && (
            <div className="p-4 text-xs text-text-muted text-center">
              No shadow modifications found.
            </div>
          )}
        </div>

        {/* Right Side: Diff Viewer */}
        <div className="flex-1 overflow-auto bg-[#0a0a0a] flex flex-col">
          {activeFile ? (
            <>
              <div className="flex gap-4 p-4 text-xs text-text-muted border-b border-border-subtle bg-elevated/30">
                <div><span className="text-red-400 font-bold">---</span> {activeFile.path} (Original)</div>
                <div><span className="text-green-400 font-bold">+++</span> {activeFile.path} (AI Shadow)</div>
              </div>
              <div className="flex-1 overflow-auto">
                {activeFile.diff ? (
                  <FileDiffViewer diff={activeFile.diff} />
                ) : (
                  <div className="p-6 text-sm text-text-muted text-center">
                    (No textual diff available for this change)
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-text-muted text-sm">
              Select a file to view its shadow diff.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
