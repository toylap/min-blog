import { NextRequest, NextResponse } from 'next/server';
import { getLikeStatus, toggleLike } from '@/lib/notion';
import { createHash } from 'crypto';

// IP + User-Agent 해시 → 사용자 식별 (로그인 없이 중복 방지)
function getUserHash(req: NextRequest): string {
  const ip =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const ua = req.headers.get('user-agent') || '';
  return createHash('sha256')
    .update(`${ip}:${ua}`)
    .digest('hex')
    .slice(0, 16);
}

// GET /api/likes?slug=xxx
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

  try {
    return NextResponse.json(await getLikeStatus(slug, getUserHash(req)));
  } catch (error) {
    console.error('Likes GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// POST /api/likes { slug }
export async function POST(req: NextRequest) {
  try {
    const { slug } = await req.json();
    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });
    return NextResponse.json(await toggleLike(slug, getUserHash(req)));
  } catch (error) {
    console.error('Likes POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
