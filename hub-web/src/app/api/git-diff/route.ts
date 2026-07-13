export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getGitNexusRepoRoot } from '@/lib/runtime-config';


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectPath = searchParams.get('project') || undefined;
  const PROJECT_ROOT = getGitNexusRepoRoot(projectPath);
  const filePath = searchParams.get('filePath');
  const repo = searchParams.get('repo'); // 'shadow' or 'local'
  const targetHash = searchParams.get('targetHash');
  const baseHash = searchParams.get('baseHash'); // optional

  if (!filePath || !repo || !targetHash) {
    return NextResponse.json({ error: 'filePath, repo, and targetHash are required' }, { status: 400 });
  }


  try {
    let diffOutput = '';
    
    if (repo === 'local') {
      // Use GitNexus natively for the local repository
      const { getFileDiff } = await import('gitnexus/dist/server/git-history.js');
      
      if (baseHash) {
        // Diff between two specific commits
        diffOutput = await getFileDiff(PROJECT_ROOT, filePath, baseHash, targetHash);
      } else {
        // Diff against parent
        diffOutput = await getFileDiff(PROJECT_ROOT, filePath, `${targetHash}^`, targetHash);
      }
    } else {
      // Use GitNexus natively for the shadow repository
      const { getShadowFileDiff } = await import('gitnexus/dist/server/shadow-git.js');
      
      if (baseHash) {
        diffOutput = await getShadowFileDiff(PROJECT_ROOT, filePath, baseHash, targetHash);
      } else {
        diffOutput = await getShadowFileDiff(PROJECT_ROOT, filePath, `${targetHash}^`, targetHash);
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
