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
        <div className="hero-label">🔥 MinLog</div>
        <h1>
          Developer MinLog
        </h1>
        <p>
          항상 배움에 감사합니다.
          <br/>
          틀린 부분과 좋은 방향이 있다면 적극적으로 의견을 주세요.
        </p>
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
        <span>© 2026 toylap.me</span>
      </footer>
    </div>
  );
}
