import { NextRequest, NextResponse } from 'next/server';
import { searchPosts } from '@/lib/notion';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ posts: [] });

  try {
    const posts = await searchPosts(q);
    return NextResponse.json({ posts });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
