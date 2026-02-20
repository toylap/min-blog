import Link from 'next/link';
import type { Post } from '@/lib/notion';

export default function PostCard({ post }: { post: Post }) {
  const date = new Date(post.createDt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Link href={`/posts/${post.slug}`} className="post-item">
      <div className="post-item-meta">
        <time className="post-item-date" dateTime={post.createDt}>
          {date}
        </time>
        {post.category && (
          <span className="post-item-tag">{post.category}</span>
        )}
      </div>
      <h2 className="post-item-title">
        <span>{post.title}</span>
        <span className="post-item-arrow">→</span>
      </h2>
      <p className="post-item-desc">{post.description}</p>
      <div className="post-item-tags">
        {post.tags.map((t) => (
          <span key={t}>#{t}</span>
        ))}
      </div>
    </Link>
  );
}
