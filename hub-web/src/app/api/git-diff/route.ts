import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

const PROJECT_ROOT = path.resolve(process.cwd(), '../'); 
const SHADOW_GIT_DIR = path.join(PROJECT_ROOT, '.shadow-git');
const LOCAL_GIT_DIR = path.join(PROJECT_ROOT, '.git');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get('filePath');
  const repo = searchParams.get('repo'); // 'shadow' or 'local'
  const targetHash = searchParams.get('targetHash');
  const baseHash = searchParams.get('baseHash'); // optional

  if (!filePath || !repo || !targetHash) {
    return NextResponse.json({ error: 'filePath, repo, and targetHash are required' }, { status: 400 });
  }

  const gitDir = repo === 'shadow' ? SHADOW_GIT_DIR : LOCAL_GIT_DIR;

  try {
    let cmd = '';
    if (baseHash) {
      // Diff between two specific commits
      cmd = `git --git-dir="${gitDir}" --work-tree="${PROJECT_ROOT}" diff ${baseHash} ${targetHash} -- "${filePath}"`;
    } else {
      // Diff against parent
      // using git show
      cmd = `git --git-dir="${gitDir}" --work-tree="${PROJECT_ROOT}" show ${targetHash} -- "${filePath}"`;
    }

    const { stdout } = await execAsync(cmd);
    
    // git show outputs the commit metadata header before the diff. 
    // If it's a show command, we can just return it, the diff viewer component should handle it,
    // or we can extract just the diff part. Let's return raw stdout for now, the FileDiffViewer can usually parse or show diffs.
    // Wait, FileDiffViewer might expect ONLY the diff. Let's extract the diff if it's from `git show`.
    let diffOutput = stdout;
    if (!baseHash) {
       // `git show` includes commit message and metadata.
       // The actual diff starts at `diff --git`
       const diffIndex = stdout.indexOf('diff --git');
       if (diffIndex !== -1) {
         diffOutput = stdout.substring(diffIndex);
       }
    }

    return NextResponse.json({
      diff: diffOutput
    });
  } catch (error: any) {
    console.error('Git diff error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate git diff' }, { status: 500 });
  }
}
