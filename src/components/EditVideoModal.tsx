import React, { useState, useEffect, useRef } from 'react';
import { X, Edit3, Save, Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { VideoItem } from '../types/video';
import { CATEGORIES } from '../data/mockData';
import { uploadImageAsset } from '../services/firebaseDatabaseService';

interface EditVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoItem;
  onSave: (updated: VideoItem) => void;
}

export const EditVideoModal: React.FC<EditVideoModalProps> = ({
  isOpen,
  onClose,
  video,
  onSave,
}) => {
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description);
  const [category, setCategory] = useState(video.category || 'Animation');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>(video.visibility || 'public');
  const [poster, setPoster] = useState(video.poster);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(video.tags || []);
  const [isUploadingThumb, setIsUploadingThumb] = useState(false);
  const [thumbStatus, setThumbStatus] = useState<string | null>(null);
  const [thumbError, setThumbError] = useState<string | null>(null);

  const thumbInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && video) {
      setTitle(video.title);
      setDescription(video.description || '');
      setCategory(video.category || 'Animation');
      setVisibility(video.visibility || 'public');
      setPoster(video.poster || '');
      setTags(video.tags || []);
      setThumbStatus(null);
      setThumbError(null);
    }
  }, [isOpen, video]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleThumbFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setThumbError(null);
    setThumbStatus(null);
    setIsUploadingThumb(true);
    try {
      const result = await uploadImageAsset(file, 'thumbnails', (pct) => {
        setThumbStatus(`Uploading thumbnail: ${pct}%`);
      });
      setPoster(result.url);
      setThumbStatus(
        result.storage === 'cloud'
          ? 'Thumbnail uploaded to cloud storage. Click Save Changes to apply.'
          : 'Thumbnail prepared locally. Click Save Changes to apply.'
      );
    } catch (err: any) {
      setThumbError(err?.message || 'Could not process thumbnail image.');
    } finally {
      setIsUploadingThumb(false);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = tagInput.trim().replace(/^#/, '');
      if (trimmed && !tags.includes(trimmed)) {
        setTags([...tags, trimmed]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      ...video,
      title: title.trim(),
      description: description.trim(),
      category,
      visibility,
      poster: poster.trim() || video.poster,
      tags,
    });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6 shadow-2xl transition-colors max-h-[92vh] overflow-y-auto text-[var(--ink)]"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[var(--ink-faint)]">
          <div className="flex items-center gap-2.5">
            <Edit3 className="h-5 w-5 text-[var(--accent-ink)]" />
            <h3 className="text-base font-bold text-[var(--ink)]">
              Edit Video Details
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--ink-medium)] hover:bg-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-1">
              Title ({title.length}/100)
            </label>
            <input
              type="text"
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2.5 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3 py-2 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
              >
                {CATEGORIES.filter((c) => c !== 'All' && c !== 'Recently Uploaded').map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                Visibility
              </label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="w-full min-h-[44px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3 py-2 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
              >
                <option value="public">Public (Everyone can see)</option>
                <option value="unlisted">Unlisted (Anyone with link)</option>
                <option value="private">Private (Only you)</option>
              </select>
            </div>
          </div>

          {/* Video Thumbnail Preview + File Upload + URL */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="block text-xs font-bold text-[var(--ink)]">
                Video Thumbnail / Cover
              </label>
              <button
                type="button"
                onClick={() => thumbInputRef.current?.click()}
                disabled={isUploadingThumb}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[#FF0000] transition-colors cursor-pointer"
              >
                {isUploadingThumb ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                <span>{isUploadingThumb ? 'Uploading...' : 'Upload Thumbnail'}</span>
              </button>
              <input
                ref={thumbInputRef}
                type="file"
                accept="image/*"
                onChange={handleThumbFileChange}
                className="hidden"
              />
            </div>

            {poster && (
              <div className="mb-2 aspect-video w-full max-w-[240px] overflow-hidden rounded-xl border border-[var(--ink-faint)] bg-black">
                <img
                  src={poster}
                  alt="Thumbnail preview"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.opacity = '0.35';
                  }}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            {thumbError && (
              <div className="mb-2 flex items-center gap-1.5 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-500 border border-rose-500/20">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{thumbError}</span>
              </div>
            )}

            {thumbStatus && !thumbError && (
              <div className="mb-2 flex items-center gap-1.5 rounded-xl bg-sky-500/10 px-3 py-2 text-xs text-sky-400 border border-sky-500/20">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>{thumbStatus}</span>
              </div>
            )}

            <input
              type="url"
              placeholder="Or paste custom thumbnail URL..."
              value={poster.startsWith('data:') ? '' : poster}
              onChange={(e) => setPoster(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-1">
              Tags (press Enter or comma to add)
            </label>
            <input
              type="text"
              placeholder="e.g. 4k, animation, tutorial"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              className="w-full min-h-[44px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none mb-2"
            />
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-lg bg-[var(--bg)] px-2.5 py-1 text-xs text-[var(--ink)] border border-[var(--ink-faint)]"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    aria-label={`Remove tag ${tag}`}
                    className="px-1 text-[var(--ink-medium)] hover:text-rose-500 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-3 border-t border-[var(--ink-faint)]">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl px-4 py-2 text-xs font-bold text-[var(--ink-medium)] hover:bg-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploadingThumb}
              className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-[#FF0000] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#CC0000] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
