'use client';

import { useLikes, useToggleLike } from '@/lib/hooks';

export default function LikeButton({ postSlug }: { postSlug: string }) {
  const { data, isLoading } = useLikes(postSlug);
  const toggle = useToggleLike();

  return (
    <button
      className={`like-button ${data?.liked ? 'liked' : ''}`}
      onClick={() => toggle.mutate(postSlug)}
      disabled={isLoading || toggle.isPending}
      aria-label="좋아요"
    >
      <span className="like-icon">{data?.liked ? '❤️' : '🤍'}</span>
      <span className="like-count">{data?.count ?? 0}</span>
    </button>
  );
}
