import { NextResponse } from 'next/server';
import path from 'path';

// Force dynamic since we read from an external SQLite DB that can change
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Dynamic import to avoid build errors if sqlite isn't perfectly stubbed in all envs
    const { DatabaseSync } = await import('node:sqlite');
    
    const dbPath = path.join(process.cwd(), '..', '.codegraph', 'codegraph.db');
    const db = new DatabaseSync(dbPath);

    // 1. Fetch file-to-file edges (source and target both start with 'file:')
    // And get their degrees
    const edgesQuery = db.prepare(`
      SELECT source, target, kind
      FROM edges
      WHERE kind IN ('imports', 'calls')
        AND source LIKE 'file:%'
        AND target LIKE 'file:%'
    `).all() as { source: string, target: string, kind: string }[];

    // Extract file names from 'file:path/to/file#symbol'
    const getFileId = (id: string) => {
      const hashIdx = id.indexOf('#');
      const clean = hashIdx > -1 ? id.substring(0, hashIdx) : id;
      return clean.startsWith('file:') ? clean.substring(5) : clean;
    };

    const finalLinks: { source: string, target: string, label: string }[] = [];
    const linkSet = new Set<string>();
    const degreeMap: Record<string, number> = {};

    for (const edge of edgesQuery) {
      const srcFile = getFileId(edge.source);
      const tgtFile = getFileId(edge.target);

      if (srcFile && tgtFile && srcFile !== tgtFile) {
        degreeMap[srcFile] = (degreeMap[srcFile] || 0) + 1;
        degreeMap[tgtFile] = (degreeMap[tgtFile] || 0) + 1;

        const key = `${srcFile}->${tgtFile}`;
        if (!linkSet.has(key)) {
          linkSet.add(key);
          finalLinks.push({
            source: srcFile,
            target: tgtFile,
            label: edge.kind
          });
        }
      }
    }

    // 2. Get top 1000 files by degree
    const sortedFiles = Object.keys(degreeMap).sort((a, b) => degreeMap[b] - degreeMap[a]).slice(0, 1000);
    const validFileSet = new Set(sortedFiles);

    // 3. Filter links to only include those between the top 1000 files
    const filteredLinks = finalLinks.filter(l => validFileSet.has(l.source) && validFileSet.has(l.target));

    // 4. Create nodes array
    const nodes = sortedFiles.map(filePath => {
      const parts = filePath.split('/');
      let group = 'root';
      if (parts.length > 2) {
        group = parts[1]; // e.g., 'src/app' -> 'app'
      } else if (parts.length > 1) {
        group = parts[0];
      }

      return {
        id: filePath,
        name: parts[parts.length - 1], // Just the filename
        group: group,
        val: Math.max(2, Math.min(20, 2 + Math.sqrt(degreeMap[filePath]))) // Log/sqrt scaling for size
      };
    });

    db.close();

    return NextResponse.json({
      nodes,
      links: filteredLinks,
      stats: {
        nodesCount: nodes.length,
        edgesCount: filteredLinks.length
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
