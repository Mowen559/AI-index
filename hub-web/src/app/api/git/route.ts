import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectPath = searchParams.get('project') || undefined;
  const projectRoot = searchParams.get('project');
  const filePath = searchParams.get('file');

  if (!projectRoot || !filePath) {
    return NextResponse.json({ error: 'Missing project or file parameter' }, { status: 400 });
  }

  try {
    // 1. Get the last 10 commits that touched this file
    const logCommand = `git log -n 10 --pretty=format:"%H|%an|%ad|%s" --date=short -- "${filePath}"`;
    const { stdout: logOut } = await execAsync(logCommand, { cwd: projectRoot });
    
    const commits = logOut.split('\n').filter(Boolean).map(line => {
      const [hash, author, date, message] = line.split('|');
      // Simple heuristic for AI: author name contains AI or Antigravity, or message starts with AI-like prefix
      const isAI = author.toLowerCase().includes('ai') || 
                   author.toLowerCase().includes('antigravity') || 
                   message.includes('[AI]');
      return { hash, author, date, message, isAI };
    });

    // 2. Get the current uncommitted diff or the last commit diff for this file
    let diffStr = '';
    try {
      // First try uncommitted changes
      const { stdout: diffOut } = await execAsync(`git diff HEAD -- "${filePath}"`, { cwd: projectRoot });
      diffStr = diffOut;
      if (!diffStr && commits.length > 0) {
        // If no uncommitted changes, show the diff of the most recent commit
        const { stdout: lastCommitDiff } = await execAsync(`git show ${commits[0].hash} -- "${filePath}"`, { cwd: projectRoot });
        diffStr = lastCommitDiff;
      }
    } catch (e) {
      console.error('Diff error:', e);
    }

    return NextResponse.json({
      commits,
      diff: diffStr
    });

  } catch (error: any) {
    console.error('Git API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
