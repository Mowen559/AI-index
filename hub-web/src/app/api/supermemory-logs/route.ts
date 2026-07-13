import { NextResponse } from 'next/server';
import { getSupermemoryStoreSnapshot } from '@/lib/supermemory-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const store = getSupermemoryStoreSnapshot();
    const logs = store.logs.slice(0, 30);
    const stats = {
      ...store.stats,
      totalMemories: store.memories.length,
    };

    return NextResponse.json({ logs, stats });
  } catch (error: any) {
    console.error('Error fetching supermemory logs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
