import React, { useState, useEffect } from 'react';
import { Folder, FolderOpen, File as FileIcon, FileCode, FileText, History, Search, ChevronRight, ChevronDown, Clock } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  language?: string;
}

interface FileExplorerSidebarProps {
  onFileSelect: (filePath: string) => void;
  history: string[];
  selectedFile: string | null;
}

function getFileIcon(filename: string) {
  if (filename.endsWith('.ts') || filename.endsWith('.tsx') || filename.endsWith('.js') || filename.endsWith('.jsx')) {
    return <FileCode size={14} className="text-yellow-500" />;
  }
  if (filename.endsWith('.json') || filename.endsWith('.md')) {
    return <FileText size={14} className="text-green-500" />;
  }
  return <FileIcon size={14} className="text-text-muted" />;
}

function TreeNode({ node, level, onSelect, selectedPath }: { node: FileNode; level: number; onSelect: (path: string) => void; selectedPath: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const isSelected = selectedPath === node.path;
  
  // Auto-expand if a selected file is within this directory
  useEffect(() => {
    if (selectedPath && selectedPath.startsWith(node.path + '/') && node.type === 'directory') {
      setIsOpen(true);
    }
  }, [selectedPath, node.path, node.type]);

  if (node.type === 'directory') {
    return (
      <div>
        <div 
          className="flex items-center gap-1.5 py-1 px-2 hover:bg-surface/50 cursor-pointer text-text-secondary hover:text-text-primary rounded select-none group"
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <ChevronDown size={14} className="opacity-50 group-hover:opacity-100" /> : <ChevronRight size={14} className="opacity-50 group-hover:opacity-100" />}
          {isOpen ? <FolderOpen size={14} className="text-primary" /> : <Folder size={14} className="text-primary/70" />}
          <span className="text-sm truncate">{node.name}</span>
        </div>
        {isOpen && node.children && (
          <div>
            {node.children.map((child, idx) => (
              <TreeNode key={idx} node={child} level={level + 1} onSelect={onSelect} selectedPath={selectedPath} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`flex items-center gap-2 py-1 px-2 cursor-pointer text-sm rounded select-none ${isSelected ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-surface/50 text-text-secondary hover:text-text-primary'}`}
      style={{ paddingLeft: `${level * 12 + 28}px` }}
      onClick={() => onSelect(node.path)}
      title={node.path}
    >
      {getFileIcon(node.name)}
      <span className="truncate">{node.name}</span>
    </div>
  );
}

export function FileExplorerSidebar({ onFileSelect, history, selectedFile }: FileExplorerSidebarProps) {
  const [treeData, setTreeData] = useState<FileNode[]>([]);
  const searchParams = useSearchParams();
  const projectPath = searchParams.get('project') || '';
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch(`/api/files?project=${encodeURIComponent(projectPath)}`);
        const data = await res.json();
        if (data.tree) {
          setTreeData(data.tree);
        }
      } catch (err) {
        console.error("Failed to fetch file tree", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, [projectPath]);

  return (
    <div className="w-64 h-full bg-surface/80 backdrop-blur-md border-r border-border-default flex flex-col z-30">
      <div className="flex border-b border-border-subtle">
        <div className="flex-1 py-3 text-xs font-medium flex items-center justify-center gap-1.5 text-primary border-b-2 border-primary">
          <Folder size={14} /> Explorer
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search files..." 
              className="w-full bg-deep border border-border-subtle rounded-md py-1.5 pl-8 pr-3 text-xs text-text-primary focus:outline-none focus:border-primary/50"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-1 pb-20 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-20 text-xs text-text-muted animate-pulse">Loading workspace...</div>
          ) : treeData.length === 0 ? (
            <div className="flex flex-col items-center p-4 text-center text-xs text-text-muted mt-10">
              <span className="mb-4">No workspace loaded</span>
              <button
                onClick={() => {
                  localStorage.removeItem('recentProject');
                  window.location.href = '/';
                }}
                className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-md transition-colors cursor-pointer"
              >
                Select Project
              </button>
            </div>
          ) : (
            treeData.map((node, idx) => (
              <TreeNode key={idx} node={node} level={0} onSelect={onFileSelect} selectedPath={selectedFile} />
            ))
          )}
        </div>
        {treeData.length > 0 && (
          <div className="p-3 border-t border-border-subtle bg-surface/50">
            <button
              onClick={() => {
                localStorage.removeItem('recentProject');
                window.location.href = '/';
              }}
              className="w-full py-2 text-xs font-medium text-text-secondary hover:text-primary hover:bg-primary/10 border border-border-subtle hover:border-primary/30 rounded transition-colors"
            >
              Change Project...
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
