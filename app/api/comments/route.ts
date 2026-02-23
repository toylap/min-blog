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

// POST /api/comments { postSlug, parentId?, name, content }
export async function POST(req: NextRequest) {
  try {
    const { postSlug, parentId, name, content } = await req.json();

    if (!postSlug || !name || !content) {
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
      body: content,
    });
    return NextResponse.json({ comment });
  } catch (error) {
    console.error('Comments POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// DELETE /api/comments { commentId }
export async function DELETE(req: NextRequest) {
  try {
    const { commentId } = await req.json();
    if (!commentId) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });
    }

    await deleteComment(commentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Comments DELETE error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
