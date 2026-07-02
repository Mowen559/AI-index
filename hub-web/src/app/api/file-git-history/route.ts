import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

const PROJECT_ROOT = path.resolve(process.cwd(), '../'); 
const SHADOW_GIT_DIR = path.join(PROJECT_ROOT, '.shadow-git');

// Helper to parse git log output (without -p)
function parseGitLog(output: string) {
  const commits = [];
  const lines = output.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    
    const parts = line.split('|');
    if (parts.length >= 3) {
      commits.push({
        hash: parts[0],
        message: parts[1],
        date: parts[2]
      });
    }
  }
  return commits;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get('filePath');

  if (!filePath) {
    return NextResponse.json({ error: 'filePath parameter is required' }, { status: 400 });
  }

  try {
    // 1. Fetch Shadow Git history for the file
    let shadowCommits = [];
    try {
      // Fetch all commits for the file in shadow git
      const cmd = `git --git-dir="${SHADOW_GIT_DIR}" --work-tree="${PROJECT_ROOT}" log --format="%H|%s|%aI" -- "${filePath}"`;
      const { stdout } = await execAsync(cmd);
      shadowCommits = parseGitLog(stdout);
    } catch (e: any) {
      console.warn("Shadow git error for", filePath, e.message);
    }

    // 2. Fetch Local Repo history for the file
    let localCommits = [];
    try {
      const cmd = `git --git-dir="${path.join(PROJECT_ROOT, '.git')}" --work-tree="${PROJECT_ROOT}" log -n 10 --format="%H|%s|%aI" -- "${filePath}"`;
      const { stdout } = await execAsync(cmd);
      localCommits = parseGitLog(stdout);
    } catch (e: any) {
      console.warn("Local git error for", filePath, e.message);
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
