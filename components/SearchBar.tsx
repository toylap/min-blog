'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearch } from '@/lib/hooks';

export default function SearchBar() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');

  // 300ms debounce: 타이핑 멈추면 검색
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input), 300);
    return () => clearTimeout(timer);
  }, [input]);

  // Ctrl+K / Cmd+K 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setInput('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const { data: results, isLoading } = useSearch(debounced);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="search-trigger">
        <span>🔍</span>
        <span>검색...</span>
        <kbd>⌘K</kbd>
      </button>
    );
  }

  return (
    <>
      <div className="search-overlay" onClick={() => { setOpen(false); setInput(''); }} />
      <div className="search-modal">
        <div className="search-input-wrap">
          <span>🔍</span>
          <input
            className="search-input"
            placeholder="글 제목으로 검색..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          {input && (
            <button className="search-clear" onClick={() => setInput('')}>
              ✕
            </button>
          )}
        </div>

        <div className="search-results">
          {isLoading && <div className="search-status">검색 중...</div>}

          {!isLoading && debounced.length >= 2 && !results?.length && (
            <div className="search-status">결과가 없습니다</div>
          )}

          {results?.map((post) => (
            <Link
              key={post.id}
              href={`/posts/${post.slug}`}
              className="search-result-item"
              onClick={() => { setOpen(false); setInput(''); }}
            >
              <div className="search-result-title">{post.title}</div>
              <div className="search-result-desc">{post.description}</div>
              <div className="search-result-meta">
                <span>{post.createDt}</span>
                {post.tags.map((t) => (
                  <span key={t}>#{t}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
