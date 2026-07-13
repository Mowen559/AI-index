import { NextResponse } from 'next/server';
// @ts-expect-error - node:sqlite is in Node 22.5+
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import {
  getCodebaseMemoryDbPath,
  getGitNexusRoot,
} from '@/lib/runtime-config';
import { findSupermemoryMemoryForFile } from '@/lib/supermemory-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get('filePath');
  const projectPath = searchParams.get('project') || undefined;

  if (!filePath) {
    return NextResponse.json({ error: 'filePath parameter is required' }, { status: 400 });
  }

  const dbPath = getCodebaseMemoryDbPath(projectPath);
  
  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ error: `Knowledge graph database not found at ${dbPath}` }, { status: 500 });
  }

  let llmMetadata = null;
  let memorySourcePath: string | null = null;
  try {
    const memory = findSupermemoryMemoryForFile(filePath);
    if (memory) {
      llmMetadata = {
        summary: memory.summary,
        tags: memory.tags,
        complexity: memory.complexity,
      };
      memorySourcePath = memory.sourceGraphPath;
    }
  } catch (err) {
    console.error('Error loading LLM metadata:', err);
  }

  try {
    const db = new DatabaseSync(dbPath);

    // 1. Get all nodes defined in this file
    const nodesStmt = db.prepare(`
      SELECT qualified_name as id, label as kind, name, start_line, end_line, properties 
      FROM nodes 
      WHERE file_path = ? 
      ORDER BY start_line
    `);
    const fileNodes = nodesStmt.all(filePath) as any[];

    // Parse properties for signature and docstring if needed
    for (const node of fileNodes) {
      try {
        const props = JSON.parse(node.properties || '{}');
        node.signature = props.signature || '';
        node.docstring = props.docstring || '';
      } catch (e) {
        node.signature = '';
        node.docstring = '';
      }
      delete node.properties;
    }

    // 2. Get incoming edges (who calls/imports things in this file)
    const incomingStmt = db.prepare(`
      SELECT src.qualified_name as source, tgt.qualified_name as target, e.type as kind, src.name as source_name, src.file_path as source_file, src.label as source_kind 
      FROM edges e 
      JOIN nodes src ON e.source_id = src.id
      JOIN nodes tgt ON e.target_id = tgt.id
      WHERE tgt.file_path = ?
    `);
    const incomingEdges = incomingStmt.all(filePath) as any[];

    // 3. Get outgoing edges (what things in this file call/import)
    const outgoingStmt = db.prepare(`
      SELECT src.qualified_name as source, tgt.qualified_name as target, e.type as kind, tgt.name as target_name, tgt.file_path as target_file, tgt.label as target_kind 
      FROM edges e 
      JOIN nodes src ON e.source_id = src.id
      JOIN nodes tgt ON e.target_id = tgt.id
      WHERE src.file_path = ?
    `);
    const outgoingEdges = outgoingStmt.all(filePath) as any[];

    db.close();

    return NextResponse.json({
      file: filePath,
      nodes: fileNodes,
      incomingEdges,
      outgoingEdges,
      llmMetadata,
      runtime: {
        graphDbPath: dbPath,
        gitNexusRoot: getGitNexusRoot(),
        metadataPath: memorySourcePath,
      }
    });
  } catch (error: any) {
    console.error('CodeGraph Analysis Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
