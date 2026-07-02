import { NextResponse } from 'next/server';
import path from 'path';

export const dynamic = 'force-dynamic';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  language?: string;
}

export async function GET() {
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const dbPath = path.join(process.cwd(), '..', '.codegraph', 'codegraph.db');
    const db = new DatabaseSync(dbPath);

    // Get all files
    const files = db.prepare(`
      SELECT path, language
      FROM files
      ORDER BY path ASC
    `).all() as { path: string, language: string }[];

    db.close();

    // Build tree
    const root: FileNode = { name: 'root', path: '', type: 'directory', children: [] };

    for (const file of files) {
      const parts = file.path.split('/');
      let current = root;
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        
        if (!current.children) {
          current.children = [];
        }
        
        let child = current.children.find(c => c.name === part);
        if (!child) {
          child = {
            name: part,
            path: parts.slice(0, i + 1).join('/'),
            type: isFile ? 'file' : 'directory',
          };
          if (isFile) {
            child.language = file.language;
          } else {
            child.children = [];
          }
          current.children.push(child);
        }
        
        current = child;
      }
    }
    
    // Sort directories first, then files alphabetically
    const sortTree = (node: FileNode) => {
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortTree);
      }
    };
    
    sortTree(root);

    return NextResponse.json({ tree: root.children || [] });
  } catch (error: any) {
    console.error('Error fetching files:', error);
    return NextResponse.json(
      { error: 'Failed to extract files list', details: error.message },
      { status: 500 }
    );
  }
}
