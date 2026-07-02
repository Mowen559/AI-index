import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

const PROJECT_ROOT = path.resolve(process.cwd(), '../'); 
const SHADOW_GIT_DIR = path.join(PROJECT_ROOT, '.shadow-git');
const LOCAL_GIT_DIR = path.join(PROJECT_ROOT, '.git');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { filePath, hash, repo } = body;

    if (!filePath || !hash || !repo) {
      return NextResponse.json({ error: 'filePath, hash, and repo are required' }, { status: 400 });
    }

    const gitDir = repo === 'shadow' ? SHADOW_GIT_DIR : LOCAL_GIT_DIR;

    // Use git show to extract the file at the specific commit
    // Note: git show hash:path uses forward slashes in path
    const gitPath = filePath.replace(/\\/g, '/');
    const cmd = `git --git-dir="${gitDir}" --work-tree="${PROJECT_ROOT}" show ${hash}:"${gitPath}"`;
    
    // We can't easily rely on stdout for binary files or large files because of encoding issues, 
    // but for code files it should be fine. For safer writes, we can redirect directly via shell:
    // However Windows shell redirect might mess up line endings or encodings. 
    // So we'll use exec to get buffer and write. Wait, execAsync gives a string by default. 
    // Let's use maxBuffer and encoding: 'buffer'.
    const { stdout } = await execAsync(cmd, { encoding: 'buffer', maxBuffer: 1024 * 1024 * 10 }); // 10MB limit
    
    const absoluteFilePath = path.join(PROJECT_ROOT, filePath);
    
    await fs.writeFile(absoluteFilePath, stdout);

    return NextResponse.json({
      success: true,
      message: `Restored ${filePath} to commit ${hash}`
    });
  } catch (error: any) {
    console.error('Git restore error:', error);
    return NextResponse.json({ error: error.message || 'Failed to restore file' }, { status: 500 });
  }
}
