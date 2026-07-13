import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { getProjectRoot } from '@/lib/runtime-config';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const patchContent = body.patchContent;
    const PROJECT_ROOT = getProjectRoot(body.project);

    if (!patchContent) {
      return NextResponse.json({ error: 'Missing patchContent' }, { status: 400 });
    }

    // Write the patch to a temporary file
    const patchPath = path.join(PROJECT_ROOT, '.temp_patch.patch');
    await fs.writeFile(patchPath, patchContent);

    // Run git apply
    try {
      // --unidiff-zero allows applying patches without context lines matching perfectly
      await execAsync(`git apply --unidiff-zero .temp_patch.patch`, { cwd: PROJECT_ROOT });
      
      // Cleanup
      await fs.unlink(patchPath).catch(() => {});
      
      return NextResponse.json({ success: true, message: 'Patch applied successfully' });
    } catch (e: unknown) {
      // Cleanup
      await fs.unlink(patchPath).catch(() => {});
      console.error("Patch apply failed", e);
      const message = e instanceof Error ? e.message : 'Failed to apply patch';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in apply-patch:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
