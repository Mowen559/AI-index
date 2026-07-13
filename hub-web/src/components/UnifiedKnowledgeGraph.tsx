"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Loader2, Maximize, Layers, SlidersHorizontal } from "lucide-react";
import dynamic from 'next/dynamic';

// Dynamically import 3D Force Graph to avoid SSR issues
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

interface UnifiedKnowledgeGraphProps {
  onNodeClick?: (filePath: string, nodeType: string) => void;
  selectedFile?: string | null;
}

export function UnifiedKnowledgeGraph({ onNodeClick, selectedFile }: UnifiedKnowledgeGraphProps) {
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState("Initializing Neural Graph...");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ nodesCount: number; edgesCount: number } | null>(null);
  
  // Graph controls
  const [limit, setLimit] = useState(400);
  const [activeTypes, setActiveTypes] = useState<Record<string, boolean>>({
    file: true,
    class: true,
    function: true,
    method: false,
    interface: true,
    type: false,
    variable: false,
    module: false
  });
  const [showControls, setShowControls] = useState(false);

  const [rawGraphData, setRawGraphData] = useState<{nodes: any[], links: any[]} | null>(null);
  const [focusedNode, setFocusedNode] = useState<string | null>(null);
  const graphRef = useRef<any>(null);

  // Colors
  const colors = ['#8A2BE2', '#00c853', '#38bdf8', '#d4a574', '#ef4444', '#f59e0b', '#8b5cf6'];
  const getGroupColor = useCallback((group: string, id: string) => {
    const cleanId = id.startsWith('file:') ? id.substring(5) : id;
    if (selectedFile === cleanId) return '#ffffff'; // White for selected
    let hash = 0;
    for (let i = 0; i < group.length; i++) {
      hash = group.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }, [selectedFile]);

  const initializedTypes = useRef(false);

  // Load data when limit or activeTypes changes
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        if (isMounted) setLoadingText("Fetching Abstract Syntax Tree...");
        
        const typesParam = Object.entries(activeTypes)
          .filter(([_, active]) => active)
          .map(([type]) => type)
          .join(',');
          
        const urlParams = new URLSearchParams(window.location.search);
        const projectPath = urlParams.get('project') || '';
        const res = await fetch(`/api/project-graph?limit=${limit}&types=${typesParam}&project=${encodeURIComponent(projectPath)}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        if (isMounted) setLoadingText("Processing Nodes & Edges...");
        const data = await res.json();
        
        if (data.error) throw new Error(data.error);
        
        if (isMounted) {
          setStats(data.stats);
          
          // Dynamically register any DB types not currently in state
          if (data.stats?.availableTypes && !initializedTypes.current) {
             initializedTypes.current = true;
             setActiveTypes(prev => {
                const updated = { ...prev };
                let changed = false;
                data.stats.availableTypes.forEach((t: string) => {
                   if (updated[t] === undefined) {
                      // Default these important AST types to true, others to false
                      const defaultOn = ['file', 'class', 'function', 'method', 'interface', 'struct', 'module'];
                      updated[t] = defaultOn.includes(t);
                      changed = true;
                   }
                });
                return changed ? updated : prev;
             });
          }

          setRawGraphData(data);
          setLoading(false);
        }
      } catch (e: any) {
        console.error("Failed to load graph data", e);
        if (isMounted) {
          setError(e.message);
          setLoading(false);
        }
      }
    };
    
    loadData();
    return () => { isMounted = false; };
  }, [limit, activeTypes]);

  // Handle external selection
  useEffect(() => {
    if (graphRef.current && selectedFile && rawGraphData) {
      const targetNode = rawGraphData.nodes.find((n: any) => n.id === selectedFile || n.id === `file:${selectedFile}`);
      if (targetNode) {
        setFocusedNode(targetNode.id);
        const distance = 300;
        const distRatio = 1 + distance/Math.hypot(targetNode.x || 0, targetNode.y || 0, targetNode.z || 0);
        graphRef.current.cameraPosition(
          { x: targetNode.x * distRatio, y: targetNode.y * distRatio, z: targetNode.z * distRatio }, 
          targetNode, 
          2000
        );
      }
    }
  }, [selectedFile, rawGraphData]);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Cache for star materials to avoid WebGL memory leaks
  const materialsCache = useRef<Record<string, any>>({});

  // Resize Observer to adjust graph dimensions when drawer opens/closes
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute highlighted sets for focus mode instead of deleting nodes
  const { highlightNodes, highlightLinks } = useMemo(() => {
    const hNodes = new Set<string>();
    const hLinks = new Set<any>();
    
    if (focusedNode && rawGraphData) {
      hNodes.add(focusedNode);
      rawGraphData.links.forEach(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        
        if (sourceId === focusedNode || targetId === focusedNode) {
          hLinks.add(l);
          hNodes.add(sourceId);
          hNodes.add(targetId);
        }
      });
    }
    
    return { highlightNodes: hNodes, highlightLinks: hLinks };
  }, [rawGraphData, focusedNode]);

  const renderData = rawGraphData || { nodes: [], links: [] };

  // Adjust visual state when focus changes
  useEffect(() => {
    // No need to reheat physical simulation just for visual highlighting changes
  }, [focusedNode]);

  const toggleType = (type: keyof typeof activeTypes) => {
    setActiveTypes(prev => ({ ...prev, [type]: !prev[type] }));
  };

  // Custom 3D Star Sprite Generator (with caching)
  const createGlowingStar = useCallback((node: any) => {
    if (node.__threeObj) return node.__threeObj;

    const THREE = require('three');
    const color = getGroupColor(node.group, node.id);
    
    // We only need one base material per color, we will control opacity dynamically
    const cacheKey = `${color}_base`;
    
    let material = materialsCache.current[cacheKey];
    if (!material) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const context = canvas.getContext('2d');
      if (context) {
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        
        const hex2rgb = (hex: string) => {
           const v = parseInt(hex.replace('#', ''), 16);
           return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
        };
        
        let r=255, g=255, b=255;
        if (color.startsWith('#')) {
          const rgb = hex2rgb(color);
          r=rgb.r; g=rgb.g; b=rgb.b;
        }
        
        gradient.addColorStop(0, `rgba(255,255,255,0.8)`); // Bright core
        gradient.addColorStop(0.2, `rgba(255,255,255,0.4)`);
        gradient.addColorStop(0.5, `rgba(${r},${g},${b},0.3)`); // Soft halo
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`); // Fade out
        
        context.fillStyle = gradient;
        context.fillRect(0, 0, 64, 64);
      }
      
      const texture = new THREE.CanvasTexture(canvas);
      material = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: true, 
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 1 // Managed dynamically
      });
      materialsCache.current[cacheKey] = material;
    }
    
    // We MUST clone the material so we can change its opacity independently!
    // But cloning SpriteMaterial is cheap since texture is shared.
    const spriteMaterial = material.clone();
    const sprite = new THREE.Sprite(spriteMaterial);
    
    // Save original size reference
    const baseSize = node.val * 1.5 + 5;
    sprite.scale.set(baseSize, baseSize, 1);
    
    const SpriteText = require('three-spritetext').default;
    let displayName = node.name;
    if (displayName.length > 20 && displayName.includes('.')) {
      const parts = displayName.split('.');
      let lastPart = parts[parts.length - 1];
      if (lastPart.startsWith('__') && lastPart.endsWith('__') && parts.length > 1) {
        lastPart = parts[parts.length - 2];
      }
      displayName = lastPart;
    }
    displayName = displayName.split(/[/\\]/).pop() || displayName;

    const text = new SpriteText(displayName);
    text.color = 'rgba(255,255,255,0.8)';
    text.textHeight = Math.max(3, baseSize * 0.25);
    text.fontWeight = 'bold';
    text.fontFace = 'monospace';
    if (text.center) text.center.set(0, 0.5);
    text.position.x = baseSize * 0.5 + 1;
    text.position.y = 0;
    
    const group = new THREE.Group();
    group.add(sprite);
    group.add(text);
    
    // Store references for fast dynamic updates without recreation
    node.__threeObj = group;
    node.__sprite = sprite;
    node.__text = text;
    node.__baseSize = baseSize;
    
    return group;
  }, [getGroupColor]); // Dependency array minimized!

  // Update visual state of nodes without recreating them
  useEffect(() => {
    if (!rawGraphData) return;
    
    rawGraphData.nodes.forEach((node: any) => {
      if (!node.__threeObj) return;
      
      const isHighlighted = focusedNode ? highlightNodes.has(node.id) : true;
      const isFile = (node.type || '').toLowerCase() === 'file' || node.type === 'unknown';
      const isImportant = node.val >= 5.5;
      
      let size = node.__baseSize;
      if (node.id === focusedNode) {
         size = node.val * 2.5 + 10;
      } else if (focusedNode && !isHighlighted) {
         size = size * 0.5;
      }
      
      let showText = false;
      if (focusedNode) {
        if (isHighlighted) showText = true;
        else if (isFile) showText = true;
      } else {
        if (isFile && isImportant) showText = true;
      }
      
      // Mutate existing ThreeJS objects
      node.__sprite.scale.set(size, size, 1);
      node.__sprite.material.opacity = isHighlighted ? 1 : 0.2;
      
      node.__text.visible = showText;
      if (showText) {
         node.__text.color = isHighlighted ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)';
         node.__text.textHeight = Math.max(3, size * 0.25);
         node.__text.position.x = size * 0.5 + 1;
      }
    });
  }, [focusedNode, highlightNodes, rawGraphData]);

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col bg-void overflow-hidden">
      {/* Background breathing circle */}
      <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
        <div className="w-full h-full border-[1px] border-border-glow rounded-full animate-breathe" style={{ maxWidth: '80%', maxHeight: '80%' }}></div>
      </div>
      
      {/* Header Info & Controls */}
      <div className="absolute top-6 left-6 z-10">
        <h2 className="text-2xl font-semibold text-text-primary drop-shadow-md pointer-events-none">Understand-Anything Engine</h2>
        <p className="text-text-secondary text-sm mt-1 pointer-events-none">Project Knowledge Graph</p>
        
        {stats && !loading && (
          <div className="mt-4 flex gap-4 text-xs font-mono text-text-muted animate-fade-in pointer-events-none">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              {stats.nodesCount} Nodes (Files/Symbols)
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-border-glow"></span>
              {stats.edgesCount} Connections
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button 
            onClick={() => setShowControls(!showControls)}
            className="flex items-center gap-2 px-3 py-1.5 bg-surface rounded-md border border-border-subtle hover:bg-surface-hover text-text-primary text-sm transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Layer Controls
          </button>
          
          {focusedNode && (
            <button 
              onClick={() => {
                setFocusedNode(null);
                if (graphRef.current) {
                  graphRef.current.zoomToFit(1000);
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-surface rounded-md border border-border-subtle hover:bg-surface-hover text-text-primary text-sm transition-colors shadow-[0_0_10px_rgba(138,43,226,0.3)]"
            >
              <Maximize className="w-4 h-4" />
              Reset Constellation
            </button>
          )}
        </div>

        {/* Control Panel */}
        {showControls && (
          <div className="mt-2 p-5 bg-surface-hover/95 backdrop-blur-md border border-border-subtle rounded-xl shadow-2xl w-72 animate-fade-in z-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Node Filters
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setActiveTypes(prev => {
                    const next = { ...prev };
                    Object.keys(next).forEach(k => next[k] = true);
                    return next;
                  })}
                  className="text-[10px] uppercase font-bold text-primary hover:text-primary-hover transition-colors"
                >
                  All
                </button>
                <span className="text-text-muted">|</span>
                <button 
                  onClick={() => setActiveTypes(prev => {
                    const next = { ...prev };
                    Object.keys(next).forEach(k => next[k] = false);
                    return next;
                  })}
                  className="text-[10px] uppercase font-bold text-text-muted hover:text-text-primary transition-colors"
                >
                  None
                </button>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-6">
              {Object.entries(activeTypes).map(([type, isActive]) => (
                <button
                  key={type}
                  onClick={() => toggleType(type as any)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-200 capitalize flex items-center gap-1.5 ${
                    isActive 
                      ? 'bg-primary/20 border-primary/50 text-primary shadow-[0_0_10px_rgba(138,43,226,0.2)]' 
                      : 'bg-surface border-border-subtle text-text-muted hover:text-text-primary hover:border-border-default hover:bg-surface-hover'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-primary shadow-[0_0_5px_rgba(138,43,226,0.8)]' : 'bg-border-subtle'}`}></div>
                  {type}
                </button>
              ))}
            </div>

            <div className="border-t border-border-subtle pt-4">
              <label className="flex flex-col gap-2">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Density Limit</span>
                  <span className="text-sm font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{limit}</span>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="5000" 
                  step="50"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                  className="w-full accent-primary h-1.5 bg-border-subtle rounded-lg appearance-none cursor-pointer"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-void/80 backdrop-blur-sm transition-opacity duration-300 pointer-events-none ${loading && !error ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <div className="flex flex-col items-center">
            <span className="text-text-primary font-medium text-lg">Warping into Codebase</span>
            <span className="text-primary font-mono text-sm mt-2 max-w-[250px] text-center">{loadingText}</span>
          </div>
        </div>
      </div>

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-void">
          <div className="text-error mb-2 text-xl font-bold">Failed to load graph</div>
          <div className="text-text-muted text-sm font-mono max-w-md text-center bg-surface/50 p-4 rounded border border-border-subtle">{error}</div>
        </div>
      )}

      {/* Graph Container */}
      <div className="flex-1 w-full h-full cursor-grab active:cursor-grabbing">
        {!loading && renderData.nodes.length > 0 && (
          <ForceGraph3D
            ref={graphRef}
            width={dimensions.width || undefined}
            height={dimensions.height || undefined}
            graphData={renderData}
            nodeLabel="name"
            nodeThreeObject={createGlowingStar}
            nodeRelSize={4}
            nodeVal={(node: any) => node.val}
            linkColor={(link: any) => {
              const isHighlighted = focusedNode ? highlightLinks.has(link) : true;
              if (focusedNode && !isHighlighted) return 'rgba(255,255,255,0.02)';
              
              const sourceNode = typeof link.source === 'object' ? link.source : rawGraphData?.nodes.find((n: any) => n.id === link.source);
              if (sourceNode) {
                const hexColor = getGroupColor(sourceNode.group, sourceNode.id);
                const v = parseInt(hexColor.replace('#', ''), 16);
                const opacity = focusedNode ? 0.8 : 0.4;
                return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${opacity})`;
              }
              
              return focusedNode ? 'rgba(255,255,255,0.4)' : 'rgba(138,43,226,0.4)';
            }}
            linkWidth={(link: any) => {
               if (!focusedNode) return 0.5;
               return highlightLinks.has(link) ? 1.5 : 0.05;
            }}
            linkDirectionalParticles={(link: any) => {
               if (!focusedNode) return 1;
               return highlightLinks.has(link) ? 3 : 0;
            }}
            linkDirectionalParticleWidth={1.5}
            linkDirectionalParticleSpeed={0.01}
            backgroundColor="rgba(0,0,0,0)"
            onNodeClick={(node: any) => {
              setFocusedNode(node.id);
              // Camera move to node
              const distance = 250;
              const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
              graphRef.current?.cameraPosition(
                { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, 
                node, 
                1500
              );
              
              if (onNodeClick) {
                // Use filePath from backend if available (for symbols), otherwise fallback to id
                const path = node.filePath || (node.id.startsWith('file:') ? node.id.substring(5) : node.id);
                // We pass "file" if we successfully resolved a file path, so the right panel opens for symbols too!
                const effectiveType = node.filePath ? "file" : (node.type || "file");
                onNodeClick(path, effectiveType);
                
                // --- DYNAMIC EXPANSION ---
                if (path) {
                  const urlParams = new URLSearchParams(window.location.search);
                  const projectPath = urlParams.get('project') || '';
                  fetch(`/api/analyze-file?filePath=${encodeURIComponent(path)}&project=${encodeURIComponent(projectPath)}`)
                    .then(res => res.json())
                    .then(data => {
                      if (!data.incomingEdges && !data.outgoingEdges) return;
                      setRawGraphData((prev: any) => {
                        if (!prev) return prev;
                        const newNodes = [...prev.nodes];
                        const newLinks = [...prev.links];
                        const existingNodeIds = new Set(newNodes.map((n: any) => n.id));
                        const existingLinkIds = new Set(newLinks.map((l: any) => {
                          const src = typeof l.source === 'object' ? l.source.id : l.source;
                          const tgt = typeof l.target === 'object' ? l.target.id : l.target;
                          return `${src}-${tgt}-${l.label}`;
                        }));
                        
                        let changed = false;
                        
                        const processEdges = (edges: any[]) => {
                          edges?.forEach((edge: any) => {
                            // Add missing source node
                            if (!existingNodeIds.has(edge.source)) {
                              newNodes.push({
                                id: edge.source,
                                name: edge.source_name || edge.source,
                                type: edge.source_kind || 'unknown',
                                group: edge.source_file || 'unknown',
                                val: edge.source_kind === 'file' ? 10 : 4,
                                filePath: edge.source_file,
                                x: node.x + (Math.random() - 0.5) * 50,
                                y: node.y + (Math.random() - 0.5) * 50,
                                z: node.z + (Math.random() - 0.5) * 50
                              });
                              existingNodeIds.add(edge.source);
                              changed = true;
                            }
                            // Add missing target node
                            if (!existingNodeIds.has(edge.target)) {
                              newNodes.push({
                                id: edge.target,
                                name: edge.target_name || edge.target,
                                type: edge.target_kind || 'unknown',
                                group: edge.target_file || 'unknown',
                                val: edge.target_kind === 'file' ? 10 : 4,
                                filePath: edge.target_file,
                                x: node.x + (Math.random() - 0.5) * 50,
                                y: node.y + (Math.random() - 0.5) * 50,
                                z: node.z + (Math.random() - 0.5) * 50
                              });
                              existingNodeIds.add(edge.target);
                              changed = true;
                            }
                            // Add missing link
                            const linkId = `${edge.source}-${edge.target}-${edge.kind}`;
                            if (!existingLinkIds.has(linkId)) {
                              newLinks.push({
                                source: edge.source,
                                target: edge.target,
                                label: edge.kind
                              });
                              existingLinkIds.add(linkId);
                              changed = true;
                            }
                          });
                        };

                        processEdges(data.incomingEdges);
                        processEdges(data.outgoingEdges);

                        if (changed) {
                          // Update physics engine implicitly by providing a new object reference
                          return { nodes: newNodes, links: newLinks, stats: prev.stats };
                        }
                        return prev;
                      });
                    })
                    .catch(console.error);
                }
              }
            }}
            linkThreeObjectExtend={true}
            linkThreeObject={(link: any) => {
              if (!focusedNode) return null; // Only show text in focus mode
              if (!highlightLinks.has(link)) return null; // Don't show text for dimmed links
              
              const SpriteText = require('three-spritetext').default;
              
              let labelText = link.label;
              const isSource = link.source.id === focusedNode || link.source === focusedNode;
              const isTarget = link.target.id === focusedNode || link.target === focusedNode;
              
              const kindMap: Record<string, {out: string, in: string}> = {
                'calls': { out: '调用 →', in: '← 被调用' },
                'imports': { out: '导入 →', in: '← 被导入' },
                'contains': { out: '包含 →', in: '← 属于' },
                'implements': { out: '实现 →', in: '← 被实现' },
                'instantiates': { out: '实例化 →', in: '← 被实例化' }
              };

              const trans = kindMap[link.label];
              if (trans) {
                if (isSource) labelText = trans.out;
                else if (isTarget) labelText = trans.in;
                else labelText = link.label; // default if not directly connected to focus
              }
              
              const sprite = new SpriteText(labelText);
              sprite.color = 'rgba(255,255,255,0.8)';
              sprite.textHeight = 3;
              return sprite;
            }}
            linkPositionUpdate={(sprite: any, { start, end }: any) => {
              if (!sprite) return false;
              const middlePos = {
                x: start.x + (end.x - start.x) / 2,
                y: start.y + (end.y - start.y) / 2,
                z: start.z + (end.z - start.z) / 2
              };
              Object.assign(sprite.position, middlePos);
              return false; // don't prevent default line rendering
            }}
          />
        )}
      </div>
    </div>
  );
}
