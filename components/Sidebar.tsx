'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SearchBar from './SearchBar';
import type { Post } from '@/lib/notion';

export default function Sidebar({ posts }: { posts: Post[] }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);

  // 페이지 이동 시 모바일 사이드바 닫기
  useEffect(() => {
    close();
  }, [pathname]);

  // 카테고리별 글 수 집계
  const categories: Record<string, number> = {};
  posts.forEach((p) => {
    const cat = p.category || '기타';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  return (
    <>
      {/* 모바일 헤더 */}
      <div className="mobile-header">
        <button className="hamburger" onClick={() => setIsOpen(!isOpen)}>
          ☰
        </button>
        <Link href="/" style={{ fontWeight: 700, fontSize: 15 }}>
          toylap.me
        </Link>
        <div style={{ width: 36 }} />
      </div>

      {/* 모바일 오버레이 */}
      <div
        className={`sidebar-overlay ${isOpen ? 'show' : ''}`}
        onClick={close}
      />

      {/* 사이드바 */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link href="/" className="sidebar-logo" onClick={close}>
            <div className="sidebar-logo-icon">M</div>
            <div className="sidebar-logo-text">
              toylap.me
              <small>Notion Powered Blog</small>
            </div>
          </Link>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-search">
            <SearchBar />
          </div>

          <div className="nav-section-title">메뉴</div>
          <Link
            href="/"
            className={`nav-item ${pathname === '/' ? 'active' : ''}`}
            onClick={close}
          >
            <span className="nav-icon">📋</span>전체 글
            <span className="nav-count">{posts.length}</span>
          </Link>

          <div className="nav-section-title">카테고리</div>
          {Object.entries(categories).map(([cat, count]) => (
            <Link
              key={cat}
              href={`/?category=${encodeURIComponent(cat)}`}
              className="nav-item"
              onClick={close}
            >
              <span className="nav-icon">📂</span>
              {cat}
              <span className="nav-count">{count}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
