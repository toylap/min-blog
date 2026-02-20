'use client';

import { useEffect, useRef } from 'react';
import { useViewCount, useIncrementView } from '@/lib/hooks';

export default function ViewCounter({ postSlug }: { postSlug: string }) {
  const { data } = useViewCount(postSlug);
  const increment = useIncrementView();
  const called = useRef(false);

  // 페이지 진입 시 1회만 조회수 +1
  useEffect(() => {
    if (!called.current) {
      called.current = true;
      increment.mutate(postSlug);
    }
  }, [postSlug]);

  return <span className="view-counter">👁 {data?.count ?? 0}</span>;
}
