import { NextRequest, NextResponse } from 'next/server';
import { getViewCount, incrementView } from '@/lib/notion';

// GET /api/views?slug=xxx
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

  try {
    return NextResponse.json(await getViewCount(slug));
  } catch (error) {
    console.error('Views GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// POST /api/views { slug }
export async function POST(req: NextRequest) {
  try {
    const { slug } = await req.json();
    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });
    return NextResponse.json(await incrementView(slug));
  } catch (error) {
    console.error('Views POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
