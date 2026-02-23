'use client';

import { useState } from 'react';
import { useComments, useCreateComment, useDeleteComment } from '@/lib/hooks';
import type { Comment } from '@/lib/notion';

export default function Comments({ postSlug }: { postSlug: string }) {
  const { data: comments, isLoading } = useComments(postSlug);
  const total =
    comments?.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0) || 0;

  return (
    <section className="comments-section">
      <h3 className="comments-title">
        💬 댓글 <span className="comments-count">{total}</span>
      </h3>

      <CommentForm postSlug={postSlug} />

      {isLoading && <p className="comments-loading">불러오는 중...</p>}

      <div className="comment-list">
        {comments?.map((c) => (
          <CommentItem key={c.id} comment={c} postSlug={postSlug} />
        ))}

        {!isLoading && !comments?.length && (
          <p className="comments-empty">첫 댓글을 남겨보세요!</p>
        )}
      </div>
    </section>
  );
}

// ===== 댓글 입력 폼 =====

function CommentForm({
  postSlug,
  parentId,
  onCancel,
}: {
  postSlug: string;
  parentId?: string;
  onCancel?: () => void;
}) {
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const create = useCreateComment();

  const submit = () => {
    if (!name.trim() || !body.trim()) return;
    create.mutate(
      {
        postSlug,
        parentId,
        name: name.trim(),
        content: body.trim(),
      },
      {
        onSuccess: () => {
          setName('');
          setBody('');
          onCancel?.();
        },
      }
    );
  };

  return (
    <div className={`comment-form ${parentId ? 'comment-form-reply' : ''}`}>
      <div className="comment-form-row">
        <input
          className="comment-input"
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
        />
      </div>
      <textarea
        className="comment-input comment-textarea"
        placeholder={parentId ? '답글 작성...' : '댓글을 남겨주세요...'}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={1000}
      />
      <div className="comment-form-actions">
        {onCancel && (
          <button className="btn-cancel" onClick={onCancel}>
            취소
          </button>
        )}
        <button
          className="btn-submit"
          onClick={submit}
          disabled={create.isPending}
        >
          {create.isPending ? '등록 중...' : parentId ? '답글 등록' : '등록'}
        </button>
      </div>
    </div>
  );
}

// ===== 댓글 아이템 (대댓글 포함) =====

function CommentItem({
  comment,
  postSlug,
}: {
  comment: Comment;
  postSlug: string;
}) {
  const [showReply, setShowReply] = useState(false);
  const [showDel, setShowDel] = useState(false);
  const del = useDeleteComment();

  const dateStr = new Date(comment.createDt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleDelete = () => {
    del.mutate(
      { commentId: comment.id, postSlug },
      {
        onSuccess: () => {
          setShowDel(false);
        },
      }
    );
  };

  return (
    <div className="comment-item">
      <div className="comment-header">
        <div className="comment-avatar">{comment.name[0]}</div>
        <span className="comment-author">{comment.name}</span>
        <span className="comment-time">{dateStr}</span>
      </div>
      <div className="comment-body">{comment.body}</div>
      <div className="comment-actions">
        <button
          className="comment-action-btn"
          onClick={() => setShowReply(!showReply)}
        >
          ↩ 답글
        </button>
        <button
          className="comment-action-btn"
          onClick={() => setShowDel(!showDel)}
        >
          🗑 삭제
        </button>
      </div>

      {/* 삭제 확인 */}
      {showDel && (
        <div className="comment-delete-form">
          <button
            className="btn-del"
            onClick={handleDelete}
            disabled={del.isPending}
          >
            {del.isPending ? '삭제 중...' : '삭제 확인'}
          </button>
          <button className="btn-cancel" onClick={() => setShowDel(false)}>
            취소
          </button>
        </div>
      )}

      {/* 답글 폼 */}
      {showReply && (
        <CommentForm
          postSlug={postSlug}
          parentId={comment.id}
          onCancel={() => setShowReply(false)}
        />
      )}

      {/* 대댓글 목록 */}
      {comment.replies?.map((r) => (
        <div key={r.id} className="comment-item reply-item">
          <div className="comment-header">
            <div className="comment-avatar reply-avatar">{r.name[0]}</div>
            <span className="comment-author">{r.name}</span>
            <span className="comment-time">
              {new Date(r.createDt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <div className="comment-body">{r.body}</div>
        </div>
      ))}
    </div>
  );
}
