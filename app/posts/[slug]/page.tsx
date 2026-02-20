import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllPosts, getPostBySlug } from '@/lib/notion';
import Comments from '@/components/Comments';
import LikeButton from '@/components/LikeButton';
import ViewCounter from '@/components/ViewCounter';

export const revalidate = 60;

// SSG: 빌드 타임에 모든 글 경로 생성
export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: '글을 찾을 수 없습니다' };

  return {
    title: post.title,
    description: post.description,
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      tags: post.tags,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const date = new Date(post.date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="content-wrapper" style={{ paddingTop: 60, paddingBottom: 40 }}>
      <Link href="/" className="back-link">
        ← 목록으로
      </Link>

      {/* 헤더 */}
      <header className="post-detail-header">
        <div className="post-item-meta" style={{ marginBottom: 14 }}>
          <time className="post-item-date" dateTime={post.date}>
            {date}
          </time>
          {post.tags.map((t) => (
            <span key={t} className="post-item-tag">
              {t}
            </span>
          ))}
        </div>
        <h1>{post.title}</h1>
        <p className="desc">{post.description}</p>

        {/* 조회수 + 좋아요 */}
        <div className="post-stats">
          <ViewCounter postSlug={post.slug} />
          <LikeButton postSlug={post.slug} />
        </div>
      </header>

      {/* 본문 */}
      <article
        className="md-body"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      {/* 하단 좋아요 */}
      <div className="post-bottom-like">
        <p>이 글이 도움이 되셨다면</p>
        <LikeButton postSlug={post.slug} />
      </div>

      {/* 댓글 */}
      <Comments postSlug={post.slug} />
    </div>
  );
}
