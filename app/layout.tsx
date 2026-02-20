import type { Metadata } from 'next';
import '@/styles/globals.css';
import Sidebar from '@/components/Sidebar';
import QueryProvider from '@/components/QueryProvider';
import { getAllPosts } from '@/lib/notion';

export const metadata: Metadata = {
  title: {
    default: 'minsu.dev — 개발 블로그',
    template: '%s — minsu.dev',
  },
  description: '개발하며 배운 것들을 기록합니다.',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://minsu.dev',
    siteName: 'minsu.dev',
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const posts = await getAllPosts();

  return (
    <html lang="ko">
      <body>
        <QueryProvider>
          <div className="layout">
            <Sidebar posts={posts} />
            <main className="main-content">{children}</main>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
