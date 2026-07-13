import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getGitNexusRoot, getShadowGitRoot } from '@/lib/runtime-config';

const execAsync = promisify(exec);
const PROJECT_ROOT = getGitNexusRoot();
const SHADOW_GIT_DIR = getShadowGitRoot();

export async function GET() {
  try {
    // 1. Get list of files that differ between shadow git HEAD and working tree
    // Actually, if the AI makes changes, it might be in the working tree, and the shadow-git is what we track.
    // Wait, the plan was: AI commits to .shadow-git. We want to see the diff of those commits vs the actual repo.
    // However, if we just want to see the uncommitted changes in the normal working tree tracked by .shadow-git:
    // If AI changes files, they are on disk. If we run `git --git-dir=.shadow-git --work-tree=. status -s`
    // it will show us what is modified.
    // Let's get the status first.
    
    const { stdout: statusOut } = await execAsync(`git --git-dir="${SHADOW_GIT_DIR}" --work-tree="${PROJECT_ROOT}" status -s`);
    
    if (!statusOut.trim()) {
      return NextResponse.json({ files: [] });
    }

    const lines = statusOut.split('\n').filter(Boolean);
    const files = [];

    for (const line of lines) {
      const status = line.substring(0, 2);
      const filePath = line.substring(3).trim();
      
      if (status === '??') {
        continue; // Skip untracked files for shadow git diff for now
      }

      try {
        // Fetch diff for this file
        // For new files (??), we might need `git diff --no-index /dev/null file` or just read the file.
        // But `git diff` works if it's tracked. We will just attempt `git diff HEAD -- filePath`
        const diffCmd = `git --git-dir="${SHADOW_GIT_DIR}" --work-tree="${PROJECT_ROOT}" diff HEAD -- "${filePath}"`;
        
        // If untracked, git diff HEAD doesn't show it usually, unless we add it to index.
        // For simplicity, we just run the diff command.
        let diffText = "";
        try {
           const { stdout: diffOut } = await execAsync(diffCmd);
           diffText = diffOut;
        } catch (e) {
           console.error("Diff error for", filePath, e);
        }

        files.push({
          path: filePath,
          status: status,
          diff: diffText
        });
      } catch (err) {
        console.error(`Failed to process diff for ${filePath}:`, err);
      }
    }

    return NextResponse.json({ files });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to read shadow git';
    console.error('Shadow git error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
