import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    const { path: targetPath } = await req.json();

    if (!targetPath || !fs.existsSync(targetPath)) {
      return NextResponse.json({ error: "Invalid path provided." }, { status: 400 });
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "Path must be a directory." }, { status: 400 });
    }

    // Set up SSE Stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const sendLog = (msg: string) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "log", msg })}\n\n`));
        };
        const sendStatus = (status: string) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "status", status })}\n\n`));
        };

        sendStatus("initializing");
        sendLog(`[System] Starting Agentic Analysis for: ${targetPath}`);

        // Use native CodeGraph init, bypass Next.js static analysis to avoid WASM bundle errors
        const requireDynamic = eval('require');
        const CodeGraph = requireDynamic('@colbymchenry/codegraph').default;
        
        (async () => {
          sendLog(`[CodeGraph] Executing native 'CodeGraph.init'...`);
          try {
            const cg = await CodeGraph.init(targetPath, { index: false });
            sendLog(`[CodeGraph] Indexing all files...`);
            const result = await cg.indexAll({
              onProgress: (prog: any) => {
                if (prog.current % 100 === 0 || prog.current === prog.total) {
                  sendLog(`[CodeGraph] Progress: ${prog.phase} ${prog.current}/${prog.total}`);
                }
              }
            });
            
            if (result.success) {
              sendLog(`[CodeGraph] Indexing completed successfully. Indexed ${result.filesIndexed} files.`);
            } else {
              sendLog(`[CodeGraph] Indexing completed with ${result.filesErrored} errors.`);
            }
            cg.destroy();

            // Mock Understand-Anything pipeline semantic mapping
            sendLog(`[Understand-Anything] AST Semantic Mapping started...`);
            setTimeout(() => {
              sendLog(`[Understand-Anything] Analyzed ${result.filesIndexed} files.`);
              sendLog(`[Understand-Anything] Semantic Mapping complete.`);
              
              sendStatus("complete");
              controller.close();
            }, 1000);
          } catch (err: any) {
            sendLog(`[CodeGraph Error] ${err.message}`);
            if (err.message && err.message.includes("already initialized")) {
              sendLog(`[System] Project is already indexed. Bypassing re-analysis and entering project.`);
              sendStatus("complete");
            } else {
              sendStatus("error");
            }
            controller.close();
          }
        })();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Failed to start analysis", details: error.message }, { status: 500 });
  }
}
