import { NextResponse } from 'next/server';
import { getCodebaseMemoryDbPath } from '@/lib/runtime-config';

// Force dynamic since we read from an external SQLite DB that can change
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Dynamic import to avoid build errors if sqlite isn't perfectly stubbed in all envs
    // @ts-expect-error - node:sqlite is in Node 22.5+
    const { DatabaseSync } = await import('node:sqlite');
    
    const url = new URL(request.url);
    const projectPath = url.searchParams.get('project') || undefined;
    
    const dbPath = getCodebaseMemoryDbPath(projectPath);
    
    if (!require('fs').existsSync(dbPath)) {
      return NextResponse.json({
        nodes: [],
        links: [],
        stats: {
          nodesCount: 0,
          edgesCount: 0,
          nodeTypes: [],
          availableTypes: []
        }
      });
    }
    
    const db = new DatabaseSync(dbPath);

    // Parse other query parameters
    const limitParam = parseInt(url.searchParams.get('limit') || '400', 10);
    const typesParam = url.searchParams.get('types') || 'file,class,function,constant,interface';
    const allowedTypes = typesParam.split(',').map(t => t.trim().toLowerCase());

    // Build a condition for valid labels (case insensitive)
    let validLabelCondition = allowedTypes.map(t => `LOWER(label) = '${t}'`).join(' OR ');
    if (!validLabelCondition) validLabelCondition = "1=0";

    // 1. Get top nodes by degree to form a dense, meaningful subgraph
    const topNodesQuery = db.prepare(`
      SELECT n.id as node_id, n.qualified_name as node_str, n.label, n.name, n.file_path, SUM(degree_counts.c) as degree
      FROM (
        SELECT source_id as id, COUNT(*) as c FROM edges GROUP BY source_id
        UNION ALL
        SELECT target_id as id, COUNT(*) as c FROM edges GROUP BY target_id
      ) degree_counts
      JOIN nodes n ON n.id = degree_counts.id
      WHERE ${validLabelCondition}
      GROUP BY n.id
      ORDER BY degree DESC
      LIMIT ${limitParam}
    `).all() as {node_id: number, node_str: string, label: string, name: string, file_path: string, degree: number}[];

    const sortedNodeIds = topNodesQuery.map(r => r.node_id);
    const degreeMap: Record<number, number> = {};
    for (const r of topNodesQuery) {
      degreeMap[r.node_id] = r.degree;
    }

    const finalLinks: { source: string, target: string, label: string }[] = [];
    const linkSet = new Set<string>();

    if (sortedNodeIds.length > 0) {
      const placeholders = sortedNodeIds.map(() => '?').join(',');
      // 2. Fetch edges STRICTLY between the top nodes
      const edgesQueryData = db.prepare(`
        SELECT s.qualified_name as source_str, t.qualified_name as target_str, e.type as kind
        FROM edges e
        JOIN nodes s ON e.source_id = s.id
        JOIN nodes t ON e.target_id = t.id
        WHERE e.source_id IN (${placeholders})
          AND e.target_id IN (${placeholders})
      `).all(...sortedNodeIds, ...sortedNodeIds) as { source_str: string, target_str: string, kind: string }[];

      for (const edge of edgesQueryData) {
        const key = `${edge.source_str}->${edge.target_str}->${edge.kind}`;
        if (!linkSet.has(key)) {
          linkSet.add(key);
          finalLinks.push({
            source: edge.source_str,
            target: edge.target_str,
            label: edge.kind
          });
        }
      }
      
      // 3. Generate implicit file-to-file dependencies if "file" is requested
      if (allowedTypes.includes('file')) {
        const fileNodePaths = Array.from(new Set(
          topNodesQuery
            .filter(r => r.label && r.label.toLowerCase() === 'file' && r.file_path)
            .map(r => r.file_path)
        ));
        
        // SQLite parameter limit is 999. If we have too many files, we cap it to prevent errors
        const maxFiles = Math.min(fileNodePaths.length, 450); 
        const slicedPaths = fileNodePaths.slice(0, maxFiles);
          
        if (slicedPaths.length > 0) {
          const placeholdersPaths = slicedPaths.map(() => '?').join(',');
          
          try {
            const fileEdgesQuery = db.prepare(`
              SELECT ns.file_path as source_path, nt.file_path as target_path, 'DEPENDS_ON' as kind
              FROM edges e
              JOIN nodes ns ON e.source_id = ns.id
              JOIN nodes nt ON e.target_id = nt.id
              WHERE ns.file_path IN (${placeholdersPaths}) 
                AND nt.file_path IN (${placeholdersPaths})
                AND ns.file_path != nt.file_path
            `).all(...slicedPaths, ...slicedPaths) as { source_path: string, target_path: string, kind: string }[];
            
            // Map file paths back to File node qualified_names
            const pathToFileNodeId = new Map<string, string>();
            for (const r of topNodesQuery) {
              if (r.label && r.label.toLowerCase() === 'file' && r.file_path) {
                pathToFileNodeId.set(r.file_path, r.node_str);
              }
            }
            
            for (const edge of fileEdgesQuery) {
              const sId = pathToFileNodeId.get(edge.source_path);
              const tId = pathToFileNodeId.get(edge.target_path);
              if (sId && tId) {
                const key = `${sId}->${tId}->${edge.kind}`;
                if (!linkSet.has(key)) {
                  linkSet.add(key);
                  finalLinks.push({
                    source: sId,
                    target: tId,
                    label: edge.kind
                  });
                }
              }
            }
          } catch (e) {
            console.error("Error generating file-to-file relationships:", e);
          }
        }
      }
    }

    const nodes = topNodesQuery.map(r => {
      const type = r.label || 'unknown';
      let name = r.name || r.node_str;
      let group = type;
      let val = 2; // Default size for symbols
      let filePath = r.file_path;

      if (type.toLowerCase() === 'file') {
        const normalizedPath = r.node_str.replace(/\\/g, '/');
        // Handle normal slash-based paths
        if (normalizedPath.includes('/')) {
          const parts = normalizedPath.split('/');
          name = parts[parts.length - 1]; // Just the filename
          if (parts.length > 2) {
            group = parts[1]; // e.g., 'src/app' -> 'app'
          } else if (parts.length > 1) {
            group = parts[0];
          } else {
            group = 'root';
          }
        } else if (r.node_str.length > 20 && r.node_str.includes('.')) {
          // Handle dot-separated node paths (e.g. from codebase-memory)
          const parts = r.node_str.split('.');
          let lastPart = parts[parts.length - 1];
          if (lastPart.startsWith('__') && lastPart.endsWith('__') && parts.length > 1) {
            lastPart = parts[parts.length - 2];
          }
          name = lastPart;
          group = parts.length > 2 ? parts[parts.length - 3] : 'root';
        }
        
        val = Math.max(4, Math.min(25, 4 + Math.sqrt(degreeMap[r.node_id]))); // Files are larger
        // Clean the file path if it has prefixes, though in CBM it's typically just the path
        filePath = r.file_path || r.node_str; 
      } else {
        val = Math.max(1, Math.min(10, 1 + Math.sqrt(degreeMap[r.node_id]) * 0.5)); // Symbols are smaller
        
        // Clean up excessively long symbol/module names (often derived from file paths)
        if (name && name.length > 20 && name.includes('.')) {
          const parts = name.split('.');
          let lastPart = parts[parts.length - 1];
          // Handle cases like __file__ or __init__
          if (lastPart.startsWith('__') && lastPart.endsWith('__') && parts.length > 1) {
            lastPart = parts[parts.length - 2];
          }
          name = lastPart;
        }
      }

      return {
        id: r.node_str,
        name: name, 
        group: group,
        type: type,
        val: val,
        filePath: filePath // Added so frontend knows which file this symbol belongs to
      };
    });

    // Extract unique node types from the returned nodes
    const uniqueTypes = Array.from(new Set(nodes.map(n => n.type.toLowerCase())));

    // Fetch globally available types
    const allLabelsQuery = db.prepare(`SELECT DISTINCT label FROM nodes`).all() as {label: string}[];
    const availableTypes = allLabelsQuery.map(r => (r.label || 'unknown').toLowerCase());

    db.close();

    return NextResponse.json({
      nodes,
      links: finalLinks,
      stats: {
        nodesCount: nodes.length,
        edgesCount: finalLinks.length,
        nodeTypes: uniqueTypes,
        availableTypes: availableTypes // include the globally available types in DB
      }
    });
  } catch (error: any) {
    console.error('Error fetching project graph data:', error);
    return NextResponse.json(
      { error: 'Failed to extract project graph data', details: error.message },
      { status: 500 }
    );
  }
}
