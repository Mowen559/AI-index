import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectPath = searchParams.get('project') || undefined;
  const project = searchParams.get('project');
  const maxNodesStr = searchParams.get('max_nodes');
  const maxNodes = maxNodesStr ? parseInt(maxNodesStr, 10) : 10000;
  
  if (!project) {
    return NextResponse.json({ error: "Missing project param" }, { status: 400 });
  }

  try {
    const requireDynamic = eval('require');
    const cgModule = requireDynamic('@colbymchenry/codegraph');
    const CodeGraph = cgModule.CodeGraph;
    const QueryBuilder = cgModule.QueryBuilder;
    
    if (!cgModule.isInitialized(project)) {
      return NextResponse.json({ error: "Graph not initialized. Please run analysis first." }, { status: 400 });
    }

    // Open CodeGraph
    const cg = await CodeGraph.open(project, { readOnly: true });
    
    // Using internal queries builder directly to get all nodes and edges
    const queries = (cg as any).queries;
    const allNodes = queries.getAllNodes();
    
    // Raw query for edges
    const db = queries.db;
    let allEdges = db.prepare('SELECT * FROM edges').all();

    const viewMode = searchParams.get('viewMode') || 'detail';

    // Filter to only include major architectural nodes, GitNexus nodes, and Knowledge Graph nodes
    const ALLOWED_NODE_TYPES = new Set([
      // CodeMCP
      "function", "class", "method", "interface", "type_alias", "struct", "enum", "module", "component", "trait", "namespace",
      // GitNexus
      "pull_request", "issue", "commit", "branch", "author", "repository",
      // Knowledge Graph
      "blueprint", "architecture_node", "concept", "system", "service"
    ]);
    let importantNodes = allNodes.filter((n: any) => ALLOWED_NODE_TYPES.has(n.kind));

    if (viewMode === 'file') {
      let syntheticId = -10000;
      const fileNodesMap = new Map<string, any>();
      const originalNodeToFileId = new Map<number, number>();

      for (const n of importantNodes) {
        const fp = n.file_path || "unknown";
        if (!fileNodesMap.has(fp)) {
          fileNodesMap.set(fp, {
            id: syntheticId--,
            kind: 'file',
            name: fp === "unknown" ? "Unknown" : path.basename(fp),
            file_path: fp,
          });
        }
        originalNodeToFileId.set(n.id, fileNodesMap.get(fp).id);
      }
      
      const fileEdges = [];
      const edgeSet = new Set<string>();
      
      for (const e of allEdges) {
        const srcFileId = originalNodeToFileId.get(e.source);
        const tgtFileId = originalNodeToFileId.get(e.target);
        
        if (srcFileId && tgtFileId && srcFileId !== tgtFileId) {
          const key = `${srcFileId}::${tgtFileId}::${e.kind}`;
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            fileEdges.push({
              source: srcFileId,
              target: tgtFileId,
              kind: e.kind
            });
          }
        }
      }
      
      importantNodes = Array.from(fileNodesMap.values());
      allEdges = fileEdges;
    }

    // Enforce max node limit to prevent browser freeze
    const nodesToReturn = importantNodes.slice(0, maxNodes);
    const validNodeIds = new Set(nodesToReturn.map((n: any) => n.id));
    
    // For a cleaner look, optionally filter down edges to only the most important ones or let the UI handle it.
    const edgesToReturn = allEdges.filter((e: any) => validNodeIds.has(e.source) && validNodeIds.has(e.target));

    // Create a magnificent Spiral Galaxy layout
    const formattedNodes = nodesToReturn.map((n: any, idx: number) => {
      
      // Deterministic pseudo-random function
      const rand = (seed: number) => {
        let x = Math.sin(seed + 1) * 10000;
        return x - Math.floor(x);
      };
      
      const r_rand = rand(idx);
      const angle_rand = rand(idx + 10000);
      const arm_rand = rand(idx + 20000);
      const z_rand = rand(idx + 30000);
      
      const numArms = 4;
      // Radius concentrated near the center, sweeping out to 15000
      const r = 300 + Math.pow(r_rand, 1.5) * 14000;
      
      // Spiral angle: tightens as radius increases
      const armOffset = Math.floor(arm_rand * numArms) * (Math.PI * 2 / numArms);
      const scatter = (angle_rand - 0.5) * Math.PI * 0.4; // Spread around the arm
      const angle = r * 0.0004 + armOffset + scatter;
      
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      
      // Z-axis: Bulge in the center, thin disk at the edges
      const zSpread = 400000 / (r + 2000); 
      const z = (z_rand - 0.5) * zSpread;
      
      let color = "#cbd5e1"; // default slate
      let domain: 'codemcp' | 'gitnexus' | 'knowledge_graph' = 'codemcp';
      
      const gitNexusKinds = new Set(["pull_request", "issue", "commit", "branch", "author", "repository"]);
      const kgKinds = new Set(["blueprint", "architecture_node", "concept", "system", "service"]);

      if (gitNexusKinds.has(n.kind)) domain = 'gitnexus';
      else if (kgKinds.has(n.kind)) domain = 'knowledge_graph';

      switch (n.kind) {
        // CodeMCP
        case 'class': color = '#f87171'; break; // red
        case 'function': color = '#60a5fa'; break; // blue
        case 'method': color = '#34d399'; break; // green
        case 'interface': color = '#a78bfa'; break; // purple
        case 'variable': color = '#fbbf24'; break; // yellow
        case 'module': color = '#2dd4bf'; break; // teal
        // GitNexus
        case 'pull_request': color = '#fb923c'; break; // orange
        case 'issue': color = '#f43f5e'; break; // rose
        case 'commit': color = '#94a3b8'; break; // slate
        // KG
        case 'blueprint': color = '#e879f9'; break; // fuchsia
        case 'architecture_node': color = '#38bdf8'; break; // sky
      }

      // Try to extract lightweight metadata if available in n.properties or n.metadata
      let metadata: any = undefined;
      try {
        if (n.properties) metadata = typeof n.properties === 'string' ? JSON.parse(n.properties) : n.properties;
      } catch (e) { /* ignore */ }

      return {
        id: n.id,
        x, y, z,
        label: n.kind || 'unknown', // Must be kind for the filter panel to group by node type
        name: n.name,
        file_path: n.file_path,
        size: (n.kind === 'class' || n.kind === 'module' || domain === 'knowledge_graph') ? 12 : (domain === 'gitnexus' ? 10 : 6),
        color,
        domain,
        metadata
      };
    });

    // Subsample edges heavily to prevent the "solid ball of light" effect.
    // A starry nebula should emphasize the stars (nodes) and only show faint constellational lines.
    const maxEdges = 2000;
    const step = Math.max(1, Math.ceil(edgesToReturn.length / maxEdges));
    const sampledEdges = edgesToReturn.filter((e: any, i: number) => i % step === 0).slice(0, maxEdges);

    const formattedEdges = sampledEdges.map((e: any) => ({
      source: e.source,
      target: e.target,
      type: e.kind || "edge"
    }));

    return NextResponse.json({
      nodes: formattedNodes,
      edges: formattedEdges,
      total_nodes: formattedNodes.length
    });

  } catch (err: any) {
    console.error("Layout API Error:", err);
    return NextResponse.json({ error: "Failed to load graph", details: err.message }, { status: 500 });
  }
}
