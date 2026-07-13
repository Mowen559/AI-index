export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getGitNexusRoot } from '@/lib/runtime-config';

const PROJECT_ROOT = getGitNexusRoot();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
  const projectPath = searchParams.get('project') || undefined;
    const filePath = searchParams.get('filePath');

    if (!filePath) {
      return NextResponse.json({ error: 'Missing filePath parameter' }, { status: 400 });
    }

    const fullPath = path.join(/*turbopackIgnore: true*/ PROJECT_ROOT, filePath);
    
    // Security check to ensure the resolved path is within PROJECT_ROOT
    if (!fullPath.startsWith(PROJECT_ROOT)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const content = await fs.readFile(fullPath, 'utf8');

    return NextResponse.json({ content });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error fetching file content:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
