import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProjectRoot, getShadowGitRoot } from '@/lib/runtime-config';



export async function POST(request: Request) {
  try {
    const body = await request.json();
    const PROJECT_ROOT = getProjectRoot(body.project);
    const SHADOW_GIT_DIR = getShadowGitRoot(body.project);
    const LOCAL_GIT_DIR = path.join(PROJECT_ROOT, '.git');
    const { filePath, hash, repo } = body;

    if (!filePath || !hash || !repo) {
      return NextResponse.json({ error: 'filePath, hash, and repo are required' }, { status: 400 });
    }

    const gitDir = repo === 'shadow' ? SHADOW_GIT_DIR : LOCAL_GIT_DIR;

    // Use git show to extract the file at the specific commit
    // Note: git show hash:path uses forward slashes in path
    const gitPath = filePath.replace(/\\/g, '/');
    
    const { runGitCapture } = await import('gitnexus/dist/server/git-history.js');
    const buffer = await runGitCapture(['show', `${hash}:"${gitPath}"`], {
      cwd: PROJECT_ROOT,
      gitDir,
      workTree: PROJECT_ROOT,
      encoding: 'buffer'
    });
    
    const absoluteFilePath = path.join(/*turbopackIgnore: true*/ PROJECT_ROOT, filePath);
    
    await fs.writeFile(absoluteFilePath, buffer);

    return NextResponse.json({
      success: true,
      message: `Restored ${filePath} to commit ${hash}`
    });
  } catch (error: any) {
    console.error('Git restore error:', error);
    return NextResponse.json({ error: error.message || 'Failed to restore file' }, { status: 500 });
  }
}
