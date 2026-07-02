"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface UnifiedKnowledgeGraphProps {
  onNodeClick?: (filePath: string, nodeType: string) => void;
  selectedFile?: string | null;
}

// ... rest of the file ...

export function UnifiedKnowledgeGraph({ onNodeClick, selectedFile }: UnifiedKnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState("Initializing Neural Graph...");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ nodesCount: number; edgesCount: number } | null>(null);
  const graphRef = useRef<any>(null); // To store the graph instance

  // Effect to handle highlighting selected node when it changes externally
  useEffect(() => {
    if (graphRef.current && selectedFile) {
      // Find node by id (accounting for potential 'file:' prefix)
      const graphData = graphRef.current.graphData();
      const targetNode = graphData.nodes.find((n: any) => n.id === selectedFile || n.id === `file:${selectedFile}`);
      
      if (targetNode) {
        // Move camera to node
        graphRef.current.centerAt(targetNode.x, targetNode.y, 1000);
        graphRef.current.zoom(8, 2000);
        
        // We could also dynamically change the node color here if force-graph supports it easily,
        // but typically it requires a re-eval of nodeColor which is bound to the property.
      }
    }
  }, [selectedFile]);

  useEffect(() => {
    let isMounted = true;
    
    // Function to initialize graph once data and script are ready
    const initGraph = (data: any) => {
      if (!containerRef.current || !window.ForceGraph) return;
      
      setStats(data.stats);
      if (isMounted) setLoadingText("Rendering Topology...");

      // A simple color palette for groups
      const colors = ['#8A2BE2', '#00c853', '#38bdf8', '#d4a574', '#ef4444', '#f59e0b', '#8b5cf6'];
      
      const getGroupColor = (group: string, id: string) => {
        // Highlight if selected
        const cleanId = id.startsWith('file:') ? id.substring(5) : id;
        if (selectedFile === cleanId) return '#ffffff'; // White for selected
        
        // Hash group name to pick a color
        let hash = 0;
        for (let i = 0; i < group.length; i++) {
          hash = group.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
      };

      graphRef.current = window.ForceGraph()(containerRef.current)
        .graphData(data)
        .nodeColor((node: any) => getGroupColor(node.group, node.id))
        .nodeRelSize(3)
        .nodeVal((node: any) => node.val)
        .nodeLabel('name')
        .linkColor(() => 'rgba(138, 43, 226, 0.2)') // Subtle purple connections
        .linkWidth(0.5)
        .linkDirectionalParticles(2)
        .linkDirectionalParticleWidth(1.5)
        .linkDirectionalParticleSpeed(0.01)
        .backgroundColor('transparent')
        .onNodeClick((node: any) => {
          // Notify parent (which opens the right panel)
          if (onNodeClick) {
            const cleanPath = node.id.startsWith('file:') ? node.id.substring(5) : node.id;
            onNodeClick(cleanPath, "file");
          }
        });
        
      // Ensure it fits the container nicely
      if (graphRef.current && containerRef.current) {
        graphRef.current.width(containerRef.current.clientWidth);
        graphRef.current.height(containerRef.current.clientHeight);
      }
      
      if (isMounted) setLoading(false);
    };

    // Load data
    const loadData = async () => {
      try {
        if (isMounted) setLoadingText("Fetching Abstract Syntax Tree...");
        const res = await fetch('/api/project-graph');
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        if (isMounted) setLoadingText("Processing Nodes & Edges...");
        const data = await res.json();
        
        if (data.error) throw new Error(data.error);
        
        return data;
      } catch (e: any) {
        console.error("Failed to load graph data", e);
        if (isMounted) {
          setError(e.message);
          setLoading(false);
        }
        return null;
      }
    };

    // Main execution
    const run = async () => {
      const data = await loadData();
      if (!data || !isMounted) return;

      // Load ForceGraph script if not loaded
      if (!window.ForceGraph) {
        if (isMounted) setLoadingText("Downloading Physics Engine...");
        const script = document.createElement('script');
        // Use jsdelivr which is generally more stable than unpkg
        script.src = 'https://cdn.jsdelivr.net/npm/force-graph@1.43.5/dist/force-graph.min.js';
        script.onload = () => {
          if (isMounted) initGraph(data);
        };
        document.head.appendChild(script);
      } else {
        initGraph(data);
      }
    };

    run();

    // Handle resize
    const handleResize = () => {
      if (graphRef.current && containerRef.current) {
        graphRef.current.width(containerRef.current.clientWidth);
        graphRef.current.height(containerRef.current.clientHeight);
      }
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      if (graphRef.current) {
        try {
          graphRef.current._destructor();
        } catch (e) {}
      }
    };
  }, []); // Remove onNodeClick from dependency array to prevent re-initialization

  // Force a re-color when selectedFile changes
  useEffect(() => {
    if (graphRef.current) {
      // Trigger a re-evaluation of node colors
      graphRef.current.nodeColor(graphRef.current.nodeColor());
    }
  }, [selectedFile]);

  return (
    <div className="relative w-full h-full flex flex-col bg-void overflow-hidden">
      {/* Background breathing circle */}
      <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
        <div className="w-full h-full border-[1px] border-border-glow rounded-full animate-breathe" style={{ maxWidth: '80%', maxHeight: '80%' }}></div>
      </div>
      
      {/* Header Info */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <h2 className="text-2xl font-semibold text-text-primary drop-shadow-md">Understand-Anything Engine</h2>
        <p className="text-text-secondary text-sm mt-1">Project Knowledge Graph</p>
        
        {stats && !loading && (
          <div className="mt-4 flex gap-4 text-xs font-mono text-text-muted animate-fade-in">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              {stats.nodesCount} Files
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-border-glow"></span>
              {stats.edgesCount} Connections
            </div>
          </div>
        )}
      </div>

      {/* Loading Overlay (must be OUTSIDE containerRef to avoid ForceGraph conflicts) */}
      <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-void/80 backdrop-blur-sm transition-opacity duration-300 pointer-events-none ${loading && !error ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <div className="flex flex-col items-center">
            <span className="text-text-primary font-medium text-lg">Warping into Codebase</span>
            <span className="text-primary font-mono text-sm mt-2 max-w-[250px] text-center">{loadingText}</span>
          </div>
        </div>
      </div>

      {/* Graph Container */}
      <div ref={containerRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing">
        {error && (
          <div className="w-full h-full flex flex-col items-center justify-center absolute inset-0 z-20 bg-void">
            <div className="text-error mb-2 text-xl font-bold">Failed to load graph</div>
            <div className="text-text-muted text-sm font-mono max-w-md text-center bg-surface/50 p-4 rounded border border-border-subtle">{error}</div>
          </div>
        )}
      </div>
    </div>
  );
}
