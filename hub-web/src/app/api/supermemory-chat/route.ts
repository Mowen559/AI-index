import { NextResponse } from 'next/server';
import { recordSupermemoryQuery, searchSupermemoryMemories } from '@/lib/supermemory-store';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    const matches = searchSupermemoryMemories(String(message), 5);
    const lines =
      matches.length > 0
        ? matches.map((memory, index) => {
            const tags = memory.tags.length > 0 ? ` [${memory.tags.join(', ')}]` : '';
            return `${index + 1}. ${memory.filePath} (${memory.complexity})${tags}: ${memory.summary}`;
          })
        : ['No relevant stored analysis was found in local supermemory.'];

    const responseText = [
      `Retrieved ${matches.length} supermemory match(es) for: "${message}"`,
      '',
      ...lines,
      '',
      'These results are sourced from Understand-Anything knowledge graph summaries stored in local supermemory.',
    ].join('\n');

    recordSupermemoryQuery(
      String(message),
      responseText,
      matches.map((memory) => memory.id),
    );

    return NextResponse.json({ reply: responseText });
  } catch (error: any) {
    console.error('Error in supermemory-chat:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
