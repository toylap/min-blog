import { NextRequest, NextResponse } from 'next/server';
import { getComments, createComment, deleteComment } from '@/lib/notion';

// GET /api/comments?slug=xxx
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

  try {
    return NextResponse.json({ comments: await getComments(slug) });
  } catch (error) {
    console.error('Comments GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// POST /api/comments { postSlug, parentId?, name, password, content }
export async function POST(req: NextRequest) {
  try {
    const { postSlug, parentId, name, password, content } = await req.json();

    if (!postSlug || !name || !password || !content) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });
    }
    if (name.length > 20) {
      return NextResponse.json({ error: '이름은 20자 이내' }, { status: 400 });
    }
    if (content.length > 1000) {
      return NextResponse.json({ error: '내용은 1000자 이내' }, { status: 400 });
    }

    const comment = await createComment({
      postSlug,
      parentId: parentId || undefined,
      name,
      password,
      body: content,
    });
    return NextResponse.json({ comment });
  } catch (error) {
    console.error('Comments POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// DELETE /api/comments { commentId, password }
export async function DELETE(req: NextRequest) {
  try {
    const { commentId, password } = await req.json();
    if (!commentId || !password) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });
    }

    const ok = await deleteComment(commentId, password);
    if (!ok) return NextResponse.json({ error: '비밀번호 불일치' }, { status: 403 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Comments DELETE error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
