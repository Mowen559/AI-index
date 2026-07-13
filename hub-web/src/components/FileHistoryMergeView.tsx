"use client";

import React, { useState, useEffect } from 'react';
import { GitBranch, GitCommit, Settings2, Download, ArrowLeft, ArrowRight, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { FileDiffViewer } from './FileDiffViewer';

interface FileHistoryMergeViewProps {
  selectedFile: string;
  onClose: () => void;
}

export function FileHistoryMergeView({ selectedFile, onClose }: FileHistoryMergeViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const projectPath = searchParams.get('project') || '';

  const [shadowHistory, setShadowHistory] = useState<any[]>([]);
  const [localHistory, setLocalHistory] = useState<any[]>([]);
  
  const [selectedShadowHash, setSelectedShadowHash] = useState<string>('');
  const [selectedLocalHash, setSelectedLocalHash] = useState<string>('');
  
  const [showRightPanel, setShowRightPanel] = useState(true);
  
  const [middleContent, setMiddleContent] = useState<string>('');
  const [shadowDiff, setShadowDiff] = useState<string | null>(null);
  const [localDiff, setLocalDiff] = useState<string | null>(null);

  const [applying, setApplying] = useState(false);

  // Fetch initial history lists and current file content
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      fetch(`/api/file-git-history?filePath=${encodeURIComponent(selectedFile)}&project=${encodeURIComponent(projectPath)}`).then(res => res.json()),
      fetch(`/api/file-content?filePath=${encodeURIComponent(selectedFile)}&project=${encodeURIComponent(projectPath)}`).then(res => res.json())
    ])
    .then(([historyData, contentData]) => {
      if (!isMounted) return;
      
      if (historyData.error) throw new Error(historyData.error);
      if (contentData.error) throw new Error(contentData.error);

      setShadowHistory(historyData.shadow || []);
      setLocalHistory(historyData.local || []);
      setMiddleContent(contentData.content || '');

      if (historyData.shadow?.length > 0) {
        setSelectedShadowHash(historyData.shadow[0].hash);
      }
      if (historyData.local?.length > 0) {
        setSelectedLocalHash(historyData.local[0].hash);
      }
    })
    .catch(err => {
      if (isMounted) setError(err.message);
    })
    .finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, [selectedFile, projectPath]);

  // Fetch shadow diff
  useEffect(() => {
    if (!selectedShadowHash) {
      setShadowDiff(null);
      return;
    }
    fetch(`/api/git-diff?filePath=${encodeURIComponent(selectedFile)}&targetHash=${selectedShadowHash}&repo=shadow&project=${encodeURIComponent(projectPath)}`)
      .then(res => res.json())
      .then(data => setShadowDiff(data.diff || 'No differences'))
      .catch(() => setShadowDiff('Error fetching diff'));
  }, [selectedShadowHash, selectedFile, middleContent, projectPath]); // re-fetch if middleContent changes!

  // Fetch local diff
  useEffect(() => {
    if (!selectedLocalHash) {
      setLocalDiff(null);
      return;
    }
    fetch(`/api/git-diff?filePath=${encodeURIComponent(selectedFile)}&targetHash=${selectedLocalHash}&repo=local&project=${encodeURIComponent(projectPath)}`)
      .then(res => res.json())
      .then(data => setLocalDiff(data.diff || 'No differences'))
      .catch(() => setLocalDiff('Error fetching diff'));
  }, [selectedLocalHash, selectedFile, middleContent, showRightPanel, projectPath]);

  const handleApplyDiff = async (diffContent: string | null) => {
    if (!diffContent || diffContent === 'No differences' || diffContent.startsWith('Error')) return;
    
    if (!confirm('Are you sure you want to apply these changes to the local file?')) return;

    setApplying(true);
    try {
      const res = await fetch('/api/apply-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patchContent: diffContent, project: projectPath })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Refresh file content (this will also trigger diff re-fetching)
      const contentRes = await fetch(`/api/file-content?filePath=${encodeURIComponent(selectedFile)}&project=${encodeURIComponent(projectPath)}`);
      const contentData = await contentRes.json();
      setMiddleContent(contentData.content || '');
      
      alert('Changes applied successfully!');
    } catch (e: any) {
      alert('Failed to apply changes: ' + e.message);
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-void text-text-muted">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <div>Initializing 3-Way Merge Environment...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-void">
        <div className="text-red-400 p-4 border border-red-900/50 bg-red-900/20 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-void overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-14 border-b border-border-default bg-surface/50 backdrop-blur-md flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="font-mono text-sm text-text-primary">
            {selectedFile.split('/').pop()}
          </div>
          <div className="text-xs text-text-muted truncate max-w-md">
            {selectedFile}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowRightPanel(!showRightPanel)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors ${showRightPanel ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'bg-surface hover:bg-white/10 text-text-secondary'}`}
          >
            {showRightPanel ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {showRightPanel ? 'Hide Formal Git' : 'Show Formal Git'}
          </button>
        </div>
      </div>

      {/* 3-Way Grid */}
      <div className={`flex-1 flex overflow-hidden`}>
        
        {/* Left: Shadow Git */}
        <div className={`flex flex-col border-r border-border-default h-full transition-all duration-300 ${showRightPanel ? 'w-1/3' : 'w-1/2'}`}>
          <div className="h-12 border-b border-border-subtle bg-surface/30 flex items-center justify-between px-3 shrink-0">
            <div className="flex items-center gap-2 text-accent-purple font-semibold text-xs uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-accent-purple animate-pulse"></span>
              Shadow Git
            </div>
            <select 
              value={selectedShadowHash}
              onChange={e => setSelectedShadowHash(e.target.value)}
              className="bg-background border border-border-default rounded px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-purple max-w-[150px] font-mono"
            >
              {shadowHistory.map(c => (
                <option key={c.hash} value={c.hash}>{c.hash.substring(0,7)} - {c.message}</option>
              ))}
            </select>
          </div>
          
          <div className="p-2 border-b border-border-subtle bg-accent-purple/5 flex justify-between items-center shrink-0">
             <span className="text-xs text-text-muted">Diff against Local</span>
             <button 
                onClick={() => handleApplyDiff(shadowDiff)}
                disabled={applying || !shadowDiff || shadowDiff === 'No differences'}
                className="flex items-center gap-1 px-2 py-1 bg-accent-purple/20 text-accent-purple hover:bg-accent-purple/30 rounded text-[10px] disabled:opacity-50 transition-colors"
              >
                <ArrowRight className="w-3 h-3" /> Apply to Local
             </button>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar bg-[#0a0a0a]">
            {shadowDiff ? (
              <FileDiffViewer diff={shadowDiff} />
            ) : (
              <div className="text-center p-4 text-xs text-text-muted animate-pulse">Computing Diff...</div>
            )}
          </div>
        </div>

        {/* Middle: Local File */}
        <div className={`flex flex-col h-full transition-all duration-300 ${showRightPanel ? 'w-1/3' : 'w-1/2'}`}>
          <div className="h-12 border-b border-border-subtle bg-surface/30 flex items-center justify-between px-3 shrink-0">
            <div className="flex items-center gap-2 text-accent-teal font-semibold text-xs uppercase tracking-wider">
              <Settings2 className="w-3.5 h-3.5" />
              Local Workspace
            </div>
            <span className="text-[10px] text-text-muted bg-surface px-2 py-0.5 rounded border border-border-default">Editable (Preview)</span>
          </div>
          
          <div className="flex-1 overflow-auto custom-scrollbar bg-deep relative">
            <pre className="p-4 text-xs font-mono text-text-primary leading-relaxed whitespace-pre-wrap">
              {middleContent}
            </pre>
          </div>
        </div>

        {/* Right: Formal Git */}
        {showRightPanel && (
          <div className="w-1/3 flex flex-col border-l border-border-default h-full bg-surface/10 animate-fade-in shrink-0">
            <div className="h-12 border-b border-border-subtle bg-surface/30 flex items-center justify-between px-3 shrink-0">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
                <GitCommit className="w-3.5 h-3.5" />
                Formal Git
              </div>
              <select 
                value={selectedLocalHash}
                onChange={e => setSelectedLocalHash(e.target.value)}
                className="bg-background border border-border-default rounded px-2 py-1 text-xs text-text-primary outline-none focus:border-primary max-w-[150px] font-mono"
              >
                {localHistory.map(c => (
                  <option key={c.hash} value={c.hash}>{c.hash.substring(0,7)} - {c.message}</option>
                ))}
              </select>
            </div>

            <div className="p-2 border-b border-border-subtle bg-primary/5 flex justify-between items-center shrink-0">
               <button 
                  onClick={() => handleApplyDiff(localDiff)}
                  disabled={applying || !localDiff || localDiff === 'No differences'}
                  className="flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary hover:bg-primary/30 rounded text-[10px] disabled:opacity-50 transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" /> Apply to Local
               </button>
               <span className="text-xs text-text-muted">Diff against Local</span>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar bg-[#0a0a0a]">
              {localDiff ? (
                <FileDiffViewer diff={localDiff} />
              ) : (
                <div className="text-center p-4 text-xs text-text-muted animate-pulse">Computing Diff...</div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
