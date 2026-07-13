import { NextResponse } from "next/server";
import { readLLMSettings, writeLLMSettings } from "@/lib/llm/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ settings: readLLMSettings() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to read LLM settings.";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const settings = writeLLMSettings(body || {});
    return NextResponse.json({ settings });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to persist LLM settings.";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
