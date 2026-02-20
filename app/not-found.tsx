import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="content-wrapper" style={{ paddingTop: 120, textAlign: 'center' }}>
      <div style={{ fontSize: 64 }}>404</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '16px 0' }}>
        페이지를 찾을 수 없습니다
      </h1>
      <Link
        href="/"
        style={{
          display: 'inline-flex',
          padding: '10px 24px',
          background: 'var(--accent)',
          color: '#fff',
          borderRadius: 6,
          fontWeight: 600,
        }}
      >
        홈으로
      </Link>
    </div>
  );
}
