import { NextResponse } from 'next/server';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get('filePath');

  if (!filePath) {
    return NextResponse.json({ error: 'filePath parameter is required' }, { status: 400 });
  }

  // Calculate the path to the codegraph.db
  const projectRoot = process.cwd(); // Assume hub-web is run from the workspace root or hub-web directory.
  // Wait, Next.js runs from hub-web. The codegraph is at super agent/.codegraph
  // Let's resolve relative to process.cwd()
  let dbPath = path.resolve(projectRoot, '../.codegraph/codegraph.db');
  
  if (!fs.existsSync(dbPath)) {
    // If not found, maybe we are running from the workspace root
    dbPath = path.resolve(projectRoot, '.codegraph/codegraph.db');
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: `CodeGraph database not found at ${dbPath}` }, { status: 500 });
    }
  }

  try {
    const db = new DatabaseSync(dbPath);

    // 1. Get all nodes defined in this file
    const nodesStmt = db.prepare(`
      SELECT id, kind, name, signature, docstring, start_line, end_line 
      FROM nodes 
      WHERE file_path = ? 
      ORDER BY start_line
    `);
    const fileNodes = nodesStmt.all(filePath) as any[];

    // 2. Get incoming edges (who calls/imports things in this file)
    const incomingStmt = db.prepare(`
      SELECT e.source, e.target, e.kind, n.name as source_name, n.file_path as source_file, n.kind as source_kind 
      FROM edges e 
      JOIN nodes n ON e.source = n.id 
      WHERE e.target IN (SELECT id FROM nodes WHERE file_path = ?)
    `);
    const incomingEdges = incomingStmt.all(filePath) as any[];

    // 3. Get outgoing edges (what things in this file call/import)
    const outgoingStmt = db.prepare(`
      SELECT e.source, e.target, e.kind, n.name as target_name, n.file_path as target_file, n.kind as target_kind 
      FROM edges e 
      JOIN nodes n ON e.target = n.id 
      WHERE e.source IN (SELECT id FROM nodes WHERE file_path = ?)
    `);
    const outgoingEdges = outgoingStmt.all(filePath) as any[];

    db.close();

    return NextResponse.json({
      file: filePath,
      nodes: fileNodes,
      incomingEdges,
      outgoingEdges
    });
  } catch (error: any) {
    console.error('CodeGraph Analysis Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
