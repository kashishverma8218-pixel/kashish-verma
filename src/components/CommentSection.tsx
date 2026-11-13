import React, { useState } from 'react';
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ArrowUpDown,
  Send,
  Trash2
} from 'lucide-react';
import { Comment } from '../types/video';

interface CommentSectionProps {
  videoId: string;
  comments: Comment[];
  onAddComment: (videoId: string, content: string) => void;
  onLikeComment: (commentId: string) => void;
  onDislikeComment?: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onAddReply: (commentId: string, content: string) => void;
  userAvatar?: string;
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
  onAddReply,
  userAvatar,
  currentUserHandle,
  disabled = false,
}) => {
  const [newCommentText, setNewCommentText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [sortBy, setSortBy] = useState<'top' | 'newest'>('top');
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    onAddComment(videoId, newCommentText.trim());
    setNewCommentText('');
    setIsFocused(false);
  };

  const handleReplySubmit = (commentId: string) => {
    if (!replyText.trim()) return;
    onAddReply(commentId, replyText.trim());
    setReplyText('');
    setReplyingCommentId(null);
    setExpandedReplies((prev) => ({ ...prev, [commentId]: true }));
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  // Sort comments
  const sortedComments = [...comments].sort((a, b) => {
    if (sortBy === 'top') {
      return b.likes - a.likes;
    }
    return 0; // maintain newest insertion order
  });

  if (disabled) {
    return (
      <section className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-6 text-center text-slate-500 dark:text-slate-400">
          <MessageSquare className="h-6 w-6 mx-auto mb-2 text-slate-400 opacity-60" />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Comments are turned off</p>
          <p className="text-[11px] text-slate-400 mt-0.5">The creator has disabled comments for this video.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
      {/* Header Row: Total count & Sort toggle */}
      <div className="flex items-center gap-6 mb-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {comments.length} Comments
        </h3>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <ArrowUpDown className="h-4 w-4 text-slate-400" />
          <button
            onClick={() => setSortBy(sortBy === 'top' ? 'newest' : 'top')}
            className="hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Sort by: <span className="underline decoration-slate-400">{sortBy === 'top' ? 'Top comments' : 'Newest first'}</span>
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
            placeholder="Add a comment..."
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            onFocus={() => setIsFocused(true)}
            className="w-full resize-none border-b-2 border-slate-200 bg-transparent py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:text-white dark:focus:border-sky-400 transition-all"
          />

          {(isFocused || newCommentText) && (
            <div className="mt-2 flex items-center justify-end gap-2 animate-in fade-in duration-150">
              <button
                type="button"
                onClick={() => {
                  setNewCommentText('');
                  setIsFocused(false);
                }}
                className="rounded-full px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newCommentText.trim()}
                className="flex items-center gap-1.5 rounded-full bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
        {sortedComments.map((comment) => (
          <div key={comment.id} className="flex items-start gap-3 sm:gap-4 group">
            {/* Commenter Avatar */}
            <img
              src={comment.authorAvatar}
              alt={comment.authorName}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.opacity = '0.4';
              }}
              className="h-10 w-10 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
            />

            <div className="flex-1 min-w-0">
              {/* Header: Name, Handle & Timestamp */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {comment.authorName}
                </span>
                <span className="text-[11px] text-slate-400">
                  {comment.authorHandle}
                </span>
                <span aria-hidden="true" className="text-slate-400 text-xs">·</span>
                <span className="text-[11px] text-slate-400">
                  {comment.timestamp}
                </span>
              </div>

              {/* Comment Content */}
              <p className="mt-1 text-sm text-slate-800 dark:text-slate-200 leading-relaxed break-words">
                {comment.content}
              </p>

              {/* Reaction & Reply Actions */}
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  onClick={() => onLikeComment(comment.id)}
                  className={`min-h-[36px] px-1.5 flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer ${
                    comment.userLiked ? 'text-[var(--accent-ink)] font-semibold' : ''
                  }`}
                >
                  <ThumbsUp className={`h-3.5 w-3.5 ${comment.userLiked ? 'fill-current' : ''}`} />
                  <span>{comment.likes}</span>
                </button>

                <button
                  type="button"
                  title="Dislike"
                  aria-label="Dislike comment"
                  onClick={() => onDislikeComment?.(comment.id)}
                  className={`min-h-[36px] min-w-[36px] flex items-center justify-center hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer ${
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
                  className="min-h-[36px] px-2 font-semibold text-slate-700 hover:text-[var(--accent-ink)] dark:text-slate-300 transition-colors cursor-pointer"
                >
                  Reply
                </button>

                {onDeleteComment &&
                  (comment.authorHandle === (currentUserHandle || '@creative_viewer') ||
                    comment.id.startsWith('c-')) && (
                    <button
                      type="button"
                      title="Delete comment"
                      aria-label="Delete comment"
                      onClick={() => onDeleteComment(comment.id)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors cursor-pointer ml-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
              </div>

              {/* Reply Input Box */}
              {replyingCommentId === comment.id && (
                <div className="mt-3 flex flex-wrap sm:flex-nowrap items-center gap-2 pl-2 sm:pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                  <input
                    type="text"
                    placeholder={`Reply to ${comment.authorHandle}...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleReplySubmit(comment.id)}
                    className="flex-1 min-w-[160px] min-h-[40px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-base sm:text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleReplySubmit(comment.id)}
                      className="min-h-[38px] rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 transition-colors cursor-pointer"
                    >
                      Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyingCommentId(null)}
                      className="min-h-[38px] rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
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
                    className="min-h-[36px] flex items-center gap-1.5 text-xs font-semibold text-sky-500 hover:text-sky-400 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>
                      {expandedReplies[comment.id]
                        ? `Hide ${comment.replies.length} ${comment.replies.length === 1 ? 'reply' : 'replies'}`
                        : `Show ${comment.replies.length} ${comment.replies.length === 1 ? 'reply' : 'replies'}`}
                    </span>
                  </button>

                  {expandedReplies[comment.id] && (
                    <div className="mt-3 space-y-3 pl-3 sm:pl-6 border-l-2 border-slate-200 dark:border-slate-800">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="flex items-start gap-3">
                          <img
                            src={reply.authorAvatar}
                            alt={reply.authorName}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.style.opacity = '0.4';
                            }}
                            className="h-7 w-7 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {reply.authorName}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {reply.authorHandle}
                              </span>
                              <span aria-hidden="true" className="text-slate-400 text-xs">·</span>
                              <span className="text-[10px] text-slate-400">
                                {reply.timestamp}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
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
        ))}
      </div>
    </section>
  );
};
