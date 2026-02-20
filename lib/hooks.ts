import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Post, Comment, LikeStatus, ViewCount } from '@/lib/notion';

// ============================================================
// 실시간 검색
// ============================================================

export function useSearch(query: string) {
  return useQuery<Post[]>({
    queryKey: ['search', query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      return data.posts || [];
    },
    enabled: query.length >= 2,
    staleTime: 60_000,
  });
}

// ============================================================
// 댓글
// ============================================================

export function useComments(postSlug: string) {
  return useQuery<Comment[]>({
    queryKey: ['comments', postSlug],
    queryFn: async () => {
      const res = await fetch(`/api/comments?slug=${encodeURIComponent(postSlug)}`);
      const data = await res.json();
      return data.comments || [];
    },
    staleTime: 15_000,
  });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      postSlug: string;
      parentId?: string;
      name: string;
      password: string;
      content: string;
    }) => {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('댓글 등록 실패');
      return res.json();
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['comments', v.postSlug] });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { commentId: string; password: string; postSlug: string }) => {
      const res = await fetch('/api/comments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '삭제 실패');
      }
      return res.json();
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['comments', v.postSlug] });
    },
  });
}

// ============================================================
// 좋아요 (낙관적 업데이트)
// ============================================================

export function useLikes(postSlug: string) {
  return useQuery<LikeStatus>({
    queryKey: ['likes', postSlug],
    queryFn: async () => {
      const res = await fetch(`/api/likes?slug=${encodeURIComponent(postSlug)}`);
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      return res.json() as Promise<LikeStatus>;
    },
    // 낙관적 업데이트: 클릭 즉시 UI 반영, 실패 시 롤백
    onMutate: async (slug) => {
      await qc.cancelQueries({ queryKey: ['likes', slug] });
      const prev = qc.getQueryData<LikeStatus>(['likes', slug]);
      if (prev) {
        qc.setQueryData<LikeStatus>(['likes', slug], {
          ...prev,
          liked: !prev.liked,
          count: prev.liked ? prev.count - 1 : prev.count + 1,
        });
      }
      return { prev };
    },
    onError: (_, slug, ctx) => {
      if (ctx?.prev) qc.setQueryData(['likes', slug], ctx.prev);
    },
    onSettled: (_, __, slug) => {
      qc.invalidateQueries({ queryKey: ['likes', slug] });
    },
  });
}

// ============================================================
// 조회수
// ============================================================

export function useViewCount(postSlug: string) {
  return useQuery<ViewCount>({
    queryKey: ['views', postSlug],
    queryFn: async () => {
      const res = await fetch(`/api/views?slug=${encodeURIComponent(postSlug)}`);
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useIncrementView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch('/api/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      return res.json();
    },
    onSuccess: (data, slug) => {
      qc.setQueryData(['views', slug], data);
    },
  });
}
