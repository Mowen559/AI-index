import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getProjectsRoot } from "@/lib/runtime-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CloneRequest = {
  gitUrl?: string;
};

function deriveRepositoryName(gitUrl: string) {
  const withoutQuery = gitUrl.split("?")[0] || gitUrl;
  const rawName = withoutQuery.split(/[/:\\]/).filter(Boolean).at(-1) || "repository";
  return rawName.replace(/\.git$/i, "").replace(/[^\w.-]/g, "-") || "repository";
}

function runGitClone(gitUrl: string, targetPath: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("git", ["clone", gitUrl, targetPath], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(new Error(`Unable to start git. Please confirm Git is installed: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `git clone failed with exit code ${code}`));
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CloneRequest;
    const gitUrl = body.gitUrl?.trim();

    if (!gitUrl) {
      return NextResponse.json({ error: "gitUrl is required" }, { status: 400 });
    }

    const repoName = deriveRepositoryName(gitUrl);
    const projectsRoot = getProjectsRoot();
    const targetPath = path.join(projectsRoot, repoName);

    await mkdir(projectsRoot, { recursive: true });

    if (existsSync(targetPath)) {
      if (existsSync(path.join(targetPath, ".git"))) {
        return NextResponse.json({
          path: targetPath,
          name: repoName,
          projectsRoot,
          alreadyExists: true,
        });
      }

      return NextResponse.json(
        { error: `Target directory already exists but is not a Git repository: ${targetPath}` },
        { status: 409 },
      );
    }

    await runGitClone(gitUrl, targetPath);

    return NextResponse.json({
      path: targetPath,
      name: repoName,
      projectsRoot,
      alreadyExists: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to clone Git repository",
      },
      { status: 500 },
    );
  }
}
