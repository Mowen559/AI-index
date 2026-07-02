"use client";

import React, { useState, useEffect } from "react";
import { FileDiffViewer } from "./FileDiffViewer";

interface CodebaseAnalysisPanelProps {
  selectedFile: string | null;
  onClose: () => void;
}

interface CodeNode {
  id: string;
  kind: string;
  name: string;
  signature: string | null;
  docstring: string | null;
  start_line: number;
  end_line: number;
}

interface Edge {
  source: string;
  target: string;
  kind: string;
  source_name?: string;
  source_file?: string;
  source_kind?: string;
  target_name?: string;
  target_file?: string;
  target_kind?: string;
}

interface AnalysisData {
  file: string;
  nodes: CodeNode[];
  incomingEdges: Edge[];
  outgoingEdges: Edge[];
}

export function CodebaseAnalysisPanel({ selectedFile, onClose }: CodebaseAnalysisPanelProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'ast' | 'git'>('ast');
  const [gitHistory, setGitHistory] = useState<{ shadow: any[], local: any[] } | null>(null);
  const [gitLoading, setGitLoading] = useState(false);
  const [gitError, setGitError] = useState<string | null>(null);
  
  // Git Compare State
  const [selectedCommits, setSelectedCommits] = useState<{hash: string, repo: string, date: string}[]>([]);
  const [compareDiff, setCompareDiff] = useState<string | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  
  const handleCommitSelect = (hash: string, repo: string, date: string) => {
    setSelectedCommits(prev => {
      const exists = prev.find(c => c.hash === hash);
      if (exists) {
        return prev.filter(c => c.hash !== hash);
      }
      if (prev.length >= 2) {
        return [prev[1], { hash, repo, date }]; // Keep max 2
      }
      return [...prev, { hash, repo, date }];
    });
  };

  const handleCompare = async () => {
    if (selectedCommits.length === 0 || !selectedFile) return;
    setCompareLoading(true);
    setCompareDiff(null);
    try {
      let url = '';
      if (selectedCommits.length === 1) {
        // Diff against parent/local head
        url = `/api/git-diff?filePath=${encodeURIComponent(selectedFile)}&targetHash=${selectedCommits[0].hash}&repo=${selectedCommits[0].repo}`;
      } else {
        // Diff two commits. Chronological order.
        const sorted = [...selectedCommits].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        // We use the repo of the targetHash (the newer one) for context, but technically they might be in different repos.
        // Wait, if they are in different repos, git diff won't work easily unless they share history. Shadow git and local git do NOT share history! 
        // We will just assume diff works best within the same repo.
        url = `/api/git-diff?filePath=${encodeURIComponent(selectedFile)}&baseHash=${sorted[0].hash}&targetHash=${sorted[1].hash}&repo=${sorted[1].repo}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      if (data.diff) setCompareDiff(data.diff);
      else setCompareDiff("No diff output or identical files.");
    } catch (e) {
      console.error(e);
      setCompareDiff("Error generating diff.");
    } finally {
      setCompareLoading(false);
    }
  };

  const handleRestore = async (hash: string, repo: string) => {
    if (!selectedFile) return;
    if (!confirm('Are you sure you want to restore this file to the selected commit? This will overwrite your local file.')) return;
    
    try {
      const res = await fetch('/api/git-restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: selectedFile, hash, repo })
      });
      const data = await res.json();
      if (data.success) {
        alert('File restored successfully!');
      } else {
        alert('Failed to restore: ' + data.error);
      }
    } catch (e) {
      console.error(e);
      alert('Error restoring file.');
    }
  };

  useEffect(() => {
    if (!selectedFile) {
      setData(null);
      setGitHistory(null);
      setSelectedCommits([]);
      setCompareDiff(null);
      return;
    }
    
    let isMounted = true;
    setLoading(true);
    setError(null);
    setGitLoading(true);
    setSelectedCommits([]);
    setCompareDiff(null);
    setGitError(null);

    // Fetch AST Data
    fetch(`/api/analyze-file?filePath=${encodeURIComponent(selectedFile)}`)
      .then(res => res.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        if (isMounted) setData(json);
      })
      .catch(err => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // Fetch Git History Data
    fetch(`/api/file-git-history?filePath=${encodeURIComponent(selectedFile)}`)
      .then(res => res.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        if (isMounted) setGitHistory(json);
      })
      .catch(err => {
        if (isMounted) setGitError(err.message);
      })
      .finally(() => {
        if (isMounted) setGitLoading(false);
      });

    return () => { isMounted = false; };
  }, [selectedFile]);

  if (!selectedFile) return <div className="hidden" />;
  return (
    <div className="w-[450px] h-full bg-surface border-l border-border-default p-4 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)] animate-slide-in">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <h3 className="text-lg font-medium text-text-primary">File Inspector</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
          ✕
        </button>
      </div>
      
      <div className="text-[11px] font-mono text-accent-purple bg-accent-purple/10 border border-accent-purple/30 p-2 rounded mb-4 break-all shrink-0">
        {selectedFile}
      </div>

      <div className="flex gap-2 border-b border-border-subtle mb-4 shrink-0">
        <button 
          onClick={() => setActiveTab('ast')}
          className={`pb-2 px-2 text-sm font-medium transition-colors ${activeTab === 'ast' ? 'text-primary border-b-2 border-primary' : 'text-text-muted hover:text-text-primary'}`}
        >
          AST Analysis
        </button>
        <button 
          onClick={() => setActiveTab('git')}
          className={`pb-2 px-2 text-sm font-medium transition-colors ${activeTab === 'git' ? 'text-primary border-b-2 border-primary' : 'text-text-muted hover:text-text-primary'}`}
        >
          Git History
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {/* AST TAB CONTENT */}
        {activeTab === 'ast' && (
          <>
            {loading && (
              <div className="text-sm text-text-muted animate-pulse py-4 text-center">
                Querying CodeGraph index...
              </div>
            )}

            {error && (
              <div className="text-sm text-red-400 p-3 bg-red-900/20 border border-red-900/50 rounded">
                {error}
              </div>
            )}

        {!loading && !error && data && (
          <div className="space-y-6">
            
            {/* Summary Section */}
            <div className="flex gap-2 text-xs">
              <div className="flex-1 p-2 bg-elevated rounded border border-border-subtle flex flex-col items-center">
                <span className="text-text-primary font-bold text-base">{data.nodes.length}</span>
                <span className="text-text-muted uppercase text-[10px]">Symbols</span>
              </div>
              <div className="flex-1 p-2 bg-elevated rounded border border-border-subtle flex flex-col items-center">
                <span className="text-text-primary font-bold text-base">{data.incomingEdges.length}</span>
                <span className="text-text-muted uppercase text-[10px]">Callers</span>
              </div>
              <div className="flex-1 p-2 bg-elevated rounded border border-border-subtle flex flex-col items-center">
                <span className="text-text-primary font-bold text-base">{data.outgoingEdges.length}</span>
                <span className="text-text-muted uppercase text-[10px]">Deps</span>
              </div>
            </div>

            {/* AST Nodes */}
            <div>
              <h4 className="text-[11px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">Symbols & AST</h4>
              {data.nodes.length === 0 ? (
                <div className="text-xs text-text-muted italic">No symbols indexed in this file.</div>
              ) : (
                <div className="space-y-3">
                  {data.nodes.map(node => (
                    <div key={node.id} className="p-3 bg-elevated border border-border-subtle rounded text-left group">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm text-text-primary font-mono truncate mr-2" title={node.name}>
                          {node.name}
                        </span>
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 shrink-0">
                          {node.kind}
                        </span>
                      </div>
                      {node.signature && (
                        <div className="text-[10px] text-text-muted font-mono mt-1 break-all line-clamp-2">
                          {node.signature}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Incoming Edges (Who depends on this) */}
            <div>
              <h4 className="text-[11px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">Who calls this? (Incoming)</h4>
              {data.incomingEdges.length === 0 ? (
                <div className="text-xs text-text-muted italic">No incoming calls/imports found.</div>
              ) : (
                <div className="space-y-2">
                  {data.incomingEdges.slice(0, 10).map((edge, idx) => (
                    <div key={idx} className="p-2 text-xs bg-void/50 border border-border-subtle rounded flex justify-between items-center gap-2">
                      <div className="truncate flex-1">
                        <span className="text-accent-teal font-mono">{edge.source_name}</span>
                        <div className="text-[9px] text-text-muted truncate">{edge.source_file}</div>
                      </div>
                      <span className="text-[9px] bg-accent-teal/10 text-accent-teal px-1 rounded uppercase">
                        {edge.kind}
                      </span>
                    </div>
                  ))}
                  {data.incomingEdges.length > 10 && (
                    <div className="text-[10px] text-text-muted text-center pt-1">+ {data.incomingEdges.length - 10} more</div>
                  )}
                </div>
              )}
            </div>

            {/* Outgoing Edges (What this depends on) */}
            <div>
              <h4 className="text-[11px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">What does it call? (Outgoing)</h4>
              {data.outgoingEdges.length === 0 ? (
                <div className="text-xs text-text-muted italic">No outgoing dependencies found.</div>
              ) : (
                <div className="space-y-2">
                  {data.outgoingEdges.slice(0, 10).map((edge, idx) => (
                    <div key={idx} className="p-2 text-xs bg-void/50 border border-border-subtle rounded flex justify-between items-center gap-2">
                      <div className="truncate flex-1">
                        <span className="text-primary font-mono">{edge.target_name}</span>
                        <div className="text-[9px] text-text-muted truncate">{edge.target_file}</div>
                      </div>
                      <span className="text-[9px] bg-primary/10 text-primary px-1 rounded uppercase">
                        {edge.kind}
                      </span>
                    </div>
                  ))}
                  {data.outgoingEdges.length > 10 && (
                    <div className="text-[10px] text-text-muted text-center pt-1">+ {data.outgoingEdges.length - 10} more</div>
                  )}
                </div>
              )}
            </div>
            
          </div>
        )}
        </>
        )}

        {/* GIT HISTORY TAB CONTENT */}
        {activeTab === 'git' && (
          <div className="space-y-6 pb-6">
            {gitLoading && (
              <div className="text-sm text-text-muted animate-pulse py-4 text-center">
                Fetching Git History...
              </div>
            )}

            {gitError && (
              <div className="text-sm text-red-400 p-3 bg-red-900/20 border border-red-900/50 rounded">
                {gitError}
              </div>
            )}

            {!gitLoading && !gitError && gitHistory && (
              <div className="space-y-6">
                
                {/* Compare Controls */}
                <div className="sticky top-0 z-10 bg-[#161616] p-3 border-b border-border-default flex items-center justify-between">
                  <div className="text-xs text-text-muted">
                    Selected for comparison: <span className="font-bold text-text-primary">{selectedCommits.length}/2</span>
                  </div>
                  <button 
                    onClick={handleCompare}
                    disabled={selectedCommits.length === 0 || compareLoading}
                    className="px-3 py-1.5 bg-accent-teal/20 text-accent-teal hover:bg-accent-teal/30 rounded text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {compareLoading ? 'Comparing...' : 'Compare Selected'}
                  </button>
                </div>

                {/* Diff Viewer Area */}
                {compareDiff && (
                  <div className="border border-accent-teal/30 rounded overflow-hidden mt-4">
                    <div className="p-2 bg-accent-teal/10 border-b border-accent-teal/20 text-xs font-bold text-accent-teal flex justify-between">
                      <span>Diff Viewer</span>
                      <button onClick={() => setCompareDiff(null)} className="text-text-muted hover:text-white">✕</button>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar bg-[#0a0a0a]">
                      <FileDiffViewer diff={compareDiff} />
                    </div>
                  </div>
                )}

                {/* Shadow Git History */}
                <div>
                  <h4 className="text-[11px] font-semibold text-accent-purple mb-3 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent-purple animate-pulse"></span>
                    Shadow Git AI History
                  </h4>
                  {gitHistory.shadow.length === 0 ? (
                    <div className="text-xs text-text-muted italic">No AI modifications tracked for this file.</div>
                  ) : (
                    <div className="space-y-2">
                      {gitHistory.shadow.map((commit: any, idx: number) => {
                        const isSelected = selectedCommits.some(c => c.hash === commit.hash);
                        return (
                          <div key={commit.hash || idx} className={`bg-elevated border rounded overflow-hidden ${isSelected ? 'border-accent-teal ring-1 ring-accent-teal' : 'border-accent-purple/30'}`}>
                            <div className="p-2 flex justify-between items-center text-xs">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={() => handleCommitSelect(commit.hash, 'shadow', commit.date)}
                                  className="accent-accent-teal cursor-pointer"
                                />
                                <div className="font-semibold text-text-primary truncate" title={commit.message}>{commit.message}</div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 ml-2">
                                <div className="text-[10px] text-text-muted">{new Date(commit.date).toLocaleString()}</div>
                                <button 
                                  onClick={() => handleRestore(commit.hash, 'shadow')}
                                  className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] transition-colors"
                                  title="Restore this version to local file"
                                >
                                  Apply to Local
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Local Repo History */}
                <div className="mt-8">
                  <h4 className="text-[11px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">Local Repository (Recent)</h4>
                  {gitHistory.local.length === 0 ? (
                    <div className="text-xs text-text-muted italic">No local commits found for this file.</div>
                  ) : (
                    <div className="space-y-2">
                      {gitHistory.local.map((commit: any, idx: number) => {
                        const isSelected = selectedCommits.some(c => c.hash === commit.hash);
                        return (
                          <div key={commit.hash || idx} className={`bg-elevated border rounded overflow-hidden ${isSelected ? 'border-accent-teal ring-1 ring-accent-teal' : 'border-border-subtle'}`}>
                            <div className="p-2 flex justify-between items-center text-xs">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={() => handleCommitSelect(commit.hash, 'local', commit.date)}
                                  className="accent-accent-teal cursor-pointer"
                                />
                                <div className="font-semibold text-text-primary truncate" title={commit.message}>{commit.message}</div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 ml-2">
                                <div className="text-[10px] text-text-muted">{new Date(commit.date).toLocaleString()}</div>
                                <button 
                                  onClick={() => handleRestore(commit.hash, 'local')}
                                  className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] transition-colors"
                                  title="Restore this version to local file"
                                >
                                  Apply to Local
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Dummy AI modification for history test
