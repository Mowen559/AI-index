export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getGitNexusRepoRoot } from '@/lib/runtime-config';



export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectPath = searchParams.get('project') || undefined;
  const PROJECT_ROOT = getGitNexusRepoRoot(projectPath);
  const filePath = searchParams.get('filePath');

  if (!filePath) {
    return NextResponse.json({ error: 'filePath parameter is required' }, { status: 400 });
  }

  try {
    let shadowCommits: any[] = [];
    try {
      const { getShadowFileHistory } = await import('gitnexus/dist/server/shadow-git.js');
      shadowCommits = await getShadowFileHistory(PROJECT_ROOT, filePath, 10);
    } catch (e: any) {
      console.warn("Shadow git error for", filePath, e.message);
    }

    // 2. Fetch Local Repo history for the file natively using gitnexus
    let localCommits: any[] = [];
    try {
      // Import dynamically to avoid top-level issues if the package is missing during early build
      const { getFileHistory } = await import('gitnexus/dist/server/git-history.js');
      localCommits = await getFileHistory(PROJECT_ROOT, filePath, 10);
      
      // format dates if needed, but gitnexus returns { hash, author, email, date, message }.
      // The frontend currently expects { hash, message, date } which matches!
    } catch (e: any) {
      console.warn("Local git (GitNexus) error for", filePath, e.message);
    }

    return NextResponse.json({
      shadow: shadowCommits,
      local: localCommits
    });
  } catch (error: any) {
    console.error('Git history error:', error);
    return NextResponse.json({ error: error.message || 'Failed to read git history' }, { status: 500 });
  }
}
