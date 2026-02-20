import { getAllPosts } from '@/lib/notion';
import PostCard from '@/components/PostCard';

export const revalidate = 60; // 60초마다 재빌드 (ISR)

interface Props {
  searchParams: Promise<{ category?: string; tag?: string }>;
}

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const allPosts = await getAllPosts();

  let posts = allPosts;
  let label = '전체 글';

  if (params.category) {
    posts = allPosts.filter((p) => p.category === params.category);
    label = params.category;
  } else if (params.tag) {
    posts = allPosts.filter((p) => p.tags.includes(params.tag!));
    label = `#${params.tag}`;
  }

  return (
    <div className="content-wrapper">
      <section className="hero">
        <div className="hero-label">🔥 Notion API 기반 블로그</div>
        <h1>
          Code, <span className="highlight">Think</span>, Write.
        </h1>
        <p>개발하며 배운 것들을 기록합니다.</p>
      </section>

      <section>
        <div className="section-header">
          <span className="section-title">{label}</span>
          <span className="post-count">{posts.length} posts</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {posts.length > 0 ? (
            posts.map((p, i) => (
              <div
                key={p.id}
                className="animate-in"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <PostCard post={p} />
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
              <p style={{ color: 'var(--text-tertiary)' }}>글이 없습니다.</p>
            </div>
          )}
        </div>
      </section>

      <footer className="main-footer">
        <span>© 2026 minsu.dev</span>
      </footer>
    </div>
  );
}
