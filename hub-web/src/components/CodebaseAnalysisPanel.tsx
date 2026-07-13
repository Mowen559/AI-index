"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { FileDiffViewer } from "./FileDiffViewer";

interface CodebaseAnalysisPanelProps {
  selectedFile: string | null;
  onClose: () => void;
  onOpenMergeView?: () => void;
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
  llmMetadata?: {
    summary: string;
    tags: string[];
    complexity: string;
  };
}

export function CodebaseAnalysisPanel({ selectedFile, onClose, onOpenMergeView }: CodebaseAnalysisPanelProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const projectPath = searchParams.get('project') || '';

  const [activeTab, setActiveTab] = useState<'ast' | 'git' | 'ai'>('ai');
  const [gitHistory, setGitHistory] = useState<{ shadow: any[], local: any[] } | null>(null);
  const [gitLoading, setGitLoading] = useState(false);
  const [gitError, setGitError] = useState<string | null>(null);
  
  // Git Compare State
  const [selectedCommits, setSelectedCommits] = useState<{hash: string, repo: string, date: string}[]>([]);
  const [compareDiff, setCompareDiff] = useState<string | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  
  const handleCommitSelect = (hash: string, repo: string, date: string) => {
    setSelectedCommits(prev => {
      const exists = prev.find(c => c.hash === hash && c.repo === repo);
      if (exists) {
        return prev.filter(c => !(c.hash === hash && c.repo === repo));
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
        url = `/api/git-diff?filePath=${encodeURIComponent(selectedFile)}&targetHash=${selectedCommits[0].hash}&repo=${selectedCommits[0].repo}&project=${encodeURIComponent(projectPath)}`;
      } else {
        // Diff two commits. Chronological order.
        const sorted = [...selectedCommits].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        // We use the repo of the targetHash (the newer one) for context, but technically they might be in different repos.
        // Wait, if they are in different repos, git diff won't work easily unless they share history. Shadow git and local git do NOT share history! 
        // We will just assume diff works best within the same repo.
        url = `/api/git-diff?filePath=${encodeURIComponent(selectedFile)}&baseHash=${sorted[0].hash}&targetHash=${sorted[1].hash}&repo=${sorted[1].repo}&project=${encodeURIComponent(projectPath)}`;
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
        body: JSON.stringify({ filePath: selectedFile, hash, repo, project: projectPath })
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
    fetch(`/api/analyze-file?filePath=${encodeURIComponent(selectedFile)}&project=${encodeURIComponent(projectPath)}`)
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
    fetch(`/api/file-git-history?filePath=${encodeURIComponent(selectedFile)}&project=${encodeURIComponent(projectPath)}`)
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
  }, [selectedFile, projectPath]);

  if (!selectedFile) return <div className="hidden" />;

  const formatDisplayName = (name: string) => {
    let cleanName = name;
    if (cleanName.length > 20 && cleanName.includes('.')) {
      const parts = cleanName.split('.');
      let lastPart = parts[parts.length - 1];
      if (lastPart.startsWith('__') && lastPart.endsWith('__') && parts.length > 1) {
        lastPart = parts[parts.length - 2];
      }
      cleanName = lastPart;
    }
    return cleanName.split(/[/\\]/).pop() || cleanName;
  };

  return (
    <div className="w-[450px] h-full bg-surface border-l border-border-default p-4 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)] animate-slide-in">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <h3 className="text-lg font-medium text-text-primary">File Inspector</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
          ✕
        </button>
      </div>
      
      <div className="text-[11px] font-mono text-accent-purple bg-accent-purple/10 border border-accent-purple/30 p-2 rounded mb-4 break-all shrink-0">
        {formatDisplayName(selectedFile)}
      </div>

      <div className="flex gap-4 border-b border-white/10 mb-4 shrink-0 px-2 pb-0">
        <button 
          onClick={() => setActiveTab('ai')}
          className={`pb-2 px-4 text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === 'ai' ? 'text-accent-teal border-b-2 border-accent-teal' : 'text-text-muted hover:text-text-primary'}`}
        >
          信息
        </button>
        <button 
          onClick={() => setActiveTab('git')}
          className={`pb-2 px-4 text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === 'git' ? 'text-accent-teal border-b-2 border-accent-teal' : 'text-text-muted hover:text-text-primary'}`}
        >
          文件
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {/* INFO TAB CONTENT */}
        {activeTab === 'ai' && (
          <div className="space-y-6 pb-6 pr-2 relative">
            {loading && !data && (
              <div className="text-sm text-text-muted animate-pulse py-4 text-center">
                Querying Knowledge Graph...
              </div>
            )}
            
            {loading && data && (
               <div className="absolute inset-0 bg-surface/50 backdrop-blur-[2px] z-10 flex items-center justify-center">
                 <div className="px-4 py-2 bg-elevated border border-border-default rounded-full text-xs text-text-primary animate-pulse shadow-lg">
                   Loading new file...
                 </div>
               </div>
            )}

            {error && (
              <div className="text-sm text-red-400 p-3 bg-red-900/20 border border-red-900/50 rounded">
                {error}
              </div>
            )}

            {!error && data && (
              <div className={`space-y-6 transition-opacity duration-200 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                
                {/* Title */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-blue-400 border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 rounded uppercase">FILE</span>
                    {data.llmMetadata?.complexity && (
                      <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${
                        data.llmMetadata.complexity === 'complex' ? 'bg-[#c97070]/10 text-[#c97070] border-[#c97070]/30' :
                        data.llmMetadata.complexity === 'moderate' ? 'bg-accent-dim/10 text-accent-dim border-accent-dim/30' :
                        'bg-green-500/10 text-green-400 border-green-500/30'
                      }`}>
                        {data.llmMetadata.complexity}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold text-white font-serif tracking-wide" title={data.file || selectedFile}>
                    {formatDisplayName(data.file || selectedFile)}
                  </h2>
                  <button className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-text-muted transition-colors">
                    聚焦
                  </button>
                </div>

                {/* Summary */}
                {data.llmMetadata?.summary && (
                  <p className="text-[13px] text-text-secondary leading-relaxed">
                    {data.llmMetadata.summary}
                  </p>
                )}

                {/* File Path Block */}
                <div className="bg-elevated border border-white/10 rounded-lg p-3 flex justify-between items-center">
                  <div className="overflow-hidden pr-2">
                    <div className="text-[10px] text-text-muted mb-1">文件</div>
                    <div className="text-[11px] text-text-secondary truncate" title={data.file || selectedFile}>{data.file || selectedFile}</div>
                  </div>
                  <button className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-text-muted transition-colors whitespace-nowrap">
                    打开代码
                  </button>
                </div>

                {/* Tags */}
                <div>
                  <h4 className="text-[11px] font-bold text-accent-orange mb-2">标签</h4>
                  {data.llmMetadata?.tags && data.llmMetadata.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {data.llmMetadata.tags.map((tag: string, idx: number) => (
                        <span key={idx} className="text-[11px] px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-text-secondary">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-text-muted italic">暂无标签</div>
                  )}
                </div>

                {/* Defined in this file */}
                <div>
                  <h4 className="text-[11px] font-bold text-white mb-2 flex items-center gap-2">
                    在此文件中定义 ({data.nodes?.length || 0})
                  </h4>
                  {data.nodes && data.nodes.length > 0 ? (
                    <div className="space-y-2">
                      {data.nodes.slice(0, 10).map((node: any) => (
                        <div key={node.id} className="bg-elevated border border-white/10 rounded-lg p-2.5 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                                node.kind === 'function' || node.kind === 'method' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                                node.kind === 'class' || node.kind === 'interface' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                                'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              }`}>
                                {node.kind}
                              </span>
                              <span className="text-sm font-semibold text-white truncate" title={node.name}>{node.name}</span>
                            </div>
                          </div>
                          {node.docstring && (
                            <div className="text-[11px] text-text-muted truncate">{node.docstring.split('\\n')[0]}</div>
                          )}
                        </div>
                      ))}
                      {data.nodes.length > 10 && (
                        <div className="text-[10px] text-text-muted text-center pt-1">+ {data.nodes.length - 10} more</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-text-muted italic">暂无符号</div>
                  )}
                </div>

                {/* Connections */}
                <div>
                  <h4 className="text-[11px] font-bold text-white mb-2">
                    连接 ({(data.incomingEdges?.length || 0) + (data.outgoingEdges?.length || 0)})
                  </h4>
                  {(data.incomingEdges?.length > 0 || data.outgoingEdges?.length > 0) ? (
                    <div className="space-y-2">
                      {data.incomingEdges?.slice(0, 5).map((edge: any, i: number) => {
                        const kindMap: Record<string, string> = {
                          'calls': '被调用',
                          'imports': '被导入',
                          'contains': '属于',
                          'implements': '被实现',
                          'instantiates': '被实例化'
                        };
                        const label = kindMap[edge.kind?.toLowerCase()] || `被 ${edge.kind}`;
                        return (
                          <div key={'in'+i} className="bg-elevated border border-white/10 rounded-lg p-2.5 flex items-center gap-2 text-[11px]">
                            <span className="text-text-muted shrink-0">←</span>
                            <span className="text-text-muted shrink-0">{label}</span>
                            <span className="font-semibold text-text-primary truncate" title={edge.source_name || edge.source}>{edge.source_name || edge.source.split(/[./\\]/).pop()}</span>
                          </div>
                        );
                      })}
                      {data.outgoingEdges?.slice(0, 5).map((edge: any, i: number) => {
                        const kindMap: Record<string, string> = {
                          'calls': '调用',
                          'imports': '导入',
                          'contains': '包含',
                          'implements': '实现',
                          'instantiates': '实例化'
                        };
                        const label = kindMap[edge.kind?.toLowerCase()] || edge.kind;
                        return (
                          <div key={'out'+i} className="bg-elevated border border-white/10 rounded-lg p-2.5 flex items-center gap-2 text-[11px]">
                            <span className="text-text-muted shrink-0">→</span>
                            <span className="text-text-muted shrink-0">{label}</span>
                            <span className="font-semibold text-text-primary truncate" title={edge.target_name || edge.target}>{edge.target_name || edge.target.split(/[./\\]/).pop()}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-text-muted italic">暂无连接</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* GIT HISTORY TAB CONTENT */}
        {activeTab === 'git' && (
          <div className="space-y-6 pb-6">
            <div className="flex justify-end pt-2 pr-2">
              <button 
                onClick={onOpenMergeView}
                className="px-3 py-1.5 bg-accent-teal/20 text-accent-teal hover:bg-accent-teal/30 rounded text-xs font-semibold transition-colors flex items-center gap-2"
                title="Open fullscreen 3-Way Merge View"
              >
                Open Full Merge View ↗
              </button>
            </div>

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
