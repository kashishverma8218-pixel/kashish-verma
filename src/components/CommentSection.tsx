import React, { useState } from 'react';
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ArrowUpDown,
  Send,
  Trash2,
  Pin,
  Pencil,
  Check,
  X
} from 'lucide-react';
import { Comment } from '../types/video';

interface CommentSectionProps {
  videoId: string;
  comments: Comment[];
  onAddComment: (videoId: string, content: string) => void;
  onLikeComment: (commentId: string) => void;
  onDislikeComment?: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onEditComment?: (commentId: string, content: string) => void;
  onPinComment?: (commentId: string) => void;
  canPinComments?: boolean;
  onAddReply: (commentId: string, content: string) => void;
  userAvatar?: string;
  currentUserId?: string;
  currentUserHandle?: string;
  disabled?: boolean;
}

const DEFAULT_COMMENT_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';

export const CommentSection: React.FC<CommentSectionProps> = ({
  videoId,
  comments,
  onAddComment,
  onLikeComment,
  onDislikeComment,
  onDeleteComment,
  onEditComment,
  onPinComment,
  canPinComments = false,
  onAddReply,
  userAvatar,
  currentUserId,
  currentUserHandle,
  disabled = false,
}) => {
  const [newCommentText, setNewCommentText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [sortBy, setSortBy] = useState<'top' | 'newest'>('top');
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCommentText.trim().slice(0, 2000);
    if (!trimmed) return;
    onAddComment(videoId, trimmed);
    setNewCommentText('');
    setIsFocused(false);
  };

  const handleReplySubmit = (commentId: string) => {
    const trimmed = replyText.trim().slice(0, 2000);
    if (!trimmed) return;
    onAddReply(commentId, trimmed);
    setReplyText('');
    setReplyingCommentId(null);
    setExpandedReplies((prev) => ({ ...prev, [commentId]: true }));
  };

  const handleEditSave = (commentId: string) => {
    const trimmed = editingText.trim().slice(0, 2000);
    if (!trimmed || !onEditComment) return;
    onEditComment(commentId, trimmed);
    setEditingCommentId(null);
    setEditingText('');
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  // Sort pinned comments first, then by Top or Newest
  const sortedComments = [...comments].sort((a, b) => {
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
      return a.isPinned ? -1 : 1;
    }
    if (sortBy === 'top') {
      if (b.likes !== a.likes) return b.likes - a.likes;
      return (b.createdAt || 0) - (a.createdAt || 0);
    }
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  if (disabled) {
    return (
      <section className="mt-8 pt-6 border-t border-[var(--ink-faint)]">
        <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-6 text-center text-[var(--ink-medium)]">
          <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-60" />
          <p className="text-xs font-bold text-[var(--ink)]">Comments are turned off</p>
          <p className="text-[11px] text-[var(--ink-medium)] mt-0.5">The creator has disabled comments for this video.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 pt-6 border-t border-[var(--ink-faint)]">
      {/* Header Row: Total count & Sort toggle */}
      <div className="flex items-center gap-6 mb-6">
        <h3 className="text-lg font-bold text-[var(--ink)] tabular-nums">
          {comments.length} Comments
        </h3>

        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ink-medium)]">
          <ArrowUpDown className="h-4 w-4" />
          <button
            type="button"
            onClick={() => setSortBy(sortBy === 'top' ? 'newest' : 'top')}
            className="hover:text-[var(--ink)] transition-colors cursor-pointer"
          >
            Sort by: <span className="underline decoration-[var(--ink-faint)]">{sortBy === 'top' ? 'Top comments' : 'Newest first'}</span>
          </button>
        </div>
      </div>

      {/* Add New Comment Box */}
      <div className="flex items-start gap-3 sm:gap-4 mb-8">
        <img
          src={userAvatar || DEFAULT_COMMENT_AVATAR}
          alt="Your profile"
          referrerPolicy="no-referrer"
          onError={(e) => {
            if (e.currentTarget.src !== DEFAULT_COMMENT_AVATAR) {
              e.currentTarget.src = DEFAULT_COMMENT_AVATAR;
            }
          }}
          className="h-10 w-10 rounded-full object-cover shrink-0 ring-1 ring-[var(--ink-faint)]"
        />

        <form onSubmit={handleCommentSubmit} className="flex-1 min-w-0">
          <textarea
            rows={isFocused || newCommentText ? 3 : 1}
            maxLength={2000}
            placeholder="Add a comment..."
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            onFocus={() => setIsFocused(true)}
            className="w-full resize-none border-b-2 border-[var(--ink-faint)] bg-transparent py-1.5 text-base sm:text-sm text-[var(--ink)] placeholder:text-[var(--ink-medium)] focus:border-[var(--ink)] focus:outline-none transition-all"
          />

          {(isFocused || newCommentText) && (
            <div className="mt-2 flex items-center justify-end gap-2 animate-in fade-in duration-150">
              <button
                type="button"
                onClick={() => {
                  setNewCommentText('');
                  setIsFocused(false);
                }}
                className="min-h-[36px] rounded-full px-4 py-1.5 text-xs font-semibold text-[var(--ink-medium)] hover:bg-[var(--card-hover)] hover:text-[var(--ink)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newCommentText.trim()}
                className="min-h-[36px] flex items-center gap-1.5 rounded-full bg-[#065FD4] dark:bg-[#3EA6FF] px-4 py-1.5 text-xs font-semibold text-white dark:text-[#0F0F0F] shadow-xs hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <Send className="h-3 w-3" />
                <span>Comment</span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Comments List */}
      <div className="space-y-6">
        {sortedComments.map((comment) => {
          const isOwnComment =
            (Boolean(currentUserId && comment.userId === currentUserId)) ||
            (!comment.userId && comment.authorHandle === (currentUserHandle || '@creative_viewer'));
          const isEditing = editingCommentId === comment.id;

          return (
            <div key={comment.id} className="flex items-start gap-3 sm:gap-4 group">
              {/* Commenter Avatar */}
              <img
                src={comment.authorAvatar}
                alt={comment.authorName}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  if (e.currentTarget.src !== DEFAULT_COMMENT_AVATAR) {
                    e.currentTarget.src = DEFAULT_COMMENT_AVATAR;
                  }
                }}
                className="h-10 w-10 rounded-full object-cover shrink-0 ring-1 ring-[var(--ink-faint)]"
              />

              <div className="flex-1 min-w-0">
                {comment.isPinned && (
                  <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-[var(--ink-medium)]">
                    <Pin className="h-3 w-3 text-[var(--accent-ink)]" />
                    <span>Pinned by creator</span>
                  </div>
                )}

                {/* Header: Name, Handle & Timestamp */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[var(--ink)]">
                    {comment.authorName}
                  </span>
                  <span className="text-[11px] text-[var(--ink-medium)]">
                    {comment.authorHandle}
                  </span>
                  <span aria-hidden="true" className="text-[var(--ink-medium)] text-xs">·</span>
                  <span className="text-[11px] text-[var(--ink-medium)]">
                    {comment.timestamp}
                  </span>
                  {comment.isEdited && (
                    <span className="text-[10px] text-[var(--ink-medium)] italic">(edited)</span>
                  )}
                </div>

                {/* Comment Content or Inline Editor */}
                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      rows={2}
                      maxLength={2000}
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="w-full resize-none rounded-xl border border-[var(--ink-faint)] bg-[var(--surface)] p-2.5 text-base sm:text-sm text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCommentId(null);
                          setEditingText('');
                        }}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--ink-medium)] hover:bg-[var(--card-hover)] hover:text-[var(--ink)] cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                        <span>Cancel</span>
                      </button>
                      <button
                        type="button"
                        disabled={!editingText.trim()}
                        onClick={() => handleEditSave(comment.id)}
                        className="inline-flex items-center gap-1 rounded-full bg-[#065FD4] dark:bg-[#3EA6FF] px-3.5 py-1.5 text-xs font-semibold text-white dark:text-[#0F0F0F] hover:opacity-90 disabled:opacity-40 cursor-pointer"
                      >
                        <Check className="h-3 w-3" />
                        <span>Save</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-[var(--ink)]/90 leading-relaxed break-words">
                    {comment.content}
                  </p>
                )}

                {/* Reaction, Reply, Pin, Edit & Delete Actions */}
                <div className="mt-2 flex items-center gap-2 sm:gap-3 text-xs text-[var(--ink-medium)]">
                  <button
                    type="button"
                    onClick={() => onLikeComment(comment.id)}
                    className={`min-h-[36px] px-1.5 flex items-center gap-1.5 hover:text-[var(--ink)] transition-colors cursor-pointer ${
                      comment.userLiked ? 'text-[var(--accent-ink)] font-semibold' : ''
                    }`}
                  >
                    <ThumbsUp className={`h-3.5 w-3.5 ${comment.userLiked ? 'fill-current' : ''}`} />
                    <span className="tabular-nums">{comment.likes}</span>
                  </button>

                  <button
                    type="button"
                    title="Dislike"
                    aria-label="Dislike comment"
                    onClick={() => onDislikeComment?.(comment.id)}
                    className={`min-h-[36px] min-w-[36px] flex items-center justify-center hover:text-[var(--ink)] transition-colors cursor-pointer ${
                      comment.userDisliked ? 'text-rose-500' : ''
                    }`}
                  >
                    <ThumbsDown className={`h-3.5 w-3.5 ${comment.userDisliked ? 'fill-current' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReplyingCommentId(replyingCommentId === comment.id ? null : comment.id);
                    }}
                    className="min-h-[36px] px-2 font-semibold text-[var(--ink)] hover:text-[var(--accent-ink)] transition-colors cursor-pointer"
                  >
                    Reply
                  </button>

                  <div className="ml-auto flex items-center gap-1">
                    {canPinComments && onPinComment && (
                      <button
                        type="button"
                        title={comment.isPinned ? 'Unpin comment' : 'Pin comment'}
                        aria-label={comment.isPinned ? 'Unpin comment' : 'Pin comment'}
                        onClick={() => onPinComment(comment.id)}
                        className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                          comment.isPinned
                            ? 'text-[var(--accent-ink)] bg-[#FF0000]/10'
                            : 'text-[var(--ink-medium)] hover:text-[var(--ink)] hover:bg-[var(--card-hover)]'
                        }`}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {isOwnComment && onEditComment && !isEditing && (
                      <button
                        type="button"
                        title="Edit comment"
                        aria-label="Edit comment"
                        onClick={() => {
                          setEditingCommentId(comment.id);
                          setEditingText(comment.content);
                        }}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--ink-medium)] hover:text-[var(--ink)] hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {onDeleteComment && isOwnComment && (
                      <button
                        type="button"
                        title="Delete comment"
                        aria-label="Delete comment"
                        onClick={() => onDeleteComment(comment.id)}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--ink-medium)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Reply Input Box */}
                {replyingCommentId === comment.id && (
                  <div className="mt-3 flex flex-wrap sm:flex-nowrap items-center gap-2 pl-2 sm:pl-4 border-l-2 border-[var(--ink-faint)]">
                    <input
                      type="text"
                      maxLength={2000}
                      placeholder={`Reply to ${comment.authorHandle}...`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleReplySubmit(comment.id)}
                      className="flex-1 min-w-[160px] min-h-[40px] rounded-lg border border-[var(--ink-faint)] bg-[var(--surface)] px-3 py-1.5 text-base sm:text-xs text-[var(--ink)] placeholder:text-[var(--ink-medium)] focus:border-[var(--ink)] focus:outline-none"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleReplySubmit(comment.id)}
                        className="min-h-[38px] rounded-full bg-[#065FD4] dark:bg-[#3EA6FF] px-3.5 py-1.5 text-xs font-semibold text-white dark:text-[#0F0F0F] hover:opacity-90 transition-colors cursor-pointer"
                      >
                        Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyingCommentId(null)}
                        className="min-h-[38px] rounded-full px-2.5 py-1.5 text-xs text-[var(--ink-medium)] hover:text-[var(--ink)] hover:bg-[var(--card-hover)] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Replies Toggle & List */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => toggleReplies(comment.id)}
                      className="min-h-[36px] flex items-center gap-1.5 text-xs font-semibold text-[var(--link)] hover:opacity-85 transition-opacity cursor-pointer"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>
                        {expandedReplies[comment.id]
                          ? `Hide ${comment.replies.length} ${comment.replies.length === 1 ? 'reply' : 'replies'}`
                          : `Show ${comment.replies.length} ${comment.replies.length === 1 ? 'reply' : 'replies'}`}
                      </span>
                    </button>

                    {expandedReplies[comment.id] && (
                      <div className="mt-3 space-y-3 pl-3 sm:pl-6 border-l-2 border-[var(--ink-faint)]">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="flex items-start gap-3">
                            <img
                              src={reply.authorAvatar}
                              alt={reply.authorName}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                if (e.currentTarget.src !== DEFAULT_COMMENT_AVATAR) {
                                  e.currentTarget.src = DEFAULT_COMMENT_AVATAR;
                                }
                              }}
                              className="h-7 w-7 rounded-full object-cover shrink-0 ring-1 ring-[var(--ink-faint)]"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-[var(--ink)]">
                                  {reply.authorName}
                                </span>
                                <span className="text-[10px] text-[var(--ink-medium)]">
                                  {reply.authorHandle}
                                </span>
                                <span aria-hidden="true" className="text-[var(--ink-medium)] text-xs">·</span>
                                <span className="text-[10px] text-[var(--ink-medium)]">
                                  {reply.timestamp}
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs text-[var(--ink)]/85 leading-relaxed break-words">
                                {reply.content}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
